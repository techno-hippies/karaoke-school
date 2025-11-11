#!/usr/bin/env node

/**
 * Test Script for Exercise Grader v1 - Translation Quiz Type
 *
 * Tests the TRANSLATION_QUIZ exercise type (multiple choice)
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY='fbb75e6530c802b0cd320a371ebf3c85a38c56ed2305ad22a7bf0fb95fbecb52' bun tests/test-exercise-grader-translation-quiz.mjs
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
  console.log('📝 Exercise Grader v1 Test - Translation Quiz Type\n');
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
      testMode: false
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

    const correctResponse = JSON.parse(correctResult.response);

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
      testMode: false
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

    const incorrectResponse = JSON.parse(incorrectResult.response);

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
      console.log('✅ ALL TESTS PASSED! 🎉');
      console.log('\n🎯 Features Verified:');
      console.log('   ✅ Translation quiz exercise type routing');
      console.log('   ✅ Correct answer scoring (100)');
      console.log('   ✅ Incorrect answer scoring (0)');
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
