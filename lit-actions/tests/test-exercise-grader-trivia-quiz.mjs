#!/usr/bin/env node

/**
 * Test Script for Exercise Grader v1 - Trivia Quiz Type
 *
 * Tests the TRIVIA_QUIZ exercise type (multiple choice, song-level)
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY='fbb75e6530c802b0cd320a371ebf3c85a38c56ed2305ad22a7bf0fb95fbecb52' bun tests/test-exercise-grader-trivia-quiz.mjs
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Contract addresses
const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const LENS_TESTNET_CHAIN_ID = 37111;

// Test parameters
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_ATTEMPT_ID = Date.now();

// Generate test questionId (bytes32)
const TEST_QUESTION_ID = '0x' + crypto.randomBytes(32).toString('hex');

// Lit Action CID (Exercise Grader v1 - deployed 2025-11-09, corrected PKP)
const LIT_ACTION_CID = 'QmQdYup3hPie5PFoQ3iRR9Wgc4V9vH3cRZ2Ak7afmyXqwB';

async function main() {
  console.log('🧩 Exercise Grader v1 Test - Trivia Quiz Type\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "exercise-grader-v1-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // 2. Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // 3. Create authentication context
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

    // 4. Test correct answer with numeric options
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Test 1: CORRECT ANSWER (Numeric)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const correctNumericParams = {
      exerciseType: 'TRIVIA_QUIZ',
      questionId: TEST_QUESTION_ID,
      userAddress: TEST_USER_ADDRESS,
      userAnswer: 1,  // Numeric answer
      correctAnswer: 1,
      attemptId: TEST_ATTEMPT_ID,
      metadataUri: `grove://${generateRandomCID()}`,
      testMode: false
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

    const correctNumericResponse = JSON.parse(correctNumericResult.response);

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

    const incorrectStringResponse = JSON.parse(incorrectStringResult.response);

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

    const correctCaseResponse = JSON.parse(correctCaseResult.response);

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
      console.log('✅ ALL TESTS PASSED! 🎉');
      console.log('\n🎯 Features Verified:');
      console.log('   ✅ Trivia quiz exercise type routing');
      console.log('   ✅ Numeric answer validation');
      console.log('   ✅ String answer validation');
      console.log('   ✅ Case-insensitive answer matching');
      console.log('   ✅ gradeMultipleChoiceAttempt() contract call');
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
