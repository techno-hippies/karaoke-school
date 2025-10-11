#!/usr/bin/env node

/**
 * Test Audio Processor v3 Lit Action (Modal complete pipeline)
 *
 * Tests:
 * 1. Segment ownership verification via KaraokeCreditsV1 contract
 * 2. Modal complete pipeline (Spleeter + fal.ai + Grove)
 * 3. Credit-gated karaoke generation
 *
 * Changes from v2:
 *   - No fal.ai key decryption (Modal uses its own secret)
 *   - Single endpoint call to Modal
 *   - Should complete in <10s (all heavy work is in Modal with no timeout)
 *
 * Prerequisites:
 *   Run setup script first to unlock test segment:
 *   DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
 *   dotenvx run -- bash scripts/setup-test-credits.sh
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
 *   dotenvx run -- bun run src/test/test-audio-processor-v3.mjs
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
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

// Audio Processor v3 CID (Modal complete pipeline with Replicate)
const AUDIO_PROCESSOR_V3_CID = 'QmU4gXw7tMGFEnWHLdYXDy9TccBHyAizxSQkFbyeXQLuJY';

// KaraokeCredits contract (Base Sepolia)
const KARAOKE_CREDITS_ADDRESS = '0x6de183934E68051c407266F877fafE5C20F74653';

// Test data (from match-and-segment output)
const TEST_DATA = {
  geniusId: 378195,
  sectionIndex: 1, // Test Verse 1
  sections: [
    {
      type: 'Verse 1',
      startTime: 0,
      endTime: 23,
      duration: 23
    },
    {
      type: 'Chorus',
      startTime: 23,
      endTime: 46,
      duration: 23
    }
  ],
  genius: {
    artist: 'Sia',
    title: 'Chandelier',
    album: '1000 Forms of Fear'
  },
  soundcloudPermalink: 'siamusic/sia-chandelier'
};

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function testAudioProcessor() {
  console.log('\n' + '='.repeat(80));
  console.log(`🎵 Testing: ${TEST_DATA.genius.artist} - ${TEST_DATA.genius.title}`);
  console.log(`   Section: ${TEST_DATA.sections[TEST_DATA.sectionIndex - 1].type} (${TEST_DATA.sections[TEST_DATA.sectionIndex - 1].duration}s)`);
  console.log('='.repeat(80));

  // Load credentials
  const pkpCreds = await loadPKPCredentials();

  // Create auth manager
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "audio-processor-v3-test",
      networkName: "naga-dev",
      storagePath: "./lit-auth-storage"
    }),
  });
  console.log('✅ Auth Manager created');

  // Connect to Lit
  console.log('\n🔌 Connecting to Lit Protocol...');
  const litClient = await createLitClient({
    network: nagaDev
  });
  console.log('✅ Connected to Lit Network');

  // Create authentication context
  console.log('🔐 Creating authentication context...');
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  const viemAccount = privateKeyToAccount(privateKey);
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

  // Get user address from test wallet
  const userAddress = viemAccount.address;
  console.log(`📍 Test wallet address: ${userAddress}`);

  // Check segment ownership before proceeding
  const selectedSection = TEST_DATA.sections[TEST_DATA.sectionIndex - 1];
  const segmentId = selectedSection.type.toLowerCase().replace(/\s+/g, '-'); // "verse-1"

  console.log('\n🔍 Checking segment ownership...');
  console.log(`   Genius ID: ${TEST_DATA.geniusId}`);
  console.log(`   Segment: ${segmentId}`);

  console.log('\n⚠️  This test requires segment ownership!');
  console.log('   Run these commands first:');
  console.log(`   1. Grant credits to ${userAddress}`);
  console.log(`   2. Unlock segment: geniusId=378195, segmentId="${segmentId}"`);
  console.log('   Or the Lit Action will fail with "Segment not owned" error.\n');

  // Prepare jsParams (no fal.ai key needed - Modal has it)
  const jsParams = {
    geniusId: TEST_DATA.geniusId,
    sectionIndex: TEST_DATA.sectionIndex,
    sections: TEST_DATA.sections,
    soundcloudPermalink: TEST_DATA.soundcloudPermalink,
    userAddress: userAddress
  };

  console.log('\n🚀 Executing Audio Processor v3 Lit Action (Modal Complete Pipeline)...');
  console.log('⏱️  Expected time: <10s for orchestration');
  console.log('   Step 1: Verify segment ownership on-chain');
  console.log('   Step 2: Call Modal complete pipeline (Spleeter + fal.ai + Grove)');
  console.log('   Step 3: Get segment hash from catalog');
  console.log('   Note: All heavy processing happens on Modal (no timeout constraints)');
  const startTime = Date.now();

  try {
    const result = await litClient.executeJs({
      ipfsId: AUDIO_PROCESSOR_V3_CID,
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

    // Save full response
    const outputDir = join(__dirname, '../../output');
    const outputFile = join(outputDir, `audio-processor-v3-result.json`);
    await writeFile(outputFile, JSON.stringify(response, null, 2));
    console.log(`💾 Saved full result to: ${outputFile}\n`);

    console.log('✅ Success:', response.success);
    if (!response.success && response.error) {
      console.log('❌ Error:', response.error);
      if (response.stack) {
        console.log('Stack:', response.stack);
      }
      return false;
    }

    console.log('\n--- Section Info ---');
    console.log('Section:', response.section.type);
    console.log('Duration:', response.section.duration + 's');
    console.log('Time range:', `${response.section.startTime}s - ${response.section.endTime}s`);
    console.log('Segment hash:', response.segmentHash);

    console.log('\n--- Grove URIs ---');
    console.log('Vocals:', response.grove.vocals);
    console.log('Accompaniment:', response.grove.accompaniment);

    console.log('\n--- Gateway URLs ---');
    console.log('Vocals:', response.grove_gateway_urls.vocals);
    console.log('Accompaniment:', response.grove_gateway_urls.accompaniment);

    console.log('\n--- Modal Pipeline Timing ---');
    console.log('Spleeter separation:', response.processing.modal.spleeter.toFixed(1) + 's');
    console.log('Replicate enhancement:', response.processing.modal.replicate.toFixed(1) + 's');
    console.log('Grove upload:', response.processing.modal.grove_upload.toFixed(1) + 's');
    console.log('Modal total:', response.processing.modal.total.toFixed(1) + 's');

    console.log('\n--- Lit Action Timing ---');
    console.log('Modal complete call:', response.processing.lit_action.modal_complete.toFixed(1) + 's');
    console.log('Catalog read:', response.processing.lit_action.catalog_read.toFixed(1) + 's');
    console.log('Lit Action total:', response.processing.lit_action.total.toFixed(1) + 's');

    console.log('\n' + '━'.repeat(80));
    return true;

  } catch (error) {
    console.log('❌ Error executing Lit Action:', error.message);
    if (error.stack) {
      console.log(error.stack);
    }
    return false;
  }
}

// Run test
console.log('🎹 Audio Processor v3 Test (Modal Complete Pipeline)\n');
console.log('Testing:');
console.log('  1. Segment ownership verification (KaraokeCreditsV1 on Base Sepolia)');
console.log('  2. Modal complete pipeline endpoint (Spleeter + Replicate + Grove)');
console.log('  3. Grove URI retrieval');
console.log('  4. KaraokeCatalog segment hash lookup');
console.log('\nChanges from v2:');
console.log('  ✅ No API key decryption (Modal uses its own secret)');
console.log('  ✅ Single Modal endpoint call (Spleeter + Replicate + Grove)');
console.log('  ✅ Lit Action is pure orchestration (<10s)');
console.log('  ✅ All heavy work on Modal (no timeout limits)');
console.log('  ✅ Replicate is 3x faster than fal.ai (4.7s vs 15s)\n');

const success = await testAudioProcessor();

console.log('\n' + '='.repeat(80));
if (success) {
  console.log('✅ TEST PASSED');
} else {
  console.log('❌ TEST FAILED');
}
console.log('='.repeat(80));

process.exit(success ? 0 : 1);
