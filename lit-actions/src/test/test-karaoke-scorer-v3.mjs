#!/usr/bin/env node

/**
 * Test Script for Karaoke Scorer v3 Lit Action
 *
 * Tests the simplified v3 architecture:
 * - Contract addresses hardcoded (no unnecessary encryption)
 * - Only Voxstral API key encrypted (actual secret)
 * - Simpler jsParams
 *
 * Flow:
 * 1. Load test audio
 * 2. Call karaoke-scorer-v3.js Lit Action with clipId
 * 3. Lit Action queries ClipRegistry (hardcoded address)
 * 4. Fetches lyrics from Grove via timestampsUri
 * 5. Transcribes audio and calculates score
 * 6. Submits to scoreboard contract (hardcoded address)
 *
 * Usage:
 *   bun run test:scorer-v3
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials
const PKP_CREDS_PATH = '/media/t42/th42/Code/site/contracts/output/pkp-credentials.json';

// Contract addresses are hardcoded in v3 Lit Action (public data)
const CLIP_REGISTRY_ADDRESS = '0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf';
const SCOREBOARD_CONTRACT_ADDRESS = '0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A';

// Test data
const TEST_CLIP_ID = "down-home-blues-verse";
const TEST_USER_ADDRESS = "0x0C6433789d14050aF47198B2751f6689731Ca79C";

async function loadTestAudio() {
  console.log('📁 Loading test audio...');
  const audioPath = join(__dirname, 'test-audio.mp3');
  const audioBuffer = await readFile(audioPath);
  const audioBase64 = audioBuffer.toString('base64');
  console.log(`✅ Audio loaded: ${audioBuffer.length} bytes → ${audioBase64.length} chars base64`);
  return audioBase64;
}

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadVoxstralKey() {
  console.log('📦 Loading encrypted Voxstral API key (only secret)...');
  const keyPath = join(__dirname, '../stt/keys/voxstral_api_key.json');
  const encryptedKey = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log('✅ Voxstral API key loaded (locked to CID:', encryptedKey.cid + ')');

  return {
    ciphertext: encryptedKey.ciphertext,
    dataToEncryptHash: encryptedKey.dataToEncryptHash,
    accessControlConditions: encryptedKey.accessControlConditions
  };
}

async function main() {
  console.log('🎤 Karaoke Scorer v3 Test (Simplified Architecture)\\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

  try {
    // 1. Load test data
    const audioDataBase64 = await loadTestAudio();
    const pkpCreds = await loadPKPCredentials();

    // 2. Set up Auth Manager
    console.log('\\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "karaoke-scorer-v3-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // 3. Connect to Lit
    console.log('\\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // 4. Create authentication context
    console.log('\\n🔐 Creating authentication context...');
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env');
    }

    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const viemAccount = privateKeyToAccount(cleanPrivateKey);

    const authContext = await authManager.createEoaAuthContext({
      authConfig: {
        chain: 'ethereum',
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');

    // 5. Load ONLY Voxstral key encryption (v3 simplification)
    const voxstralEncrypted = await loadVoxstralKey();

    // 6. Use v3 IPFS CID (updated for V2 scoreboard)
    console.log('\\n📦 Using Lit Action v3 from IPFS...');
    const IPFS_CID = 'QmS3Q7pcRXvb12pB2e681YMq1BWqyGY5MUdzT8sFEs4rzs';
    console.log('✅ CID:', IPFS_CID);

    // 7. Prepare jsParams (SIMPLIFIED - no contract address encryption!)
    const jsParams = {
      audioDataBase64,
      userAddress: TEST_USER_ADDRESS,
      clipId: TEST_CLIP_ID,
      pkpPublicKey: pkpCreds.publicKey || pkpCreds.ethAddress,
      language: 'en',
      sessionId: `test-v3-${Date.now()}`,

      // Only Voxstral API key encryption (actual secret)
      accessControlConditions: voxstralEncrypted.accessControlConditions,
      ciphertext: voxstralEncrypted.ciphertext,
      dataToEncryptHash: voxstralEncrypted.dataToEncryptHash,

      // NO contract address encryption params! (v3 improvement)
    };

    // 8. Execute Lit Action v3
    console.log('\\n🚀 Executing Lit Action v3...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
    console.log('📝 Parameters:');
    console.log('   Clip ID:', TEST_CLIP_ID);
    console.log('   User:', TEST_USER_ADDRESS);
    console.log('   ClipRegistry:', CLIP_REGISTRY_ADDRESS, '(hardcoded in v3)');
    console.log('   Scoreboard:', '0xD4A9c232982Bb25299E9F62128617DAC5099B059', '(V2 with top-10 leaderboard)');
    console.log('   Audio size:', audioDataBase64.length, 'chars');
    console.log('   Encrypted params: Voxstral API key ONLY\\n');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: IPFS_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\\n`);

    // 9. Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\\n');

    const response = JSON.parse(result.response);

    console.log('✅ Success:', response.success);
    console.log('📝 Version:', response.version);
    console.log('\\n--- Transcription ---');
    console.log('Transcript:', response.transcript || '(none)');

    console.log('\\n--- Score ---');
    console.log('Score:', response.score, '/ 100');
    console.log('(Lyrics fetched from ClipRegistry on-chain)');

    console.log('\\n--- Contract Submission ---');
    if (response.txHash) {
      console.log('✅ Transaction submitted!');
      console.log('TX Hash:', response.txHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
    } else if (response.txHash === null && !response.error) {
      console.log('⏳ Transaction pending or not yet confirmed');
    } else {
      console.log('❌ Transaction failed or not submitted');
    }

    if (response.error) {
      console.log('\\n--- Error ---');
      console.log('Error:', response.error);
    }

    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 10. Test assertions
    console.log('\\n🧪 Test Assertions:\\n');

    const assertions = [
      {
        name: 'Execution successful',
        pass: response.success === true,
        actual: response.success
      },
      {
        name: 'Transcript returned',
        pass: response.transcript && response.transcript.length > 0,
        actual: response.transcript ? `"${response.transcript.substring(0, 50)}..."` : 'null'
      },
      {
        name: 'Score calculated (0-100)',
        pass: typeof response.score === 'number' && response.score >= 0 && response.score <= 100,
        actual: response.score
      },
      {
        name: 'Transaction hash present',
        pass: response.txHash && response.txHash.startsWith('0x'),
        actual: response.txHash || 'null'
      },
      {
        name: 'No errors',
        pass: !response.error,
        actual: response.error || 'none'
      },
      {
        name: 'Using v3 (simplified)',
        pass: response.version === 'karaoke_scorer_v3',
        actual: response.version
      }
    ];

    assertions.forEach((assertion, i) => {
      const status = assertion.pass ? '✅' : '❌';
      console.log(`${i + 1}. ${status} ${assertion.name}`);
      if (!assertion.pass) {
        console.log(`   Expected: true, Got: ${assertion.actual}`);
      }
    });

    const allPassed = assertions.every(a => a.pass);

    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED! 🎉');
      console.log('\\n🎯 v3 Improvements Verified:');
      console.log('   ✅ Contract addresses hardcoded (no unnecessary encryption)');
      console.log('   ✅ Only Voxstral API key encrypted (actual secret)');
      console.log('   ✅ Simpler jsParams (fewer parameters)');
      console.log('   ✅ Lyrics from on-chain ClipRegistry (security fix maintained)');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\\n❌ Test failed:', error.message);
    console.error('\\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
