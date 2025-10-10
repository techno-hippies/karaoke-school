#!/usr/bin/env node

/**
 * Test Script for Match and Segment v3 Lit Action
 *
 * Tests the complete pipeline with ElevenLabs forced alignment:
 * - Genius API → Song metadata
 * - LRClib API → Synced lyrics
 * - GPT-5-nano → Match + segmentation
 * - ElevenLabs → Word-level timing alignment
 * - Contract write with PKP signing
 *
 * Usage:
 *   bun run src/test/test-match-and-segment-v3.mjs
 *   bun run src/test/test-match-and-segment-v3.mjs [genius-id]
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

// Test song (using Sia - Chandelier which has SoundCloud link)
const TEST_SONG = {
  geniusId: 378195,
  name: 'Sia - Chandelier',
  notes: 'Has SoundCloud link for ElevenLabs alignment test'
};

// CID for match-and-segment-v3 (optimized alignment + addFullSong)
const MATCH_AND_SEGMENT_V3_CID = 'QmYufUHy3pSTPA18vdwt2tt12WWHJ3PBnpExcrh5LqChcz';

// Encrypted key paths
const OPENROUTER_KEY_PATH = join(__dirname, '../karaoke/keys/openrouter_api_key_v6.json');
const GENIUS_KEY_PATH = join(__dirname, '../karaoke/keys/genius_api_key_v6.json');
const ELEVENLABS_KEY_PATH = join(__dirname, '../karaoke/keys/elevenlabs_api_key_v2.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0x0843DDB2F2ceCAB0644Ece0523328af2C7882032'; // Base Sepolia
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const [openrouterKey, geniusKey, elevenlabsKey] = await Promise.all([
    readFile(OPENROUTER_KEY_PATH, 'utf-8').then(JSON.parse),
    readFile(GENIUS_KEY_PATH, 'utf-8').then(JSON.parse),
    readFile(ELEVENLABS_KEY_PATH, 'utf-8').then(JSON.parse)
  ]);

  console.log('✅ Encrypted keys loaded');
  console.log(`   OpenRouter CID: ${openrouterKey.cid || 'N/A'}`);
  console.log(`   Genius CID: ${geniusKey.cid || 'N/A'}`);
  console.log(`   ElevenLabs CID: ${elevenlabsKey.cid || 'N/A'}`);

  return { openrouterKey, geniusKey, elevenlabsKey };
}

async function main() {
  console.log('🎤 Match and Segment v3 Test (With ElevenLabs Alignment)\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Fetch song metadata from Genius');
  console.log('2. Get synced lyrics from LRClib');
  console.log('3. Match songs + segment with AI');
  console.log('4. Download audio and run ElevenLabs forced alignment');
  console.log('5. Write to blockchain with PKP signing');
  console.log('\n━'.repeat(80));

  // Check if specific genius ID provided
  const customGeniusId = parseInt(process.argv[2]);
  const geniusId = customGeniusId || TEST_SONG.geniusId;
  const songName = customGeniusId ? 'Custom Song' : TEST_SONG.name;

  try {
    // Load credentials and keys
    const pkpCreds = await loadPKPCredentials();
    const encryptedKeys = await loadEncryptedKeys();

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "match-and-segment-v3-test",
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

    // Test the song
    console.log('\n' + '='.repeat(80));
    console.log(`🎵 Testing: ${songName} (Genius ID: ${geniusId})`);
    console.log('='.repeat(80));

    const { openrouterKey, geniusKey, elevenlabsKey } = encryptedKeys;

    const jsParams = {
      geniusId,
      pkpPublicKey: pkpCreds.publicKey,

      // OpenRouter key encryption params
      openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
      openrouterKeyCiphertext: openrouterKey.ciphertext,
      openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,

      // Genius key encryption params
      geniusKeyAccessControlConditions: geniusKey.accessControlConditions,
      geniusKeyCiphertext: geniusKey.ciphertext,
      geniusKeyDataToEncryptHash: geniusKey.dataToEncryptHash,

      // ElevenLabs key encryption params
      elevenlabsKeyAccessControlConditions: elevenlabsKey.accessControlConditions,
      elevenlabsKeyCiphertext: elevenlabsKey.ciphertext,
      elevenlabsKeyDataToEncryptHash: elevenlabsKey.dataToEncryptHash,

      // Contract write params
      contractAddress: KARAOKE_CATALOG_ADDRESS,
      pkpAddress: pkpCreds.ethAddress,
      pkpTokenId: pkpCreds.tokenId,
      pkpPublicKey: pkpCreds.publicKey,
      writeToBlockchain: false, // Set to true to test contract write
      runAlignment: true
    };

    console.log('\n🚀 Executing Lit Action v3...');
    console.log('⏱️  Expected time: ~29s (with ElevenLabs alignment)');
    const startTime = Date.now();

    try {
      const result = await litClient.executeJs({
        ipfsId: MATCH_AND_SEGMENT_V3_CID,
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
      const outputFile = join(outputDir, `song-${geniusId}-v3-result.json`);
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

      // Display Genius data
      console.log('\n--- Genius ---');
      console.log(`Artist: ${response.genius?.artist || 'N/A'}`);
      console.log(`Title: ${response.genius?.title || 'N/A'}`);
      console.log(`SoundCloud: ${response.genius?.soundcloudPermalink || 'N/A'}`);

      // Display LRClib data
      console.log('\n--- LRClib ---');
      console.log(`Match Score: ${response.lrclib?.matchScore || 'N/A'}`);
      console.log(`Lyrics Lines: ${response.lrclib?.lyricsLines || 'N/A'}`);

      // Display matching result
      console.log('\n--- Matching ---');
      console.log(`Match: ${response.isMatch ? 'YES ✅' : 'NO ❌'}`);
      console.log(`Confidence: ${response.confidence || 'N/A'}`);

      // Display sections
      console.log('\n--- Sections ---');
      if (response.sections && response.sections.length > 0) {
        response.sections.forEach((section, i) => {
          console.log(`${i + 1}. ${section.type} (${section.startTime.toFixed(1)}s - ${section.endTime.toFixed(1)}s, ${section.duration.toFixed(1)}s)`);
        });
      } else {
        console.log('No sections found');
      }

      // Display ElevenLabs alignment
      console.log('\n--- ElevenLabs Alignment ---');
      if (response.alignment) {
        console.log(`✅ Alignment completed (optimized)`);
        console.log(`Grove Storage Key: ${response.alignment.storageKey || 'N/A'}`);
        console.log(`Grove URI: ${response.alignment.uri || 'N/A'}`);
        console.log(`Words: ${response.alignment.wordCount || 0}`);
        console.log(`Preview (first 3 words):`);
        if (response.alignment.preview && response.alignment.preview.length > 0) {
          response.alignment.preview.forEach((w, i) => {
            console.log(`  ${i + 1}. "${w.text}" (${w.start}s - ${w.end}s)`);
          });
        }

        if (response.alignment.gatewayUrl) {
          console.log(`\n🔗 View full alignment: ${response.alignment.gatewayUrl}`);
        }
      } else if (response.alignmentError) {
        console.log(`❌ Alignment failed: ${response.alignmentError}`);
      } else {
        console.log('⏭️  Alignment skipped');
      }

      // Display blockchain write result
      console.log('\n--- Blockchain Write ---');
      if (response.txHash) {
        console.log(`✅ Transaction submitted: ${response.txHash}`);
        console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.txHash}`);
        console.log(`📝 Contract: ${response.contractAddress}`);
      } else if (response.contractError) {
        console.log(`❌ Contract Error: ${response.contractError}`);
      } else if (!response.isMatch) {
        console.log('⏭️  Skipped (songs did not match)');
      } else {
        console.log('⏭️  Skipped (disabled or no sections)');
      }

      console.log('\n' + '━'.repeat(80));
      console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
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
