#!/usr/bin/env bun

/**
 * Karaoke Grader v1 - Integration Test (Full Recording)
 *
 * Usage (example):
 *   LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-grader.ts
 *   LIT_NETWORK=naga-test SUBGRAPH_URL=https://... bun tests/karaoke/test-karaoke-grader.ts
 */
import fs from 'fs';
import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, defineChain } from 'viem';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Env } from '../shared/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIT_ACTION_CID = Env.cids.karaoke;
const SUBGRAPH_URL = process.env.SUBGRAPH_URL;
const AUDIO_PATH = process.env.KARAOKE_AUDIO_PATH || join(__dirname, '../fixtures/blinding-lights.mp3');
const METADATA_URI = process.env.KARAOKE_CLIP_METADATA_URI;
const CLIP_HASH = process.env.KARAOKE_CLIP_HASH || '0x4b2b4e6423432c962a96a70b0de01166849e888e16255961c30a4229d76544fb';
const SPOTIFY_TRACK_ID = process.env.KARAOKE_SPOTIFY_TRACK_ID || '4cOdK2wGLETKBW3PvgPWqT';
const PERFORMER = process.env.KARAOKE_PERFORMER || `0x${'1'.repeat(40)}`;

// TEST_MODE defaults to FALSE - always run real flow
const TEST_MODE = process.env.KARAOKE_TEST_MODE === 'true';
const SKIP_TX = process.env.KARAOKE_SKIP_TX === 'true';
const TX_DEBUG_STAGE = process.env.KARAOKE_TX_STAGE;
const TRANSCRIPT_OVERRIDE_PATH = process.env.KARAOKE_TRANSCRIPT_OVERRIDE_PATH;

let voxtralEncryptedKeyMemo: any;
let openRouterEncryptedKeyMemo: any;
const includeOpenRouter = process.env.KARAOKE_NO_OPENROUTER !== '1';
const USE_LOCAL_CODE = process.env.USE_LOCAL_CODE === '1';
const SKIP_GEMINI = process.env.KARAOKE_SKIP_GEMINI === '1';
const FORCE_GEMINI_FALLBACK = process.env.KARAOKE_FORCE_GEMINI_FALLBACK === '1';

if (!LIT_ACTION_CID) {
  console.error('❌ Missing CID for karaoke action (check cids/*.json)');
  process.exit(1);
}

if (!SUBGRAPH_URL && !METADATA_URI) {
  console.error('❌ Missing env: SUBGRAPH_URL or KARAOKE_CLIP_METADATA_URI');
  process.exit(1);
}

function loadAudioToBase64(path: string): string {
  return fs.readFileSync(path).toString('base64');
}

async function createAuthContext(litClient: any) {
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-grader-test',
      networkName: Env.name,
      storagePath: Env.getAuthStoragePath('karaoke-grader')
    })
  });

  const testPrivateKey =
    process.env.PAYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.LIT_TEST_PRIVATE_KEY ||
    ('0x' + '1'.padStart(64, '0'));
  const viemAccount = privateKeyToAccount(testPrivateKey as `0x${string}`);
  console.log('💳 Payer address:', viemAccount.address, Env.isTest ? '(needs tstLPX/delegation)' : '(free on naga-dev)');

  return authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resources: [{
        resource: new LitActionResource('*'),
        ability: 'lit-action-execution'
      }]
    },
    config: { account: viemAccount },
    litClient
  });
}

