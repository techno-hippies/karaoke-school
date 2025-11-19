#!/usr/bin/env node

/**
 * Karaoke Grader v1 - Integration Test (Full Recording)
 *
 * Usage (example):
 *   export KARAOKE_GRADER_CID=Qm...
 *   export SUBGRAPH_URL=https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.2
 *   bun tests/test-karaoke-grader-ngrok.mjs
 */
const fs = require('fs');
const { createLitClient } = require('@lit-protocol/lit-client');
const { nagaTest } = require('@lit-protocol/networks');
const { createAuthManager, storagePlugins } = require('@lit-protocol/auth');
const { LitActionResource } = require('@lit-protocol/auth-helpers');
const { privateKeyToAccount } = require('viem/accounts');
const { createPublicClient, http, defineChain } = require('viem');
const dotenv = require('dotenv');
const { fileURLToPath } = require('url');
const { dirname, join } = require('path');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const LIT_ACTION_CID = 'QmZpjAKP7ayH21WxT1FQ1w3x6gpx3z1DyBVmXobL9vhVx4'; // process.env.KARAOKE_GRADER_CID
const SUBGRAPH_URL = process.env.SUBGRAPH_URL;
const AUDIO_PATH = process.env.KARAOKE_AUDIO_PATH || join(__dirname, 'fixtures/hey-im-scarlett-how-are-you-doing.wav');
const METADATA_URI = process.env.KARAOKE_CLIP_METADATA_URI;
const CLIP_HASH = process.env.KARAOKE_CLIP_HASH || '0x4b2b4e6423432c962a96a70b0de01166849e888e16255961c30a4229d76544fb';
const SPOTIFY_TRACK_ID = process.env.KARAOKE_SPOTIFY_TRACK_ID || '4cOdK2wGLETKBW3PvgPWqT';
const PERFORMER = process.env.KARAOKE_PERFORMER || `0x${'1'.repeat(40)}`;
const TEST_MODE = process.env.KARAOKE_TEST_MODE !== 'false';
const SKIP_TX = process.env.KARAOKE_SKIP_TX === 'true';
const TRANSCRIPT_OVERRIDE_PATH = process.env.KARAOKE_TRANSCRIPT_OVERRIDE_PATH;
let voxtralEncryptedKeyMemo;
let openRouterEncryptedKeyMemo;

if (!LIT_ACTION_CID) {
  console.error('❌ Missing env: KARAOKE_GRADER_CID');
  process.exit(1);
}

if (!SUBGRAPH_URL) {
  console.error('❌ Missing env: SUBGRAPH_URL (point this at local or production subgraph)');
  process.exit(1);
}

function loadAudioToBase64(path) {
  return fs.readFileSync(path).toString('base64');
}

async function createAuthContext(litClient) {
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-grader-test',
      networkName: 'naga-test',
      storagePath: './lit-auth-storage'
    })
  });

  const testPrivateKey = process.env.LIT_TEST_PRIVATE_KEY || '0x' + '1'.padStart(64, '0');
  const viemAccount = privateKeyToAccount(testPrivateKey);

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

  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { clipId: CLIP_HASH.toLowerCase() } })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clip metadata fetch failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(json.errors[0].message || 'Unknown subgraph error');
  }

  if (!json.data?.clip) {
    throw new Error('Clip not found in subgraph. Provide KARAOKE_CLIP_METADATA_URI to bypass.');
  }

  return json.data.clip;
}

async function loadVoxtralKey() {
  if (voxtralEncryptedKeyMemo) return voxtralEncryptedKeyMemo;
  const keyPath = join(__dirname, '../keys/voxtral_api_key_karaoke.json');
  voxtralEncryptedKeyMemo = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  return voxtralEncryptedKeyMemo;
}

async function loadOpenRouterKey() {
  if (openRouterEncryptedKeyMemo) return openRouterEncryptedKeyMemo;
  const keyPath = join(__dirname, '../keys/openrouter_api_key_karaoke.json');
  openRouterEncryptedKeyMemo = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  return openRouterEncryptedKeyMemo;
}

function loadTranscriptOverride() {
  if (!TRANSCRIPT_OVERRIDE_PATH) return undefined;
  const resolved = TRANSCRIPT_OVERRIDE_PATH.startsWith('/')
    ? TRANSCRIPT_OVERRIDE_PATH
    : join(__dirname, TRANSCRIPT_OVERRIDE_PATH);
  return fs.readFileSync(resolved, 'utf-8').trim();
}

async function main() {
console.log('🎤 Karaoke Grader v1 Test (full-song grader)');
  console.log('Subgraph:', SUBGRAPH_URL);
  console.log('CID:', LIT_ACTION_CID);
  console.log('Clip Hash:', CLIP_HASH);
  console.log('Spotify Track ID:', SPOTIFY_TRACK_ID);
  console.log('Performer:', PERFORMER);
  console.log('Audio Path:', AUDIO_PATH);
  console.log('Metadata URI override:', METADATA_URI || '(fetch via subgraph)');
  console.log('Transcript override:', TRANSCRIPT_OVERRIDE_PATH || '(none)');
  console.log('Test mode:', TEST_MODE ? 'ON (no tx)' : 'OFF (contract submission)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const audioBase64 = await loadAudioToBase64(AUDIO_PATH);
    const clipMetadata = METADATA_URI ? { metadataUri: METADATA_URI, spotifyTrackId: SPOTIFY_TRACK_ID } : await fetchClipMetadata();

    const litClient = await createLitClient({ network: nagaTest });
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

    // Hardcoded PKP address to ensure we check the right account
    // (Should match what is used in Lit Action, which is derived from PKP_PUBLIC_KEY)
    const pkpAddress = "0x3e89ABa33562d4C45E62A97Aa11443F738983bFf"; 
    const nonceOverride = await publicClient.getTransactionCount({ address: pkpAddress });
    console.log(`✅ Client-fetched Nonce: ${nonceOverride}`);

    const jsParams = {
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
      gradeOverride: 'Great',
      nonceOverride: nonceOverride.toString() // Pass as string/number
    };

    console.log('\n🚀 Executing Lit Action...');
    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext,
      jsParams
    });

    const executionTime = Date.now() - startTime;
    const response = JSON.parse(result.response);

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
        name: 'Tx hash only when testMode=false',
        pass: TEST_MODE ? !response.txHash : typeof response.txHash === 'string',
        actual: response.txHash || '(none)'
      }
    ];

    console.log('\n🧪 Assertions');
    const failures = [];
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
  } catch (error) {
    console.error('\n❌ Test aborted:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
