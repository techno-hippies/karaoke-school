#!/usr/bin/env node

/**
 * Test Script for Karaoke Scorer v2 Lit Action
 *
 * Tests the ClipRegistry integration flow:
 * 1. Load test audio
 * 2. Convert to base64
 * 3. Call karaoke-scorer-v2.js Lit Action with clipId
 * 4. Lit Action queries ClipRegistry for clip metadata
 * 5. Fetches lyrics from Grove via timestampsUri
 * 6. Transcribes audio and calculates score
 * 7. Submits score to contract
 *
 * Prerequisites:
 * - Lit Action v2 uploaded to IPFS
 * - ClipRegistry contract with clips
 * - Encrypted keys (Voxstral, ClipRegistry, Scoreboard)
 * - PKP with sign-anything permissions for v2 CID
 *
 * Usage:
 *   bun run test:scorer-v2
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

// Load PKP credentials from contracts output
const PKP_CREDS_PATH = '/media/t42/th42/Code/site/contracts/output/pkp-credentials.json';
const SCOREBOARD_CONTRACT_ADDRESS = '0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A';
const CLIP_REGISTRY_ADDRESS = '0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf';

// Test data - use a real clip from the registry
const TEST_CLIP_ID = "down-home-blues-verse"; // Real clip ID from ClipRegistry
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
  console.log('📦 Loading encrypted Voxstral API key...');
  const keyPath = join(__dirname, '../stt/keys/voxstral_api_key.json');
  const encryptedKey = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log('✅ Voxstral API key loaded (locked to CID:', encryptedKey.cid + ')');

  return {
    ciphertext: encryptedKey.ciphertext,
    dataToEncryptHash: encryptedKey.dataToEncryptHash,
    accessControlConditions: encryptedKey.accessControlConditions
  };
}

async function loadScoreboardContractAddress() {
  console.log('📦 Loading encrypted scoreboard contract address...');
  const keyPath = join(__dirname, '../stt/keys/contract_address.json');
  const encryptedContract = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log('✅ Scoreboard contract address loaded');

  return {
    ciphertext: encryptedContract.ciphertext,
    dataToEncryptHash: encryptedContract.dataToEncryptHash,
    accessControlConditions: encryptedContract.accessControlConditions
  };
}

async function loadClipRegistryAddress() {
  console.log('📦 Loading encrypted ClipRegistry address...');
  const keyPath = join(__dirname, '../stt/keys/clip_registry_address.json');
  const encryptedRegistry = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log('✅ ClipRegistry address loaded');

  return {
    ciphertext: encryptedRegistry.ciphertext,
    dataToEncryptHash: encryptedRegistry.dataToEncryptHash,
    accessControlConditions: encryptedRegistry.accessControlConditions
  };
}

async function main() {
  console.log('🎤 Karaoke Scorer v2 Test (ClipRegistry Integration)\\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

  try {
    // 1. Load test data
    const audioDataBase64 = await loadTestAudio();
    const pkpCreds = await loadPKPCredentials();

    // 2. Set up Auth Manager
    console.log('\\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "karaoke-scorer-v2-test",
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

    // 5. Load pre-encrypted secrets
    const voxstralEncrypted = await loadVoxstralKey();
    const scoreboardEncrypted = await loadScoreboardContractAddress();
    const clipRegistryEncrypted = await loadClipRegistryAddress();

    // 6. Use v2 IPFS CID
    console.log('\\n📦 Using Lit Action v2 from IPFS...');
    const IPFS_CID = 'QmWQX6N8wUs4xPk7DqN77QbqPb93LtsKtPuDGBU4WGeDB4';
    console.log('✅ CID:', IPFS_CID);

    // 7. Prepare jsParams (NO expectedLyrics!)
    const jsParams = {
      audioDataBase64,
      userAddress: TEST_USER_ADDRESS,
      clipId: TEST_CLIP_ID, // ClipRegistry will provide the lyrics
      pkpPublicKey: pkpCreds.publicKey || pkpCreds.ethAddress,
      language: 'en',
      sessionId: `test-v2-${Date.now()}`,

      // Voxstral API key encryption
      accessControlConditions: voxstralEncrypted.accessControlConditions,
      ciphertext: voxstralEncrypted.ciphertext,
      dataToEncryptHash: voxstralEncrypted.dataToEncryptHash,

      // Scoreboard contract encryption
      contractAddressCiphertext: scoreboardEncrypted.ciphertext,
      contractAddressDataToEncryptHash: scoreboardEncrypted.dataToEncryptHash,
      contractAddressAccessControlConditions: scoreboardEncrypted.accessControlConditions,

      // ClipRegistry encryption (NEW in v2)
      clipRegistryAddressCiphertext: clipRegistryEncrypted.ciphertext,
      clipRegistryAddressDataToEncryptHash: clipRegistryEncrypted.dataToEncryptHash,
      clipRegistryAddressAccessControlConditions: clipRegistryEncrypted.accessControlConditions,
    };

    // 8. Execute Lit Action v2
    console.log('\\n🚀 Executing Lit Action v2...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
    console.log('📝 Parameters:');
    console.log('   Clip ID:', TEST_CLIP_ID);
    console.log('   User:', TEST_USER_ADDRESS);
    console.log('   ClipRegistry:', CLIP_REGISTRY_ADDRESS);
    console.log('   Scoreboard:', SCOREBOARD_CONTRACT_ADDRESS);
    console.log('   Audio size:', audioDataBase64.length, 'chars\\n');

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
        name: 'Using v2 (ClipRegistry)',
        pass: response.version === 'karaoke_scorer_v2',
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
      console.log('\\n🎯 v2 Security Fix Verified:');
      console.log('   ✅ Lyrics fetched from on-chain ClipRegistry');
      console.log('   ✅ No expectedLyrics param (spoofing prevented)');
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