async function fetchClipMetadata() {
  const query = `
    query GetClip($clipId: ID!) {
      clip(id: $clipId) {
        clipHash
        spotifyTrackId
        metadataUri
      }
    }
  `;

  const res = await fetch(SUBGRAPH_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { clipId: CLIP_HASH.toLowerCase() } })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clip metadata fetch failed (${res.status}): ${text}`);
  }

  const json = await res.json() as any;
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'Unknown subgraph error');
  }

  if (!json.data?.clip) {
    throw new Error('Clip not found in subgraph. Provide KARAOKE_CLIP_METADATA_URI to bypass.');
  }

  return json.data.clip;
}

async function loadVoxtralKey() {
  if (voxtralEncryptedKeyMemo) return voxtralEncryptedKeyMemo;
  voxtralEncryptedKeyMemo = Env.loadKey('karaoke', 'voxtral_api_key');
  return voxtralEncryptedKeyMemo;
}

async function loadOpenRouterKey() {
  if (!includeOpenRouter) return null;
  if (openRouterEncryptedKeyMemo) return openRouterEncryptedKeyMemo;
  openRouterEncryptedKeyMemo = Env.loadKey('karaoke', 'openrouter_api_key');
  return openRouterEncryptedKeyMemo;
}

function loadTranscriptOverride(): string | undefined {
  if (!TRANSCRIPT_OVERRIDE_PATH) return undefined;
  const resolved = TRANSCRIPT_OVERRIDE_PATH.startsWith('/')
    ? TRANSCRIPT_OVERRIDE_PATH
    : join(__dirname, TRANSCRIPT_OVERRIDE_PATH);
  return fs.readFileSync(resolved, 'utf-8').trim();
}

async function main() {
  console.log('🎤 Karaoke Grader v1 Test (full-song grader)');
  console.log('Subgraph:', SUBGRAPH_URL || '(using metadata override)');
  console.log('CID:', LIT_ACTION_CID, USE_LOCAL_CODE ? '(overridden by local code)' : '');
  console.log('Network:', Env.name, Env.isTest ? '(payments enforced)' : '(free)');
  console.log('Clip Hash:', CLIP_HASH);
  console.log('Spotify Track ID:', SPOTIFY_TRACK_ID);
  console.log('Performer:', PERFORMER);
  console.log('Audio Path:', AUDIO_PATH);
  console.log('Metadata URI override:', METADATA_URI || '(fetch via subgraph)');
  console.log('Transcript override:', TRANSCRIPT_OVERRIDE_PATH || '(none)');
  console.log('Test mode:', TEST_MODE ? 'ON (no tx)' : 'OFF (real contract submission)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const audioBase64 = loadAudioToBase64(AUDIO_PATH);
    const clipMetadata = METADATA_URI
      ? { metadataUri: METADATA_URI, spotifyTrackId: SPOTIFY_TRACK_ID }
      : await fetchClipMetadata();

    const litClient = await createLitClient({ network: Env.litNetwork });
    const authContext = await createAuthContext(litClient);

    // Fetch nonce deterministically
    const LENS_TESTNET = defineChain({
      id: 37111,
      name: 'Lens Testnet',
      network: 'lens-testnet',
      nativeCurrency: { name: 'GRASS', symbol: 'GRASS', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.testnet.lens.xyz'] } },
    });

    const publicClient = createPublicClient({
      chain: LENS_TESTNET,
      transport: http(),
    });

    const pkpAddress = (Env.contracts as any).PKP_ADDRESS || "0x3e89ABa33562d4C45E62A97Aa11443F738983bFf";
    console.log('PKP Address:', pkpAddress);
    const nonceOverride = await publicClient.getTransactionCount({ address: pkpAddress as `0x${string}` });
    console.log(`✅ Client-fetched Nonce: ${nonceOverride}`);

    const jsParams: Record<string, any> = {
      performanceId: Date.now(),
      clipHash: CLIP_HASH,
      spotifyTrackId: SPOTIFY_TRACK_ID,
      performer: PERFORMER,
      performanceType: 'CLIP',
      audioDataBase64: audioBase64,
      voxtralEncryptedKey: await loadVoxtralKey(),
      openRouterEncryptedKey: await loadOpenRouterKey(),
      clipMetadataOverride: clipMetadata,
      transcriptOverride: loadTranscriptOverride(),
      subgraphUrl: SUBGRAPH_URL,
      testMode: TEST_MODE,
      skipTx: SKIP_TX,
      skipAi: false,
      txDebugStage: TX_DEBUG_STAGE,
      gradeOverride: 'Great',
      nonceOverride: nonceOverride.toString(),
      skipGemini: SKIP_GEMINI,
      forceGeminiFallback: FORCE_GEMINI_FALLBACK,
    };

    if (!includeOpenRouter) {
      delete jsParams.openRouterEncryptedKey;
    }

    console.log('\n🚀 Executing Lit Action...');
    const startTime = Date.now();

    const execParams = USE_LOCAL_CODE
      ? {
          code: fs.readFileSync(join(__dirname, '../../actions/karaoke-grader-v1.js'), 'utf-8'),
          authContext,
          jsParams,
        }
      : {
          ipfsId: LIT_ACTION_CID,
          authContext,
          jsParams,
        };

    const result = await litClient.executeJs(execParams);

    const executionTime = Date.now() - startTime;
    const response = JSON.parse(result.response as string);

    console.log('✅ Lit Action completed in', executionTime, 'ms');
    console.log('Response:', response);

    const assertions = [
      {
        name: 'Execution succeeded',
        pass: response.success === true,
        actual: response.success
      },
      {
        name: 'Line count populated',
        pass: typeof response.lineCount === 'number' && response.lineCount > 0,
        actual: response.lineCount
      },
      {
        name: 'Performer matches request',
        pass: response.performer?.toLowerCase() === PERFORMER.toLowerCase(),
        actual: response.performer
      },
      {
        name: 'Clip hash matches request',
        pass: response.clipHash?.toLowerCase() === CLIP_HASH.toLowerCase(),
        actual: response.clipHash
      },
      {
        name: 'Tx hash when testMode=false and skipTx=false',
        pass: TEST_MODE || SKIP_TX ? !response.txHash : typeof response.txHash === 'string',
        actual: response.txHash || '(none)'
      }
    ];

    console.log('\n🧪 Assertions');
    const failures: string[] = [];
    assertions.forEach((assertion, idx) => {
      const status = assertion.pass ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${assertion.name}`);
      if (!assertion.pass) {
        console.log(`   Expected: true, got: ${assertion.actual}`);
        failures.push(assertion.name);
      }
    });

    await litClient.disconnect();

    if (failures.length) {
      console.error('\n❌ Test failed:', failures.join(', '));
      process.exit(1);
    }

    console.log('\n🎉 All assertions passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test aborted:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
