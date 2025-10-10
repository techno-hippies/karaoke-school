#!/usr/bin/env node

/**
 * Test Audio Processor v1 Lit Action (with Credit Validation)
 *
 * Tests:
 * 1. Segment ownership verification via KaraokeCreditsV1 contract
 * 2. Consolidated audio processing (download + trim + stems)
 * 3. Credit-gated karaoke generation
 *
 * Prerequisites:
 *   Run setup script first to unlock test segment:
 *   DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
 *   dotenvx run -- bash scripts/setup-test-credits.sh
 *
 * Usage:
 *   DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
 *   dotenvx run -- bun run src/test/test-audio-processor.mjs
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

// Audio Processor v2 CID (complete pipeline: fal.ai + ElevenLabs + Grove)
const AUDIO_PROCESSOR_V2_CID = 'QmNw4ZstYobT8bKKcgGUDxnnA89go9b55yNbtxzdXfqWJb';

// Encrypted key paths
const ELEVENLABS_KEY_PATH = join(__dirname, '../karaoke/keys/elevenlabs_api_key_v2.json');
const FAL_API_KEY_PATH = join(__dirname, '../karaoke/keys/fal_api_key_v1.json');

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

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const elevenlabsKey = JSON.parse(await readFile(ELEVENLABS_KEY_PATH, 'utf-8'));
  console.log('✅ ElevenLabs key loaded');
  console.log(`   CID: ${elevenlabsKey.cid || 'N/A'}`);

  const falApiKey = JSON.parse(await readFile(FAL_API_KEY_PATH, 'utf-8'));
  console.log('✅ fal.ai key loaded');
  console.log(`   CID: ${falApiKey.cid || 'N/A'}`);
  return { elevenlabsKey, falApiKey };
}

async function testAudioProcessor() {
  console.log('\n' + '='.repeat(80));
  console.log(`🎵 Testing: ${TEST_DATA.genius.artist} - ${TEST_DATA.genius.title}`);
  console.log(`   Section: ${TEST_DATA.sections[TEST_DATA.sectionIndex - 1].type} (${TEST_DATA.sections[TEST_DATA.sectionIndex - 1].duration}s)`);
  console.log('='.repeat(80));

  // Load credentials and keys
  const pkpCreds = await loadPKPCredentials();
  const { elevenlabsKey, falApiKey } = await loadEncryptedKeys();

  // Create auth manager
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "audio-processor-v2-test",
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

  // Note: In real test, you should run this first:
  // 1. Grant credits: creditsContract.grantCredits(userAddress, 5, "test") (as PKP/owner)
  // 2. Unlock segment: creditsContract.useCredit(1, "378195", "verse-1") (as user)
  console.log('\n⚠️  This test requires segment ownership!');
  console.log('   Run these commands first:');
  console.log(`   1. Grant credits to ${userAddress}`);
  console.log(`   2. Unlock segment: geniusId=378195, segmentId="${segmentId}"`);
  console.log('   Or the Lit Action will fail with "Segment not owned" error.\n');

  // Prepare jsParams
  const jsParams = {
    geniusId: TEST_DATA.geniusId,
    sectionIndex: TEST_DATA.sectionIndex,
    sections: TEST_DATA.sections,
    soundcloudPermalink: TEST_DATA.soundcloudPermalink,
    userAddress: userAddress, // Required for ownership verification

    // ElevenLabs key (for vocal alignment)
    elevenlabsKeyAccessControlConditions: elevenlabsKey.accessControlConditions,
    elevenlabsKeyCiphertext: elevenlabsKey.ciphertext,
    elevenlabsKeyDataToEncryptHash: elevenlabsKey.dataToEncryptHash,

    // fal.ai key (for drum enhancement)
    falApiKeyAccessControlConditions: falApiKey.accessControlConditions,
    falApiKeyCiphertext: falApiKey.ciphertext,
    falApiKeyDataToEncryptHash: falApiKey.dataToEncryptHash
  };

  console.log('\n🚀 Executing Audio Processor Lit Action (v2 - Complete Pipeline)...');
  console.log('⏱️  Expected time: ~45s for full pipeline');
  console.log('   Step 1: Verify segment ownership on-chain');
  console.log('   Step 2: Decrypt API keys (ElevenLabs + fal.ai)');
  console.log('   Step 3: Verify audio availability');
  console.log('   Step 4: Process with Modal (download + trim + stems)');
  console.log('   Step 5: Enhance drums with fal.ai');
  console.log('   Step 6: Get vocal alignment from ElevenLabs');
  console.log('   Step 7: Prepare for Grove upload and registry update');
  const startTime = Date.now();

  try {
    const result = await litClient.executeJs({
      ipfsId: AUDIO_PROCESSOR_V2_CID,
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
    const outputFile = join(outputDir, `audio-processor-result.json`);
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

    console.log('\n--- Processed Assets ---');
    console.log('Vocals MP3:', (response.assets.vocalsSize / 1024 / 1024).toFixed(2) + 'MB');
    console.log('Enhanced Drums MP3:', (response.assets.drumsSize / 1024 / 1024).toFixed(2) + 'MB');
    console.log('Alignment words:', response.assets.alignmentWords);

    console.log('\n--- Processing Time ---');
    console.log('Modal (download + trim + stems):', response.processing.modal.toFixed(1) + 's');
    console.log('fal.ai (drum enhancement):', response.processing.falai.toFixed(1) + 's');
    console.log('ElevenLabs (vocal alignment):', response.processing.elevenlabs.toFixed(1) + 's');
    console.log('Grove (preparation):', response.processing.grove.toFixed(1) + 's');
    console.log('Total pipeline:', response.processing.total.toFixed(1) + 's');

    console.log('\n--- Performance ---');
    console.log('Processing speedup ratio:', response.speedup.ratio);
    console.log('Note:', response.assets._note);

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
console.log('🎹 Audio Processor v2 Test (Complete Pipeline)\n');
console.log('Testing:');
console.log('  1. Segment ownership verification (KaraokeCreditsV1 on Base Sepolia)');
console.log('  2. Modal endpoint (download + trim + stems)');
console.log('  3. fal.ai drum enhancement (audio-to-audio)');
console.log('  4. ElevenLabs vocal alignment (word-level timestamps)');
console.log('  5. Grove upload preparation');
console.log('  6. KaraokeCatalog registry update preparation\n');

const success = await testAudioProcessor();

console.log('\n' + '='.repeat(80));
if (success) {
  console.log('✅ TEST PASSED');
} else {
  console.log('❌ TEST FAILED');
}
console.log('='.repeat(80));

process.exit(success ? 0 : 1);
