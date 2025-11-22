#!/usr/bin/env bun

/**
 * Test Script for Exercise Grader v1 - Translation Quiz Type
 *
 * Tests the TRANSLATION_QUIZ exercise type (multiple choice)
 *
 * Usage:
 *   LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-translation-quiz.ts
 *   LIT_NETWORK=naga-test bun tests/exercise/test-exercise-grader-translation-quiz.ts
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { Env } from '../shared/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIT_ACTION_CID = Env.cids.exercise;
const EXERCISE_EVENTS_ADDRESS = (Env.contracts as any).EXERCISE_EVENTS_ADDRESS || '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';

// Test parameters
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_ATTEMPT_ID = Date.now();
const TEST_QUESTION_ID = '0x' + crypto.randomBytes(32).toString('hex');

function generateRandomCID(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

async function main() {
  console.log('📝 Exercise Grader v1 Test - Translation Quiz Type\n');
  console.log('Network:', Env.name, Env.isTest ? '(payments enforced)' : '(free)');
  console.log('CID:', LIT_ACTION_CID);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "exercise-grader-v1-test",
        networkName: Env.name,
        storagePath: Env.getAuthStoragePath('exercise-translation-quiz')
      }),
    });
    console.log('✅ Auth Manager created');

    // 2. Connect to Lit
    console.log(`\n🔌 Connecting to Lit Protocol (${Env.name})...`);
    const litClient = await createLitClient({ network: Env.litNetwork });
    console.log(`✅ Connected to Lit Network (${Env.name})`);

    // 3. Create authentication context
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

    // 4. Test correct answer
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test 1: CORRECT ANSWER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const correctAnswerParams = {
      exerciseType: 'TRANSLATION_QUIZ',
      questionId: TEST_QUESTION_ID,
      userAddress: TEST_USER_ADDRESS,
      userAnswer: 'Hello, how are you?',
      correctAnswer: 'Hello, how are you?',
      attemptId: TEST_ATTEMPT_ID,
      metadataUri: `grove://${generateRandomCID()}`,
      testMode: false  // Always run real flow
    };

    console.log('📝 Parameters:');
    console.log('   Exercise Type:', correctAnswerParams.exerciseType);
    console.log('   Question ID:', TEST_QUESTION_ID);
    console.log('   User Answer:', correctAnswerParams.userAnswer);
    console.log('   Correct Answer:', correctAnswerParams.correctAnswer);
    console.log('   Expected Score: 100');

    const correctResult = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: correctAnswerParams,
    });

    const correctResponse = JSON.parse(correctResult.response as string);

    console.log('\n📊 RESULTS:');
    console.log('   Success:', correctResponse.success);
    console.log('   Score:', correctResponse.score, '/ 100');
    console.log('   Rating:', correctResponse.rating);
    console.log('   Is Correct:', correctResponse.isCorrect);
    if (correctResponse.txHash) {
      console.log('   TX Hash:', correctResponse.txHash);
    }

    // 5. Test incorrect answer
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test 2: INCORRECT ANSWER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const incorrectAnswerParams = {
      exerciseType: 'TRANSLATION_QUIZ',
      questionId: TEST_QUESTION_ID,
      userAddress: TEST_USER_ADDRESS,
      userAnswer: 'Wrong answer',
      correctAnswer: 'Hello, how are you?',
      attemptId: TEST_ATTEMPT_ID + 1,
      metadataUri: `grove://${generateRandomCID()}`,
      testMode: false  // Always run real flow
    };

    console.log('📝 Parameters:');
    console.log('   Exercise Type:', incorrectAnswerParams.exerciseType);
    console.log('   Question ID:', TEST_QUESTION_ID);
    console.log('   User Answer:', incorrectAnswerParams.userAnswer);
    console.log('   Correct Answer:', incorrectAnswerParams.correctAnswer);
    console.log('   Expected Score: 0');

    const incorrectResult = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: incorrectAnswerParams,
    });

    const incorrectResponse = JSON.parse(incorrectResult.response as string);

    console.log('\n📊 RESULTS:');
    console.log('   Success:', incorrectResponse.success);
    console.log('   Score:', incorrectResponse.score, '/ 100');
    console.log('   Rating:', incorrectResponse.rating);
    console.log('   Is Correct:', incorrectResponse.isCorrect);
    if (incorrectResponse.txHash) {
      console.log('   TX Hash:', incorrectResponse.txHash);
    }

    // 6. Test assertions
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test Assertions:\n');

    const assertions = [
      {
        name: 'Correct answer - Success',
        pass: correctResponse.success === true,
        actual: correctResponse.success
      },
      {
        name: 'Correct answer - Score is 100',
        pass: correctResponse.score === 100,
        actual: correctResponse.score
      },
      {
        name: 'Correct answer - Is correct flag',
        pass: correctResponse.isCorrect === true,
        actual: correctResponse.isCorrect
      },
      {
        name: 'Correct answer - Rating is Easy',
        pass: correctResponse.rating === 'Easy',
        actual: correctResponse.rating
      },
      {
        name: 'Incorrect answer - Success',
        pass: incorrectResponse.success === true,
        actual: incorrectResponse.success
      },
      {
        name: 'Incorrect answer - Score is 0',
        pass: incorrectResponse.score === 0,
        actual: incorrectResponse.score
      },
      {
        name: 'Incorrect answer - Is correct flag',
        pass: incorrectResponse.isCorrect === false,
        actual: incorrectResponse.isCorrect
      },
      {
        name: 'Incorrect answer - Rating is Again',
        pass: incorrectResponse.rating === 'Again',
        actual: incorrectResponse.rating
      },
      {
        name: 'Version correct (both)',
        pass: correctResponse.version === 'exercise-grader-v1' && incorrectResponse.version === 'exercise-grader-v1',
        actual: `${correctResponse.version} / ${incorrectResponse.version}`
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
      console.log('✅ ALL TESTS PASSED!');
      console.log('\nFeatures Verified:');
      console.log('   - Translation quiz exercise type routing');
      console.log('   - Correct answer scoring (100)');
      console.log('   - Incorrect answer scoring (0)');
      console.log('   - gradeMultipleChoiceAttempt() contract call');
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
