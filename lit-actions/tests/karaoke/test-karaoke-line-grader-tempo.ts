#!/usr/bin/env bun

/**
 * Test Karaoke Line Grader - Tempo Edition
 *
 * Tests single-line grading with Tempo's 0x76 transaction format and parallel nonces.
 *
 * Usage:
 *   # Test mode (skip external calls)
 *   LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-line-grader-tempo.ts
 *
 *   # Full flow with transcription (skip TX)
 *   LIT_NETWORK=naga-dev KARAOKE_SKIP_TX=true bun tests/karaoke/test-karaoke-line-grader-tempo.ts
 *
 *   # Full flow with TX submission
 *   LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-line-grader-tempo.ts
 *
 *   # Specific audio file
 *   KARAOKE_AUDIO_PATH=tests/fixtures/my-audio.mp3 bun tests/karaoke/test-karaoke-line-grader-tempo.ts
 *
 *   # Test parallel nonces (multiple lines)
 *   KARAOKE_TEST_PARALLEL=true bun tests/karaoke/test-karaoke-line-grader-tempo.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ethers, JsonRpcProvider, formatEther, solidityPackedKeccak256 } from 'ethers';
import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from "@lit-protocol/auth-helpers";
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from '../shared/env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../../');

// Test configuration
const DEFAULT_AUDIO_PATH = 'tests/fixtures/hey-im-scarlett-how-are-you-doing.wav';
const DEFAULT_CLIP_HASH = '0x4b2b4e6423432c962a96a70b0de01166849e888e16255961c30a4229d76544fb';

// Tempo Testnet
const TEMPO_CHAIN_ID = 42429;
const TEMPO_RPC = 'https://rpc.testnet.tempo.xyz';
const KARAOKE_EVENTS_ADDRESS = '0xde5128281D0A12808346ba4866D952EDB487BEcC';
const TEMPO_EXPLORER = 'https://explorer.testnet.tempo.xyz';

async function main() {
  console.log('='.repeat(60));
  console.log('Karaoke Line Grader - Tempo Edition - Test');
  console.log('='.repeat(60));
  console.log(`Environment: ${Env.name}`);
  console.log(`Network: ${Env.litNetwork}`);
  console.log(`Tempo Chain ID: ${TEMPO_CHAIN_ID}`);
  console.log(`Contract: ${KARAOKE_EVENTS_ADDRESS}`);

  // Load PKP credentials (for logging)
  const pkpCreds = Env.loadPkpCreds();
  console.log(`PKP Address: ${pkpCreds.ethAddress}`);

  // Check PKP balance on Tempo
  const tempoProvider = new JsonRpcProvider(TEMPO_RPC);
  const pkpBalance = await tempoProvider.getBalance(pkpCreds.ethAddress);
  console.log(`PKP Tempo Balance: ${formatEther(pkpBalance)} ETH`);

  if (pkpBalance === 0n) {
    console.warn('\n⚠️  WARNING: PKP has no balance on Tempo Testnet!');
    console.warn(`   Fund ${pkpCreds.ethAddress} on Tempo Testnet to submit transactions.\n`);
  }

  // Test parameters
  const testMode = process.env.KARAOKE_TEST_MODE === 'true';
  const skipTx = process.env.KARAOKE_SKIP_TX === 'true' || testMode;
  const testParallel = process.env.KARAOKE_TEST_PARALLEL === 'true';
  const audioPath = process.env.KARAOKE_AUDIO_PATH || DEFAULT_AUDIO_PATH;
  const clipHash = process.env.KARAOKE_CLIP_HASH || DEFAULT_CLIP_HASH;
  const lineIndex = Number(process.env.KARAOKE_LINE_INDEX || '0');
  const subgraphUrl = process.env.KARAOKE_SUBGRAPH_URL || process.env.SUBGRAPH_URL;
  const metadataUriOverride = process.env.KARAOKE_METADATA_URI;
  const transcriptOverride = process.env.KARAOKE_TRANSCRIPT_OVERRIDE;
  const lyricsOverride = process.env.KARAOKE_LYRICS_OVERRIDE
    ? JSON.parse(process.env.KARAOKE_LYRICS_OVERRIDE)
    : (transcriptOverride ? [{ text: transcriptOverride, startMs: 0, endMs: 5000, index: 0 }] : undefined);
  const startSession = process.env.KARAOKE_START_SESSION !== 'false';
  const endSession = process.env.KARAOKE_END_SESSION === 'true';
  const sessionCompleted = process.env.KARAOKE_SESSION_COMPLETED === 'true';

  // Generate test session data
  const performer = process.env.KARAOKE_PERFORMER || '0x1111111111111111111111111111111111111111';
  const clientNonce = Date.now();

  // Generate deterministic sessionId
  const sessionId = solidityPackedKeccak256(
    ['address', 'bytes32', 'uint256'],
    [performer, clipHash, clientNonce]
  );

  console.log(`\nTest Configuration:`);
  console.log(`  Test Mode: ${testMode}`);
  console.log(`  Skip TX: ${skipTx}`);
  console.log(`  Test Parallel: ${testParallel}`);
  console.log(`  Audio Path: ${audioPath}`);
  console.log(`  Clip Hash: ${clipHash}`);
  console.log(`  Line Index: ${lineIndex}`);
  console.log(`  Subgraph: ${subgraphUrl || '(default prod)'}`);
  if (metadataUriOverride) console.log(`  Metadata URI override: ${metadataUriOverride}`);
  console.log(`  Session ID: ${sessionId.slice(0, 18)}...`);
  console.log(`  Start Session: ${startSession}`);
  console.log(`  End Session: ${endSession} (completed=${sessionCompleted})`);

  // Load audio if not in test mode
  let audioDataBase64 = '';
  if (!testMode && !transcriptOverride) {
    const audioFullPath = join(ROOT_DIR, audioPath);
    try {
      const audioBuffer = readFileSync(audioFullPath);
      audioDataBase64 = audioBuffer.toString('base64');
      console.log(`  Audio Size: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
    } catch (err: any) {
      console.error(`\nError loading audio: ${err.message}`);
      console.error(`Path: ${audioFullPath}`);
      process.exit(1);
    }
  }

  // Load encrypted Voxtral key
  let voxtralEncryptedKey = null;
  let voxtralPlaintextKey = process.env.VOXTRAL_API_KEY;
  if (!testMode) {
    try {
      voxtralEncryptedKey = Env.loadKey('karaoke-line', 'voxtral_api_key');
      console.log(`  Voxtral Key: Loaded`);
    } catch (err: any) {
      // Try loading from karaoke folder as fallback
      try {
        voxtralEncryptedKey = Env.loadKey('karaoke', 'voxtral_api_key');
        console.log(`  Voxtral Key: Loaded (from karaoke)`);
      } catch {
        if (voxtralPlaintextKey) {
          console.log('  Voxtral Key: Using VOXTRAL_API_KEY plaintext (dev override)');
        } else {
          console.error(`\nError loading Voxtral key: ${err.message}`);
          console.error('Run: bun scripts/setup.ts karaoke-line or set VOXTRAL_API_KEY');
          process.exit(1);
        }
      }
    }
  }

  // Get action CID or use local code
  let actionCode = '';
  let actionCid = '';

  // For Tempo, always use local code for now
  const actionPath = join(ROOT_DIR, 'actions/karaoke-line-grader-tempo.js');
  actionCode = readFileSync(actionPath, 'utf-8');
  console.log(`  Action: Local code (${actionCode.length} bytes)`);

  // Connect to Lit Protocol
  console.log('\nConnecting to Lit Protocol...');
  const litClient = await createLitClient({ network: Env.litNetwork });
  console.log('Connected!');

  // Create auth context (EOA-based) for executing the Lit Action
  console.log('\nCreating auth context...');
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-line-grader-tempo-test',
      networkName: Env.name,
      storagePath: Env.getAuthStoragePath('karaoke-line-tempo'),
    }),
  });

  const payerPrivateKey =
    process.env.PAYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.LIT_TEST_PRIVATE_KEY ||
    ('0x' + '1'.padStart(64, '0'));

  const viemAccount = privateKeyToAccount(payerPrivateKey as `0x${string}`);
  console.log(`Payer address: ${viemAccount.address}`);

  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resources: [{
        resource: new LitActionResource('*'),
        ability: 'lit-action-execution'
      }],
    },
    config: { account: viemAccount },
    litClient,
  });
  console.log('Auth context ready');

  // If testing parallel nonces, run multiple lines concurrently
  if (testParallel && !testMode && !skipTx) {
    await testParallelNonces({
      litClient,
      authContext,
      actionCode,
      sessionId,
      clipHash,
      performer,
      audioDataBase64,
      voxtralEncryptedKey,
      voxtralPlaintextKey,
      subgraphUrl,
      metadataUriOverride,
      transcriptOverride,
    });
    await litClient.disconnect();
    return;
  }

  // Build jsParams
  const jsParams = {
    sessionId,
    clipHash,
    performer,
    lineIndex,
    startSession,
    endSession,
    sessionCompleted,
    audioDataBase64: testMode ? '' : audioDataBase64,
    voxtralEncryptedKey,
    voxtralPlaintextKey,
    transcriptOverride,
    lyricsOverride,
    testMode,
    skipTx,
    subgraphUrl,
    metadataUriOverride,
  };

  // Execute action
  console.log('\nExecuting Lit Action...');
  const startTime = Date.now();

  try {
    const result = await litClient.executeJs({
      authContext,
      code: actionCode,
      jsParams,
    });

    const executionTime = Date.now() - startTime;
    console.log(`\nExecution completed in ${executionTime}ms`);

    // Parse response
    const response = JSON.parse(result.response as string);

    if (response.success) {
      console.log('\n' + '='.repeat(60));
      console.log('SUCCESS');
      console.log('='.repeat(60));
      console.log(`Version: ${response.version}`);
      console.log(`Line Index: ${response.lineIndex}`);
      console.log(`Transcript: "${response.transcript}"`);
      console.log(`Expected: "${response.expectedText}"`);
      console.log(`Score: ${response.scoreBp} (${(response.scoreBp / 100).toFixed(1)}%)`);
      console.log(`Rating: ${response.rating} (${ratingToLabel(response.rating)})`);

      if (response.startTxHash) {
        console.log(`Start TX: ${response.startTxHash}`);
        console.log(`Explorer: ${TEMPO_EXPLORER}/tx/${response.startTxHash}`);
      }
      if (response.lineTxHash) {
        console.log(`Line TX: ${response.lineTxHash}`);
        console.log(`Explorer: ${TEMPO_EXPLORER}/tx/${response.lineTxHash}`);
      }
      if (response.endTxHash) {
        console.log(`End TX: ${response.endTxHash}`);
        console.log(`Explorer: ${TEMPO_EXPLORER}/tx/${response.endTxHash}`);
      }

      if (response.metrics) {
        console.log('\nMetrics:');
        if (response.metrics.transcriptionMs) {
          console.log(`  Transcription: ${response.metrics.transcriptionMs}ms`);
        }
        console.log(`  Phases: ${response.metrics.phases?.map((p: any) => `${p.phase}(${p.ms}ms)`).join(' → ')}`);
        console.log(`  Total: ${response.executionTime}ms`);
      }
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('FAILED');
      console.log('='.repeat(60));
      console.log(`Error: ${response.error}`);
      console.log(`Phase: ${response.phase}`);
      if (response.metrics) {
        console.log(`Metrics: ${JSON.stringify(response.metrics, null, 2)}`);
      }
      process.exit(1);
    }

  } catch (err: any) {
    console.error('\nLit Action execution failed:');
    console.error(err.message);
    if (err.errorKind) {
      console.error(`Error kind: ${err.errorKind}`);
    }
    process.exit(1);
  } finally {
    await litClient.disconnect();
  }

  console.log('\nDone!');
}

/**
 * Test parallel nonces by grading 3 lines concurrently.
 * This demonstrates that lines 0, 1, 2 can all be submitted at the same time
 * without nonce conflicts because they each use their own nonce_key.
 */
