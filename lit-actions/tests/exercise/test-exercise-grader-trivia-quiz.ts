#!/usr/bin/env bun

/**
 * Test Script for Exercise Grader v1 - Trivia Quiz Type
 *
 * Tests the TRIVIA_QUIZ exercise type (multiple choice, song-level)
 *
 * Usage:
 *   LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-trivia-quiz.ts
 *   LIT_NETWORK=naga-test bun tests/exercise/test-exercise-grader-trivia-quiz.ts
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

// Test parameters
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_ATTEMPT_ID = Date.now();
const TEST_QUESTION_ID = '0x' + crypto.randomBytes(32).toString('hex');

function generateRandomCID(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

async function main() {
  console.log('🧩 Exercise Grader v1 Test - Trivia Quiz Type\n');
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
        storagePath: Env.getAuthStoragePath('exercise-trivia-quiz')
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

    // 4. Test correct answer with numeric options
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test 1: CORRECT ANSWER (Numeric)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const correctNumericParams = {
      exerciseType: 'TRIVIA_QUIZ',
      questionId: TEST_QUESTION_ID,
      userAddress: TEST_USER_ADDRESS,
      userAnswer: 1,
      correctAnswer: 1,
      attemptId: TEST_ATTEMPT_ID,
      metadataUri: `grove://${generateRandomCID()}`,
      testMode: false  // Always run real flow
    };

    console.log('📝 Parameters:');
    console.log('   Exercise Type:', correctNumericParams.exerciseType);
    console.log('   Question ID:', TEST_QUESTION_ID);
    console.log('   User Answer:', correctNumericParams.userAnswer);
    console.log('   Correct Answer:', correctNumericParams.correctAnswer);
    console.log('   Expected Score: 100');

    const correctNumericResult = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: correctNumericParams,
    });

    const correctNumericResponse = JSON.parse(correctNumericResult.response as string);

    console.log('\n📊 RESULTS:');
    console.log('   Success:', correctNumericResponse.success);
    console.log('   Score:', correctNumericResponse.score, '/ 100');
    console.log('   Rating:', correctNumericResponse.rating);
    console.log('   Is Correct:', correctNumericResponse.isCorrect);
    if (correctNumericResponse.txHash) {
      console.log('   TX Hash:', correctNumericResponse.txHash);
    }

    // 5. Test incorrect answer with string options
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test 2: INCORRECT ANSWER (String)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const incorrectStringParams = {
      exerciseType: 'TRIVIA_QUIZ',
      questionId: TEST_QUESTION_ID,
      userAddress: TEST_USER_ADDRESS,
      userAnswer: '1985',
      correctAnswer: '1990',
      attemptId: TEST_ATTEMPT_ID + 1,
      metadataUri: `grove://${generateRandomCID()}`,
      testMode: false
    };

    console.log('📝 Parameters:');
    console.log('   Exercise Type:', incorrectStringParams.exerciseType);
    console.log('   Question ID:', TEST_QUESTION_ID);
    console.log('   User Answer:', incorrectStringParams.userAnswer);
    console.log('   Correct Answer:', incorrectStringParams.correctAnswer);
    console.log('   Expected Score: 0');

    const incorrectStringResult = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: incorrectStringParams,
    });

    const incorrectStringResponse = JSON.parse(incorrectStringResult.response as string);

    console.log('\n📊 RESULTS:');
    console.log('   Success:', incorrectStringResponse.success);
    console.log('   Score:', incorrectStringResponse.score, '/ 100');
    console.log('   Rating:', incorrectStringResponse.rating);
    console.log('   Is Correct:', incorrectStringResponse.isCorrect);
    if (incorrectStringResponse.txHash) {
      console.log('   TX Hash:', incorrectStringResponse.txHash);
    }

    // 6. Test correct answer with string options (case insensitive)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test 3: CORRECT ANSWER (Case Insensitive)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const correctCaseParams = {
      exerciseType: 'TRIVIA_QUIZ',
      questionId: TEST_QUESTION_ID,
      userAddress: TEST_USER_ADDRESS,
      userAnswer: 'taylor swift',
      correctAnswer: 'Taylor Swift',
      attemptId: TEST_ATTEMPT_ID + 2,
      metadataUri: `grove://${generateRandomCID()}`,
      testMode: false
    };

    console.log('📝 Parameters:');
    console.log('   Exercise Type:', correctCaseParams.exerciseType);
    console.log('   Question ID:', TEST_QUESTION_ID);
    console.log('   User Answer:', correctCaseParams.userAnswer);
    console.log('   Correct Answer:', correctCaseParams.correctAnswer);
    console.log('   Expected Score: 100 (normalized)');

    const correctCaseResult = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: correctCaseParams,
    });

    const correctCaseResponse = JSON.parse(correctCaseResult.response as string);

    console.log('\n📊 RESULTS:');
    console.log('   Success:', correctCaseResponse.success);
    console.log('   Score:', correctCaseResponse.score, '/ 100');
    console.log('   Rating:', correctCaseResponse.rating);
    console.log('   Is Correct:', correctCaseResponse.isCorrect);
    if (correctCaseResponse.txHash) {
      console.log('   TX Hash:', correctCaseResponse.txHash);
    }

    // 7. Test assertions
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test Assertions:\n');

    const assertions = [
      {
        name: 'Correct numeric answer - Success',
        pass: correctNumericResponse.success === true,
        actual: correctNumericResponse.success
      },
      {
        name: 'Correct numeric answer - Score is 100',
        pass: correctNumericResponse.score === 100,
        actual: correctNumericResponse.score
      },
      {
        name: 'Correct numeric answer - Is correct',
        pass: correctNumericResponse.isCorrect === true,
        actual: correctNumericResponse.isCorrect
      },
      {
        name: 'Incorrect string answer - Success',
        pass: incorrectStringResponse.success === true,
        actual: incorrectStringResponse.success
      },
      {
        name: 'Incorrect string answer - Score is 0',
        pass: incorrectStringResponse.score === 0,
        actual: incorrectStringResponse.score
      },
      {
        name: 'Incorrect string answer - Is incorrect',
        pass: incorrectStringResponse.isCorrect === false,
        actual: incorrectStringResponse.isCorrect
      },
      {
        name: 'Case insensitive matching - Success',
        pass: correctCaseResponse.success === true,
        actual: correctCaseResponse.success
      },
      {
        name: 'Case insensitive matching - Score is 100',
        pass: correctCaseResponse.score === 100,
        actual: correctCaseResponse.score
      },
      {
        name: 'Case insensitive matching - Is correct',
        pass: correctCaseResponse.isCorrect === true,
        actual: correctCaseResponse.isCorrect
      },
      {
        name: 'Version correct (all)',
        pass: correctNumericResponse.version === 'exercise-grader-v1' &&
              incorrectStringResponse.version === 'exercise-grader-v1' &&
              correctCaseResponse.version === 'exercise-grader-v1',
        actual: `${correctNumericResponse.version}`
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
      console.log('   - Trivia quiz exercise type routing');
      console.log('   - Numeric answer validation');
      console.log('   - String answer validation');
      console.log('   - Case-insensitive answer matching');
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
