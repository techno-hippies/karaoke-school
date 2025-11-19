#!/usr/bin/env node

/**
 * Test Script for Exercise Grader v1 - Say It Back Type
 *
 * Tests the SAY_IT_BACK exercise type with embedded encrypted Voxtral API key
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY='fbb75e6530c802b0cd320a371ebf3c85a38c56ed2305ad22a7bf0fb95fbecb52' bun tests/test-exercise-grader-say-it-back.mjs
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Contract addresses
const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const LENS_TESTNET_CHAIN_ID = 37111;

// Test parameters
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_SEGMENT_HASH = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
const TEST_ATTEMPT_ID = Date.now();
const TEST_LANGUAGE = "en";

// Lit Action CID (Exercise Grader v1 - nagaTest, uploaded 2025-11-16, updated PKP)
const LIT_ACTION_CID = 'QmSA96awmjMEaTgRL91DhVv4JLReRaPEguZ1Mw93hJTexa';

async function loadTestAudio() {
  console.log('🎵 Loading test audio...');
  const audioPath = join(__dirname, 'hey-im-scarlett-how-are-you-doing.wav');
  const audioBuffer = await readFile(audioPath);
  const audioDataBase64 = audioBuffer.toString('base64');
  console.log(`✅ Audio loaded: ${Math.round(audioBuffer.length / 1024)} KB (${audioDataBase64.length} base64 chars)`);
  return audioDataBase64;
}

async function loadVoxtralEncryptedKey() {
  console.log('🔐 Loading encrypted Voxtral API key...');
  const keyPath = join(__dirname, '../keys/voxtral_api_key_exercise.json');
  const keyData = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log(`✅ Encrypted key loaded (CID: ${keyData.cid})`);
  return keyData;
}

async function main() {
  console.log('🎤 Exercise Grader v1 Test - Say It Back Type\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Load test audio and encrypted key
    const audioDataBase64 = await loadTestAudio();
    const voxtralEncryptedKey = await loadVoxtralEncryptedKey();

    // 2. Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "exercise-grader-v1-test",
        networkName: "naga-test",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // 3. Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaTest });
    console.log('✅ Connected to Lit Network (nagaTest)');

    // 4. Create authentication context
    console.log('\n🔐 Creating authentication context...');

    // Use a test private key (not for signing transactions, just for Lit auth)
    const testPrivateKey = '0x' + '0'.repeat(63) + '1'; // Minimal test key
    const viemAccount = privateKeyToAccount(testPrivateKey);

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

    // 5. Prepare jsParams for SAY_IT_BACK exercise type
    const jsParams = {
      exerciseType: 'SAY_IT_BACK',
      audioDataBase64,
      userAddress: TEST_USER_ADDRESS,
      segmentHash: TEST_SEGMENT_HASH,
      attemptId: TEST_ATTEMPT_ID,
      metadataUri: `grove://${generateRandomCID()}`,
      expectedText: "Hey I'm Scarlett, how are you doing?",
      language: TEST_LANGUAGE,
      voxtralEncryptedKey,  // Pass encrypted key from keys/voxtral_api_key_exercise.json
      lineId: '0x64befe066b9b4a39813f96144552a1de00000000000000000000000000000000',  // Real lineId from DB (UUID 64befe06-6b9b-4a39-813f-96144552a1de zero-padded to bytes32)
      lineIndex: 8,  // Corresponding lineIndex from DB
      testMode: false,  // Attempt full flow (decryption + transcription + contract)
    };

    // 6. Execute Lit Action
    console.log('\n🚀 Executing Exercise Grader v1 (Say It Back)...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Parameters:');
    console.log('   Exercise Type:', jsParams.exerciseType);
    console.log('   User:', TEST_USER_ADDRESS);
    console.log('   Segment Hash:', TEST_SEGMENT_HASH);
    console.log('   Attempt ID:', TEST_ATTEMPT_ID);
    console.log('   Language:', TEST_LANGUAGE);
    console.log('   Audio Size:', Math.round(Buffer.from(audioDataBase64, 'base64').length / 1024), 'KB');
    console.log('   Expected Text:', jsParams.expectedText);
    console.log('   ExerciseEvents:', EXERCISE_EVENTS_ADDRESS);
    console.log('   Chain:', `Lens Testnet (${LENS_TESTNET_CHAIN_ID})`);
    console.log('   CID:', LIT_ACTION_CID);
    console.log('   Encrypted Key CID:', voxtralEncryptedKey.cid);
    console.log('\n🔐 Encrypted Voxtral key passed as jsParam\n');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
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
      console.log('Length:', response.transcript.length, 'characters');
    } else {
      console.log('❌ No transcript returned');
    }

    console.log('\n--- Score Submission ---');
    if (response.txHash) {
      console.log('✅ Score submitted to ExerciseEvents!');
      console.log('TX Hash:', response.txHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
    } else {
      console.log('⚠️  Score transaction not submitted');
      if (response.errorType) {
        console.log('   Reason:', response.errorType);
      }
    }

    if (response.errorType) {
      console.log('\n--- Error ---');
      console.log('Error:', response.errorType);
    }

    console.log('\n--- Timing ---');
    console.log('Execution Time:', response.executionTime, 'ms');

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
        name: 'No errors',
        pass: !response.errorType,
        actual: response.errorType || 'none'
      },
      {
        name: 'Version correct',
        pass: response.version === 'exercise-grader-v1',
        actual: response.version
      },
      {
        name: 'Rating returned',
        pass: response.rating && ['Easy', 'Good', 'Hard', 'Again'].includes(response.rating),
        actual: response.rating || 'none'
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
      console.log('\n🎯 Features Verified:');
      console.log('   ✅ Say It Back exercise type routing');
      console.log('   ✅ Embedded encrypted key decryption working');
      console.log('   ✅ Voxtral STT transcription working');
      console.log('   ✅ Score calculation working');
      console.log('   ✅ gradeSayItBackAttempt() contract call');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

function generateRandomCID() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

main();
