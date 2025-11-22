#!/usr/bin/env bun

/**
 * Test Script for Exercise Grader v1 - Say It Back Type
 *
 * Tests the SAY_IT_BACK exercise type with embedded encrypted Voxtral API key
 *
 * Usage:
 *   LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-say-it-back.ts
 *   LIT_NETWORK=naga-test bun tests/exercise/test-exercise-grader-say-it-back.ts
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Env } from '../shared/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIT_ACTION_CID = Env.cids.exercise;
const USER_MAX_PRICE = process.env.LIT_USER_MAX_PRICE
  ? BigInt(process.env.LIT_USER_MAX_PRICE)
  : 200_000_000_000_000_000n;

// TEST_MODE defaults to FALSE - always run real flow
const TEST_MODE = process.env.EXERCISE_TEST_MODE === 'true';
const USE_LOCAL_CODE = ['true', '1'].includes((process.env.EXERCISE_USE_LOCAL_CODE || '').toLowerCase());
const TX_DEBUG_STAGE = process.env.TX_DEBUG_STAGE;
const RPC_URL_OVERRIDE = process.env.RPC_URL_OVERRIDE;

// Contract addresses
const EXERCISE_EVENTS_ADDRESS = (Env.contracts as any).EXERCISE_EVENTS_ADDRESS || '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const LENS_TESTNET_CHAIN_ID = 37111;

// Test parameters
const TEST_USER_ADDRESS = Env.isTest && process.env.PAYER_PRIVATE_KEY
  ? privateKeyToAccount(
      (process.env.PAYER_PRIVATE_KEY.startsWith('0x')
        ? process.env.PAYER_PRIVATE_KEY
        : `0x${process.env.PAYER_PRIVATE_KEY}`) as `0x${string}`
    ).address
  : `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_SEGMENT_HASH = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
const TEST_ATTEMPT_ID = Date.now();
const TEST_LANGUAGE = "en";

async function loadTestAudio(): Promise<string> {
  console.log('🎵 Loading test audio...');
  const audioPath = join(__dirname, '../fixtures/hey-im-scarlett-how-are-you-doing.wav');
  const audioBuffer = await readFile(audioPath);
  const audioDataBase64 = audioBuffer.toString('base64');
  console.log(`✅ Audio loaded: ${Math.round(audioBuffer.length / 1024)} KB (${audioDataBase64.length} base64 chars)`);
  return audioDataBase64;
}

async function loadVoxtralEncryptedKey() {
  console.log('🔐 Loading encrypted Voxtral API key...');
  const keyData = Env.loadKey('exercise', 'voxtral_api_key');
  console.log(`📁 Using key path: ${Env.getKeyPath('exercise', 'voxtral_api_key')}`);
  console.log(`✅ Encrypted key loaded (CID: ${keyData.cid})`);
  return keyData;
}

function generateRandomCID(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

async function main() {
  console.log('🎤 Exercise Grader v1 Test - Say It Back Type\n');
  console.log('Network:', Env.name, Env.isTest ? '(payments enforced)' : '(free)');
  console.log('Test mode:', TEST_MODE ? 'ON (no tx)' : 'OFF (real contract submission)');
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
        networkName: Env.name,
        storagePath: Env.getAuthStoragePath('exercise-grader')
      }),
    });
    console.log('✅ Auth Manager created');

    // 3. Connect to Lit
    console.log(`\n🔌 Connecting to Lit Protocol (${Env.name})...`);
    const litClient = await createLitClient({ network: Env.litNetwork });
    console.log(`✅ Connected to Lit Network (${Env.name})`);

    // 4. Create authentication context
    console.log('\n🔐 Creating authentication context...');

    const payerPrivateKey = (
      process.env.PAYER_PRIVATE_KEY ||
      process.env.PRIVATE_KEY ||
      ('0x' + '0'.repeat(63) + '1')
    ) as `0x${string}`;
    const viemAccount = privateKeyToAccount(payerPrivateKey);
    console.log('💳 Payer address:', viemAccount.address, Env.isTest ? '(needs tstLPX/delegation)' : '(free on naga-dev)');

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
      voxtralEncryptedKey,
      lineId: '0x64befe066b9b4a39813f96144552a1de00000000000000000000000000000000',
      lineIndex: 8,
      testMode: TEST_MODE,
      txDebugStage: TX_DEBUG_STAGE || undefined,
      rpcUrlOverride: RPC_URL_OVERRIDE || undefined,
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

    const execParams: any = USE_LOCAL_CODE
      ? {
          code: await readFile(join(__dirname, '../../actions/exercise-grader-v1.js'), 'utf-8'),
          authContext: authContext,
          jsParams: jsParams,
        }
      : {
          ipfsId: LIT_ACTION_CID,
          authContext: authContext,
          jsParams: jsParams,
        };

    if (USE_LOCAL_CODE) {
      console.log('🧪 Using local action code (bypassing IPFS CID)');
    }

    if (process.env.LIT_USER_MAX_PRICE) {
      execParams.userMaxPrice = USER_MAX_PRICE;
    }

    const result = await litClient.executeJs(execParams);

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // 7. Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response as string);

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

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
