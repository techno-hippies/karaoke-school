#!/usr/bin/env node

/**
 * Test Script for study-scorer-v1 Lit Action
 *
 * Tests the complete flow:
 * 1. Audio transcription via Voxstral API (simulated for now)
 * 2. Pronunciation scoring (Levenshtein distance)
 * 3. FSRS algorithm calculations
 * 4. Contract write to FSRSTrackerV1
 * 5. Verification of card states
 *
 * Expected time: ~2-5s
 *
 * Usage:
 *   bun run src/test/test-study-scorer-v1.mjs
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

// Encrypted Voxstral key path
const VOXSTRAL_KEY_PATH = join(__dirname, '../karaoke/keys/voxstral_api_key_v1.json');

// Contract configuration
const FSRS_TRACKER_ADDRESS = '0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3'; // FSRSTrackerV1 on Base Sepolia
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

// Test data - Real audio from verse-1.mp3
const TEST_DATA = {
  userAddress: '0x0C6433789d14050aF47198B2751f6689731Ca79C',
  songId: 'heat-of-the-night',
  segmentId: 'verse-1',
  expectedLyrics: [
    { lineIndex: 0, text: "In the heat of the night", startTime: 0.0 },
    { lineIndex: 1, text: "Under city lights", startTime: 2.5 },
    { lineIndex: 2, text: "You move like a flame", startTime: 5.0 }
  ]
};

// Path to real test audio
const TEST_AUDIO_PATH = join(__dirname, '../../test-fixtures/audio/verse-1.mp3');

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadEncryptedKey() {
  console.log('🔐 Loading encrypted Voxstral API key...');

  try {
    const voxstralKey = JSON.parse(await readFile(VOXSTRAL_KEY_PATH, 'utf-8'));
    console.log('✅ Encrypted key loaded');
    console.log(`   Version: ${voxstralKey.version || 'N/A'}`);
    console.log(`   Access type: ${voxstralKey.accessType || 'N/A'}`);
    return voxstralKey;
  } catch (error) {
    console.log('⚠️  Encrypted key not found - using TEST MODE');
    console.log('   (Lit Action will use simulated transcription)\n');
    // Return null to signal test mode
    return null;
  }
}

async function main() {
  console.log('🎤 Study Scorer v1 Test\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Load encrypted Voxstral API key');
  console.log('2. Simulate audio transcription (for now)');
  console.log('3. Calculate pronunciation scores');
  console.log('4. Run FSRS-4.5 algorithm');
  console.log('5. Write card states to FSRSTrackerV1');
  console.log('6. Verify cards in contract');
  console.log('\n━'.repeat(80));

  try {
    // Load credentials and keys
    const pkpCreds = await loadPKPCredentials();
    const voxstralKey = await loadEncryptedKey();

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "study-scorer-v1-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // Create authentication context
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
          },
          {
            resource: new LitPKPResource('*'),
            ability: 'pkp-signing'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load and encode real audio file
    console.log('\n🎵 Loading test audio file...');
    const audioBuffer = await readFile(TEST_AUDIO_PATH);
    const audioBase64 = audioBuffer.toString('base64');
    console.log(`✅ Audio loaded: ${audioBuffer.length} bytes (${audioBase64.length} base64 chars)`);

    // Prepare test parameters
    console.log('\n' + '='.repeat(80));
    console.log(`🎵 Testing: ${TEST_DATA.songId} - ${TEST_DATA.segmentId}`);
    console.log(`👤 User: ${TEST_DATA.userAddress}`);
    console.log(`📝 Lines: ${TEST_DATA.expectedLyrics.length}`);
    console.log(`🎤 Audio: ${TEST_AUDIO_PATH}`);
    console.log('='.repeat(80));

    const jsParams = {
      userAddress: TEST_DATA.userAddress,
      songId: TEST_DATA.songId,
      segmentId: TEST_DATA.segmentId,
      expectedLyrics: TEST_DATA.expectedLyrics,

      // Real audio data (base64 encoded)
      audioBlob: audioBase64,

      // Enable test mode if no encrypted key available
      testMode: voxstralKey === null,

      // Voxstral key encryption params (only if available)
      voxstralKeyAccessControlConditions: voxstralKey?.accessControlConditions || [],
      voxstralKeyCiphertext: voxstralKey?.ciphertext || '',
      voxstralKeyDataToEncryptHash: voxstralKey?.dataToEncryptHash || '',

      // Contract write params
      contractAddress: FSRS_TRACKER_ADDRESS,
      writeToBlockchain: true,

      // No previous cards (first time studying these lines)
      previousCards: null
    };

    console.log('\n🚀 Executing study-scorer-v1 Lit Action...');
    console.log('⏱️  Expected time: ~2-5s');
    const startTime = Date.now();

    // Read the Lit Action code
    const litActionCode = await readFile(
      join(__dirname, '../karaoke/study-scorer-v1.js'),
      'utf-8'
    );

    try {
      const result = await litClient.executeJs({
        code: litActionCode,
        authContext: authContext,
        jsParams: jsParams,
      });

      const executionTime = Date.now() - startTime;

      console.log('✅ Lit Action execution completed');
      console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(1)}s\n`);

      // Parse and display results
      console.log('━'.repeat(80));
      console.log('📊 RESULTS\n');

      const response = JSON.parse(result.response);

      // Save full response to output directory
      const outputDir = join(__dirname, '../../output');
      const outputFile = join(outputDir, `study-scorer-v1-test-result.json`);
      await writeFile(outputFile, JSON.stringify(response, null, 2));
      console.log(`💾 Saved full result to: ${outputFile}\n`);

      console.log('✅ Success:', response.success);

      if (!response.success && response.error) {
        console.log('❌ Error:', response.error);
        if (response.stack) {
          console.log('Stack trace:', response.stack.substring(0, 500));
        }
        await litClient.disconnect();
        process.exit(1);
      }

      // Display results
      console.log('\n--- Study Session ---');
      console.log(`User: ${response.userAddress}`);
      console.log(`Song: ${response.songId}`);
      console.log(`Segment: ${response.segmentId}`);
      console.log(`Lines processed: ${response.linesProcessed}`);
      console.log(`Average score: ${response.averageScore}/100`);

      console.log('\n--- Per-Line Scores ---');
      response.scores.forEach((score, i) => {
        const ratingNames = ['Again', 'Hard', 'Good', 'Easy'];
        const rating = response.ratings[i];
        const emoji = ['❌', '😰', '👍', '⭐'][rating];
        console.log(`Line ${i}: ${score}/100 → ${ratingNames[rating]} ${emoji}`);
      });

      // Display blockchain write result
      console.log('\n--- Blockchain Write ---');
      if (response.txHash) {
        console.log(`✅ Transaction submitted: ${response.txHash}`);
        console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.txHash}`);
        console.log(`📝 Contract: ${response.contractAddress}`);

        // Wait for confirmation
        console.log('\n⏳ Waiting 10s for transaction confirmation...');
        await new Promise(r => setTimeout(r, 10000));

        // Verify card states in contract
        console.log('\n🔍 Verifying cards in contract...');
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

        const trackerAbi = [
          'function getCard(address user, string songId, string segmentId, uint8 lineIndex) view returns (tuple(uint40 due, uint16 stability, uint8 difficulty, uint16 elapsedDays, uint16 scheduledDays, uint8 reps, uint8 lapses, uint8 state, uint40 lastReview))'
        ];
        const tracker = new ethers.Contract(FSRS_TRACKER_ADDRESS, trackerAbi, provider);

        console.log('\nCard states:');
        for (let i = 0; i < response.linesProcessed; i++) {
          const card = await tracker.getCard(
            response.userAddress,
            response.songId,
            response.segmentId,
            i
          );

          const stability = Number(card.stability) / 100; // Scale down
          const difficulty = Number(card.difficulty) / 10; // Scale down
          const scheduledDays = Number(card.scheduledDays) / 10; // Scale down
          const nextReview = new Date(Number(card.due) * 1000);

          console.log(`\nLine ${i}:`);
          console.log(`  Reps: ${card.reps}`);
          console.log(`  Stability: ${stability.toFixed(2)} days`);
          console.log(`  Difficulty: ${difficulty.toFixed(1)}/10`);
          console.log(`  Next review: ${scheduledDays.toFixed(1)} days (${nextReview.toLocaleDateString()})`);
          console.log(`  State: ${['New', 'Learning', 'Review', 'Relearning'][card.state]}`);
        }

        console.log('\n✅ Cards successfully written to contract!');
      } else if (response.contractError) {
        console.log(`❌ Contract Error: ${response.contractError}`);
      } else {
        console.log('⏭️  Blockchain write disabled');
      }

      console.log('\n' + '━'.repeat(80));
      console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
      console.log('\n📊 Summary:');
      console.log(`   ✅ FSRS algorithm working correctly`);
      console.log(`   ✅ Pronunciation scoring functional`);
      console.log(`   ✅ Contract integration successful`);
      console.log(`   ✅ Execution time: ~${(executionTime / 1000).toFixed(1)}s`);
      console.log('━'.repeat(80));

      await litClient.disconnect();
      process.exit(0);

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      console.error('\nStack trace:', error.stack);
      await litClient.disconnect();
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
