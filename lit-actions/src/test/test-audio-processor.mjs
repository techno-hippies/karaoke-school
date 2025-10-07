#!/usr/bin/env node

/**
 * Test Audio Processor v2 Lit Action
 *
 * Tests consolidated audio processing (download + trim + stems)
 * Uses output from match-and-segment-v2 as input
 *
 * Usage:
 *   bun run src/test/test-audio-processor.mjs
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

// Audio Processor v2 CID
const AUDIO_PROCESSOR_V2_CID = 'QmUi7DijL3ng9C1GUnBduaGSus1axTRGJo9VvRPAsCJZnt';

// Encrypted key path
const ELEVENLABS_KEY_PATH = join(__dirname, '../karaoke/keys/elevenlabs_api_key_v1.json');

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
  console.log('🔐 Loading encrypted ElevenLabs key...');
  const elevenlabsKey = JSON.parse(await readFile(ELEVENLABS_KEY_PATH, 'utf-8'));
  console.log('✅ Encrypted key loaded');
  console.log(`   CID: ${elevenlabsKey.cid || 'N/A'}`);
  return { elevenlabsKey };
}

async function testAudioProcessor() {
  console.log('\n' + '='.repeat(80));
  console.log(`🎵 Testing: ${TEST_DATA.genius.artist} - ${TEST_DATA.genius.title}`);
  console.log(`   Section: ${TEST_DATA.sections[TEST_DATA.sectionIndex - 1].type} (${TEST_DATA.sections[TEST_DATA.sectionIndex - 1].duration}s)`);
  console.log('='.repeat(80));

  // Load credentials and keys
  const pkpCreds = await loadPKPCredentials();
  const { elevenlabsKey } = await loadEncryptedKeys();

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

  // Prepare jsParams - add dummy rendiKey params for backward compatibility
  const jsParams = {
    geniusId: TEST_DATA.geniusId,
    sectionIndex: TEST_DATA.sectionIndex,
    sections: TEST_DATA.sections,
    genius: TEST_DATA.genius,
    soundcloudPermalink: TEST_DATA.soundcloudPermalink,

    // ElevenLabs key (for future alignment step)
    elevenlabsKeyAccessControlConditions: elevenlabsKey.accessControlConditions,
    elevenlabsKeyCiphertext: elevenlabsKey.ciphertext,
    elevenlabsKeyDataToEncryptHash: elevenlabsKey.dataToEncryptHash,

    // Dummy Rendi params (backward compatibility - ignored by v2)
    rendiKeyAccessControlConditions: [],
    rendiKeyCiphertext: '',
    rendiKeyDataToEncryptHash: ''
  };

  console.log('\n🚀 Executing Audio Processor Lit Action...');
  console.log('⏱️  Expected time: ~31s (51% faster than v1)');
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

    console.log('\n--- Audio Output ---');
    console.log('Audio URL:', response.audio.audioUrl);
    console.log('Vocals ZIP:', (response.audio.vocalsZipSize / 1024 / 1024).toFixed(2) + 'MB');
    console.log('Drums ZIP:', (response.audio.drumsZipSize / 1024 / 1024).toFixed(2) + 'MB');

    console.log('\n--- Processing Time ---');
    console.log('Download:', response.processing.downloadTime.toFixed(1) + 's');
    console.log('Trim:', response.processing.trimTime.toFixed(1) + 's');
    console.log('Separation:', response.processing.separationTime.toFixed(1) + 's');
    console.log('Modal total:', response.processing.modalProcessingTime.toFixed(1) + 's');
    console.log('Overall total:', response.processing.totalTime.toFixed(1) + 's');

    console.log('\n--- Performance ---');
    console.log('Processing speedup ratio:', response.speedup.ratio);

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
console.log('🎹 Audio Processor v2 Test\n');
console.log('Testing consolidated Modal endpoint (download + trim + stems)');
console.log('Expected improvement: 51% faster than v1 (64s → 31s)\n');

const success = await testAudioProcessor();

console.log('\n' + '='.repeat(80));
if (success) {
  console.log('✅ TEST PASSED');
} else {
  console.log('❌ TEST FAILED');
}
console.log('='.repeat(80));

process.exit(success ? 0 : 1);
