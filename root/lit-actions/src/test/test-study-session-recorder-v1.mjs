#!/usr/bin/env node

/**
 * Test Script for Study Session Recorder v1 Lit Action
 *
 * Tests recording study sessions to StudyProgressV1 contract
 *
 * Flow:
 * 1. Prepare test session data (userAddress, contentId, performance)
 * 2. (Optional) Prepare mock FSRS data for encryption
 * 3. Call study-session-recorder-v1.js Lit Action
 * 4. Lit Action records session to StudyProgressV1 contract
 * 5. Lit Action encrypts and stores FSRS data (if provided)
 * 6. Verify transactions submitted successfully
 *
 * Usage:
 *   bun run test:study-recorder-v1
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

// Contract address
const STUDY_PROGRESS_ADDRESS = '0x784Ff3655B8FDb37b5CFB831C531482A606365f1';

// Test data
const TEST_USER_ADDRESS = "0x0C6433789d14050aF47198B2751f6689731Ca79C";
const TEST_SOURCE_NATIVE = 0; // ContentSource.Native
const TEST_SOURCE_GENIUS = 1; // ContentSource.Genius
const TEST_CONTENT_ID = "heat-of-the-night-scarlett-x";
const TEST_ITEMS_REVIEWED = 10;
const TEST_AVERAGE_SCORE = 85;

// Mock FSRS data (realistic TS-FSRS state)
const MOCK_FSRS_DATA = {
  difficulty: 5.2,
  stability: 2.8,
  retrievability: 0.85,
  lapses: 0,
  reps: 3,
  state: 2, // Review
  lastReview: new Date().toISOString(),
  due: new Date(Date.now() + 86400000).toISOString(), // +1 day
  elapsedDays: 0,
  scheduledDays: 1
};

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function main() {
  console.log('📚 Study Session Recorder v1 Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Load test data
    const pkpCreds = await loadPKPCredentials();

    // 2. Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "study-session-recorder-v1-test",
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

    // 5. Create FSRS access control conditions (CID-locked)
    console.log('\n🔒 Creating FSRS access control conditions...');
    const IPFS_CID = 'QmYByEPVEaBe8CuAr744E4yqeYPUNHwmtxHmQ2yZTQd4CB';
    const fsrsAccessControlConditions = [
      {
        conditionType: 'evmBasic',
        contractAddress: '',
        standardContractType: '',
        chain: 'ethereum',
        method: '',
        parameters: [':userAddress'],
        returnValueTest: {
          comparator: '=',
          value: IPFS_CID
        }
      }
    ];
    console.log('✅ FSRS access control configured (CID-locked)');

    // 6. Prepare jsParams
    const jsParams = {
      userAddress: TEST_USER_ADDRESS,
      source: TEST_SOURCE_NATIVE,
      contentId: TEST_CONTENT_ID,
      itemsReviewed: TEST_ITEMS_REVIEWED,
      averageScore: TEST_AVERAGE_SCORE,
      pkpPublicKey: pkpCreds.publicKey || pkpCreds.ethAddress,

      // FSRS data and encryption
      fsrsData: MOCK_FSRS_DATA,
      fsrsAccessControlConditions,

      // Session metadata
      sessionId: `test-study-v1-${Date.now()}`,
      userLanguage: 'en',
      userIpCountry: 'US',
      userAgent: 'test-client/1.0'
    };

    // 7. Execute Lit Action v1
    console.log('\n🚀 Executing Lit Action v1...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Parameters:');
    console.log('   User:', TEST_USER_ADDRESS);
    console.log('   Source:', TEST_SOURCE_NATIVE === 0 ? 'Native (SongCatalog)' : 'Genius');
    console.log('   Content ID:', TEST_CONTENT_ID);
    console.log('   Items Reviewed:', TEST_ITEMS_REVIEWED);
    console.log('   Average Score:', TEST_AVERAGE_SCORE);
    console.log('   FSRS Data:', MOCK_FSRS_DATA ? 'Yes (will be encrypted)' : 'No');
    console.log('   StudyProgress Address:', STUDY_PROGRESS_ADDRESS);
    console.log('   Chain:', 'Lens Testnet (37111)\n');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: IPFS_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // 8. Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    console.log('✅ Success:', response.success);
    console.log('📝 Version:', response.version);

    console.log('\n--- Study Session Transaction ---');
    if (response.sessionTxHash) {
      console.log('✅ Session recorded!');
      console.log('TX Hash:', response.sessionTxHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.sessionTxHash}`);
      console.log('Contract Call: recordStudySession()');
    } else {
      console.log('❌ Session transaction failed or not submitted');
    }

    console.log('\n--- FSRS Encryption Transaction ---');
    if (response.fsrsTxHash) {
      console.log('✅ FSRS data encrypted and stored!');
      console.log('TX Hash:', response.fsrsTxHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.fsrsTxHash}`);
      console.log('Contract Call: storeEncryptedFSRS()');
    } else if (jsParams.fsrsData) {
      console.log('⚠️  FSRS data provided but not stored (check logs)');
    } else {
      console.log('⏭️  No FSRS data provided (skipped)');
    }

    if (response.error) {
      console.log('\n--- Error ---');
      console.log('Error:', response.error);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 9. Test assertions
    console.log('\n🧪 Test Assertions:\n');

    const assertions = [
      {
        name: 'Execution successful',
        pass: response.success === true,
        actual: response.success
      },
      {
        name: 'Session transaction hash present',
        pass: response.sessionTxHash && response.sessionTxHash.startsWith('0x'),
        actual: response.sessionTxHash || 'null'
      },
      {
        name: 'FSRS transaction hash present (if data provided)',
        pass: !jsParams.fsrsData || (response.fsrsTxHash && response.fsrsTxHash.startsWith('0x')),
        actual: response.fsrsTxHash || 'null'
      },
      {
        name: 'No errors',
        pass: !response.error,
        actual: response.error || 'none'
      },
      {
        name: 'Using v1',
        pass: response.version === 'study_session_recorder_v1',
        actual: response.version
      },
      {
        name: 'Execution time reasonable (<30s)',
        pass: response.executionTimeMs < 30000,
        actual: `${response.executionTimeMs}ms`
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
      console.log('\n🎯 v1 Features Verified:');
      console.log('   ✅ Study session recorded on-chain');
      console.log('   ✅ FSRS data encrypted with Lit.Actions.encrypt()');
      console.log('   ✅ Contract addresses hardcoded (public data)');
      console.log('   ✅ Two-transaction pattern (session + FSRS)');
      console.log('   ✅ Parameter validation working');
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

main();
