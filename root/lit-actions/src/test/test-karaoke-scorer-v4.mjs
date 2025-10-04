#!/usr/bin/env node

/**
 * Test Script for Karaoke Scorer v4 Lit Action
 *
 * Tests scoring karaoke segments with new architecture:
 * - SongCatalogV1 for lyrics/metadata
 * - KaraokeScoreboardV4 for score submission
 * - Voxstral STT API for transcription
 *
 * Flow:
 * 1. Load test audio file (MP3)
 * 2. Convert to base64
 * 3. Decrypt Voxstral API key
 * 4. Call karaoke-scorer-v4.js Lit Action
 * 5. Lit Action transcribes audio, scores it, submits to contract
 * 6. Verify score submission transaction
 *
 * Usage:
 *   bun run test:karaoke-scorer-v4
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
const PKP_CREDS_PATH = '/media/t42/th42/Code/site/root/lit-actions/output/pkp-credentials.json';

// Test audio file
const TEST_AUDIO_PATH = '/media/t42/th42/Code/site/root/lit-actions/text-fixtures/audio/verse-1.mp3';

// Contract addresses
const SONG_CATALOG_ADDRESS = '0x88996135809cc745E6d8966e3a7A01389C774910';
const SCOREBOARD_ADDRESS = '0x8301E4bbe0C244870a4BC44ccF0241A908293d36';

// Test parameters
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`; // Random address for each test
const TEST_SONG_ID = "heat-of-the-night-scarlett-x";
const TEST_SEGMENT_ID = "verse-1";
const TEST_LANGUAGE = "en";

// Karaoke Scorer v4 CID (Personal Sign - Fixed v,r,s fields)
const KARAOKE_SCORER_V4_CID = 'QmPdjBg94YCt8wjKst1iESHuDrjCuN59MQLeNXrXdJ2kV8';

// Voxstral API key encryption CID (must match Lit Action CID)
const VOXSTRAL_KEY_CID = 'QmPdjBg94YCt8wjKst1iESHuDrjCuN59MQLeNXrXdJ2kV8';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadTestAudio() {
  console.log(`🎵 Loading test audio: ${TEST_AUDIO_PATH}`);
  const audioBuffer = await readFile(TEST_AUDIO_PATH);
  const audioBase64 = audioBuffer.toString('base64');
  console.log(`✅ Audio loaded: ${audioBuffer.length} bytes (${Math.round(audioBuffer.length / 1024)}KB)`);
  console.log(`   Base64 length: ${audioBase64.length} characters`);
  return audioBase64;
}

async function loadVoxstralKeyEncryption() {
  console.log('🔐 Loading Voxstral API key encryption...');
  const keyPath = '/media/t42/th42/Code/site/root/lit-actions/src/stt/keys/voxstral_api_key.json';
  const keyData = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log('✅ Voxstral key encryption loaded');
  console.log(`   CID: ${keyData.cid || VOXSTRAL_KEY_CID}`);
  return keyData;
}

async function main() {
  console.log('🎤 Karaoke Scorer v4 Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Load test data
    const pkpCreds = await loadPKPCredentials();
    const audioDataBase64 = await loadTestAudio();
    const voxstralKeyData = await loadVoxstralKeyEncryption();

    // 2. Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "karaoke-scorer-v4-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // 3. Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // 4. Create authentication context
    console.log('\n🔐 Creating authentication context...');
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

    // 5. Prepare jsParams
    const jsParams = {
      audioDataBase64,
      userAddress: TEST_USER_ADDRESS,
      songId: TEST_SONG_ID,
      segmentId: TEST_SEGMENT_ID,
      language: TEST_LANGUAGE,
      pkpPublicKey: pkpCreds.publicKey || pkpCreds.ethAddress,

      // Voxstral API key encryption params
      accessControlConditions: voxstralKeyData.accessControlConditions,
      ciphertext: voxstralKeyData.ciphertext,
      dataToEncryptHash: voxstralKeyData.dataToEncryptHash,
    };

    // 6. Execute Lit Action v4
    console.log('\n🚀 Executing Karaoke Scorer v4...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Parameters:');
    console.log('   User:', TEST_USER_ADDRESS);
    console.log('   Song ID:', TEST_SONG_ID);
    console.log('   Segment ID:', TEST_SEGMENT_ID);
    console.log('   Language:', TEST_LANGUAGE);
    console.log('   Audio Size:', Math.round(Buffer.from(audioDataBase64, 'base64').length / 1024), 'KB');
    console.log('   SongCatalog:', SONG_CATALOG_ADDRESS);
    console.log('   Scoreboard:', SCOREBOARD_ADDRESS);
    console.log('   Chain:', 'Lens Testnet (37111)\n');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: KARAOKE_SCORER_V4_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // 7. Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    console.log('✅ Success:', response.success);
    console.log('📝 Version:', response.version);
    console.log('🎯 Score:', response.score, '/ 100');

    console.log('\n--- Transcription ---');
    if (response.transcript) {
      console.log('Text:', response.transcript);
      console.log('Length:', response.transcriptionLength, 'characters');
      console.log('Language:', response.detectedLanguage || TEST_LANGUAGE);
    } else {
      console.log('❌ No transcript returned');
    }

    console.log('\n--- Score Submission ---');
    if (response.txHash) {
      console.log('✅ Score submitted to blockchain!');
      console.log('TX Hash:', response.txHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
      console.log('Contract:', SCOREBOARD_ADDRESS);
      console.log('Function:', 'updateScore(uint8,string,string,address,uint96)');
    } else {
      console.log('❌ Score transaction failed or not submitted');
    }

    if (response.errorType) {
      console.log('\n--- Error ---');
      console.log('Error:', response.errorType);
    }

    console.log('\n--- Timing ---');
    console.log('Execution Time:', response.executionTime, 'ms');
    console.log('Timestamp:', response.timestamp);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 8. Test assertions
    console.log('\n🧪 Test Assertions:\n');

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
        pass: !response.errorType,
        actual: response.errorType || 'none'
      },
      {
        name: 'Using v4',
        pass: response.version === 'v4',
        actual: response.version
      },
      {
        name: 'Execution time reasonable (<60s)',
        pass: response.executionTime < 60000,
        actual: `${response.executionTime}ms`
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

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED! 🎉');
      console.log('\n🎯 v4 Features Verified:');
      console.log('   ✅ SongCatalogV1 integration working');
      console.log('   ✅ Segment lyrics fetched from Grove');
      console.log('   ✅ Voxstral STT transcription working');
      console.log('   ✅ Score calculation working');
      console.log('   ✅ KaraokeScoreboardV4 submission working');
      console.log('   ✅ PKP signing successful');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Next Steps:');
    console.log('1. Verify score on-chain using cast:');
    console.log(`   cast call ${SCOREBOARD_ADDRESS} "getSegmentScore(uint8,string,address)" 0 "${TEST_SEGMENT_ID}" ${TEST_USER_ADDRESS} --rpc-url https://rpc.testnet.lens.xyz`);
    console.log('2. Check segment leaderboard:');
    console.log(`   cast call ${SCOREBOARD_ADDRESS} "getTopSegmentScorers(uint8,string)" 0 "${TEST_SEGMENT_ID}" --rpc-url https://rpc.testnet.lens.xyz`);
    console.log('\n');

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
