#!/usr/bin/env bun

/**
 * Test Karaoke Line Grader v1
 *
 * Tests single-line grading for session-based karaoke.
 *
 * Usage:
 *   # Test mode (skip external calls)
 *   LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-line-grader.ts
 *
 *   # Full flow with transcription
 *   LIT_NETWORK=naga-dev KARAOKE_SKIP_TX=true bun tests/karaoke/test-karaoke-line-grader.ts
 *
 *   # Specific audio file
 *   KARAOKE_AUDIO_PATH=tests/fixtures/my-audio.mp3 bun tests/karaoke/test-karaoke-line-grader.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
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

async function main() {
  console.log('='.repeat(60));
  console.log('Karaoke Line Grader v1 - Test');
  console.log('='.repeat(60));
  console.log(`Environment: ${Env.name}`);
  console.log(`Network: ${Env.litNetwork}`);

  // Load PKP credentials (for logging)
  const pkpCreds = Env.loadPkpCreds();
  console.log(`PKP Address: ${pkpCreds.ethAddress}`);

  // Test parameters
  const testMode = process.env.KARAOKE_TEST_MODE === 'true';
  const skipTx = process.env.KARAOKE_SKIP_TX === 'true' || testMode;
  const audioPath = process.env.KARAOKE_AUDIO_PATH || DEFAULT_AUDIO_PATH;
  const clipHash = process.env.KARAOKE_CLIP_HASH || DEFAULT_CLIP_HASH;
  const lineIndex = Number(process.env.KARAOKE_LINE_INDEX || '0');
  const subgraphUrl = process.env.KARAOKE_SUBGRAPH_URL || process.env.SUBGRAPH_URL;
  const metadataUriOverride = process.env.KARAOKE_METADATA_URI;
  const transcriptOverride = process.env.KARAOKE_TRANSCRIPT_OVERRIDE;
  const startSession = process.env.KARAOKE_START_SESSION !== 'false';
  const endSession = process.env.KARAOKE_END_SESSION === 'true';
  const sessionCompleted = process.env.KARAOKE_SESSION_COMPLETED === 'true';

  // Generate test session data
  const performer = process.env.KARAOKE_PERFORMER || '0x1111111111111111111111111111111111111111';
  const clientNonce = Date.now();

  // Generate deterministic sessionId
  const sessionId = ethers.solidityPackedKeccak256(
    ['address', 'bytes32', 'uint256'],
    [performer, clipHash, clientNonce]
  );

  console.log(`\nTest Configuration:`);
  console.log(`  Test Mode: ${testMode}`);
  console.log(`  Skip TX: ${skipTx}`);
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

  if (process.env.USE_LOCAL_CODE === '1') {
    const actionPath = join(ROOT_DIR, 'actions/karaoke-line-grader-v1.js');
    actionCode = readFileSync(actionPath, 'utf-8');
    console.log(`  Action: Local code (${actionCode.length} bytes)`);
  } else {
    try {
      actionCid = Env.cids['karaoke-line'];
      console.log(`  Action CID: ${actionCid}`);
    } catch {
      // Fall back to local code if CID not found
      const actionPath = join(ROOT_DIR, 'actions/karaoke-line-grader-v1.js');
      actionCode = readFileSync(actionPath, 'utf-8');
      console.log(`  Action: Local code (no CID found)`);
    }
  }

  // Connect to Lit Protocol
  console.log('\nConnecting to Lit Protocol...');
  const litClient = await createLitClient({ network: Env.litNetwork });
  console.log('Connected!');

  // Create auth context (EOA-based) for executing the Lit Action
  console.log('\nCreating auth context...');
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-line-grader-test',
      networkName: Env.name,
      storagePath: Env.getAuthStoragePath('karaoke-line'),
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
    testMode,
    skipTx,
    subgraphUrl,
    metadataUriOverride,
  };

  // Execute action
  console.log('\nExecuting Lit Action...');
  const startTime = Date.now();

  try {
    let result;

    if (actionCode) {
      // Execute local code
      result = await litClient.executeJs({
        authContext,
        code: actionCode,
        jsParams,
      });
    } else {
      // Execute from IPFS
      result = await litClient.executeJs({
        authContext,
        ipfsId: actionCid,
        jsParams,
      });
    }

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
      }
      if (response.lineTxHash) {
        console.log(`Line TX: ${response.lineTxHash}`);
        console.log(`Explorer: https://testnet.explorer.lens.xyz/tx/${response.lineTxHash}`);
      }
      if (response.endTxHash) {
        console.log(`End TX: ${response.endTxHash}`);
      }

      if (response.metrics) {
        console.log('\nMetrics:');
        if (response.metrics.transcriptionMs) {
          console.log(`  Transcription: ${response.metrics.transcriptionMs}ms`);
        }
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