async function testParallelNonces({
  litClient,
  authContext,
  actionCode,
  sessionId,
  clipHash,
  performer,
  audioDataBase64,
  voxtralEncryptedKey,
  voxtralPlaintextKey,
  subgraphUrl,
  metadataUriOverride,
  transcriptOverride,
}: {
  litClient: any;
  authContext: any;
  actionCode: string;
  sessionId: string;
  clipHash: string;
  performer: string;
  audioDataBase64: string;
  voxtralEncryptedKey: any;
  voxtralPlaintextKey: string | undefined;
  subgraphUrl: string | undefined;
  metadataUriOverride: string | undefined;
  transcriptOverride: string | undefined;
}) {
  console.log('\n' + '='.repeat(60));
  console.log('PARALLEL NONCES TEST');
  console.log('='.repeat(60));
  console.log('Testing concurrent line grading with separate nonce keys...');
  // Use higher line indices to get fresh nonce keys (previous tests used keys 1-3)
  const lineOffset = 100;
  console.log(`  Line ${lineOffset + 0} → nonce_key = ${lineOffset + 1}`);
  console.log(`  Line ${lineOffset + 1} → nonce_key = ${lineOffset + 2}`);
  console.log(`  Line ${lineOffset + 2} → nonce_key = ${lineOffset + 3}`);

  // Use transcript overrides for faster testing
  // All lines share the same lyrics array with 103 entries (to support lineOffset + 0-2)
  const sharedLyrics = Array.from({ length: 103 }, (_, i) => ({
    text: `Test line ${i} transcript`,
    startMs: i * 5000,
    endMs: (i + 1) * 5000,
    index: i,
  }));
  const testLines = [
    { lineIndex: lineOffset + 0, transcript: `Test line ${lineOffset + 0} transcript`, lyrics: sharedLyrics },
    { lineIndex: lineOffset + 1, transcript: `Test line ${lineOffset + 1} transcript`, lyrics: sharedLyrics },
    { lineIndex: lineOffset + 2, transcript: `Test line ${lineOffset + 2} transcript`, lyrics: sharedLyrics },
  ];

  console.log('\nSubmitting 3 lines in parallel...');
  const startTime = Date.now();

  // Execute all 3 concurrently
  const promises = testLines.map(({ lineIndex, transcript, lyrics }) => {
    return litClient.executeJs({
      authContext,
      code: actionCode,
      jsParams: {
        sessionId,
        clipHash,
        performer,
        lineIndex,
        startSession: lineIndex === 0, // Only first line starts session
        endSession: false,
        sessionCompleted: false,
        audioDataBase64: '',
        voxtralEncryptedKey,
        voxtralPlaintextKey,
        transcriptOverride: transcript,
        lyricsOverride: lyrics,
        testMode: false,
        skipTx: false,
        subgraphUrl,
        metadataUriOverride,
      },
    });
  });

  const results = await Promise.allSettled(promises);

  const totalTime = Date.now() - startTime;
  console.log(`\nAll submissions completed in ${totalTime}ms\n`);

  // Process results
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { lineIndex } = testLines[i];

    console.log(`Line ${lineIndex} (nonce_key=${lineIndex + 1}):`);

    if (result.status === 'fulfilled') {
      const response = JSON.parse(result.value.response as string);
      if (response.success) {
        successCount++;
        console.log(`  ✓ Success - TX: ${response.lineTxHash?.slice(0, 18)}...`);
        console.log(`    Score: ${response.scoreBp} bp, Rating: ${ratingToLabel(response.rating)}`);
      } else {
        failCount++;
        console.log(`  ✗ Failed - ${response.error}`);
        console.log(`    Phase: ${response.phase}`);
      }
    } else {
      failCount++;
      console.log(`  ✗ Rejected - ${result.reason?.message || result.reason}`);
    }
  }

  console.log('\n' + '-'.repeat(40));
  console.log(`Results: ${successCount} succeeded, ${failCount} failed`);

  if (successCount === 3) {
    console.log('\n✓ PARALLEL NONCES WORKING!');
    console.log('  All 3 lines submitted concurrently without nonce conflicts.');
  } else if (failCount > 0 && successCount < 3) {
    console.log('\n⚠️  Some lines failed.');
    console.log('  Check if failures are due to nonce conflicts or other issues.');
  }

  console.log('\nDone!');
}

function ratingToLabel(rating: number): string {
  switch (rating) {
    case 3: return 'Easy';
    case 2: return 'Good';
    case 1: return 'Hard';
    case 0: return 'Again';
    default: return 'Unknown';
  }
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
