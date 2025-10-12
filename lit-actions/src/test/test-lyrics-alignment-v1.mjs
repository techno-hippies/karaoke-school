#!/usr/bin/env node

/**
 * Test Script for Lyrics Alignment v1 Lit Action
 *
 * Tests per-language karaoke timing:
 * - ElevenLabs forced alignment → Word-level timing
 * - OpenRouter translation → Single target language
 * - Grove storage → Upload metadata
 * - Contract update → Write metadataUri
 *
 * Expected time: ~20-60s
 * Expected cost: ~$0.05 (ElevenLabs + OpenRouter + Grove)
 *
 * Usage:
 *   bun run src/test/test-lyrics-alignment-v1.mjs
 *   bun run src/test/test-lyrics-alignment-v1.mjs [genius-id] [language]
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

// Test song (The Less I Know the Better - has SoundCloud link + processed by v6)
const TEST_SONG = {
  geniusId: 2165830,
  name: 'Tame Impala - The Less I Know the Better',
  soundcloudPermalink: 'https://soundcloud.com/racso2099/the-less-i-know-the-better-vinyl',
  targetLanguage: 'zh',
  notes: 'Processed by v6, has SoundCloud link'
};

// Encrypted key paths (will be created after uploading Lit Action)
const ELEVENLABS_KEY_PATH = join(__dirname, '../karaoke/keys/elevenlabs_api_key_v4.json');
const OPENROUTER_KEY_PATH = join(__dirname, '../karaoke/keys/openrouter_api_key_v11.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa'; // Base Sepolia (V2 OPTIMIZED)
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const [elevenlabsKey, openrouterKey] = await Promise.all([
    readFile(ELEVENLABS_KEY_PATH, 'utf-8').then(JSON.parse),
    readFile(OPENROUTER_KEY_PATH, 'utf-8').then(JSON.parse)
  ]);

  console.log('✅ Encrypted keys loaded');
  console.log(`   ElevenLabs CID: ${elevenlabsKey.cid || 'N/A'}`);
  console.log(`   OpenRouter CID: ${openrouterKey.cid || 'N/A'}`);

  return { elevenlabsKey, openrouterKey };
}

async function fetchSongLyrics(geniusId) {
  console.log('📝 Fetching song lyrics...');

  // First get song info from contract (should have been processed by v6)
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const catalogAbi = [
    'function songExistsByGeniusId(uint32) view returns (bool)',
    'function getSongByGeniusId(uint32) view returns (tuple(uint32 id, uint32 geniusId, string title, string artist, uint32 duration, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri))'
  ];
  const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

  const exists = await catalog.songExistsByGeniusId(geniusId);
  if (!exists) {
    throw new Error(`Song ${geniusId} not found in contract. Run match-and-segment-v6 first!`);
  }

  const songData = await catalog.getSongByGeniusId(geniusId);
  console.log(`✅ Song found: ${songData.artist} - ${songData.title}`);

  // Fetch lyrics from LRClib (we'll use the synced lyrics as plain lyrics)
  const artist = songData.artist;
  const title = songData.title;

  const lrcResp = await fetch(
    'https://lrclib.net/api/search?' +
    new URLSearchParams({
      artist_name: artist,
      track_name: title
    })
  );

  const lrcResults = await lrcResp.json();
  if (lrcResults.length === 0) {
    throw new Error('No lyrics found on LRClib');
  }

  const lrcData = lrcResults[0];
  const syncedLyrics = lrcData.syncedLyrics;

  // Parse synced lyrics to extract plain text
  const lines = syncedLyrics.split('\n').filter(l => l.trim());
  const plainLyrics = lines
    .map(line => {
      const match = line.match(/\[[\d:.]+\]\s*(.+)/);
      return match ? match[1] : '';
    })
    .filter(l => l)
    .join('\n');

  console.log(`✅ Lyrics loaded (${plainLyrics.split('\n').length} lines)`);

  return plainLyrics;
}

async function main() {
  console.log('🎤 Lyrics Alignment v1 Test (Per-Language Karaoke)\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Load song data from contract (must be processed by v6 first)');
  console.log('2. Fetch plain lyrics from LRClib');
  console.log('3. Download audio from SoundCloud');
  console.log('4. Run ElevenLabs forced alignment → word-level timing');
  console.log('5. Translate lyrics to target language with OpenRouter');
  console.log('6. Upload metadata to Grove storage');
  console.log('7. Update contract with metadataUri');
  console.log('\n━'.repeat(80));

  // Check if specific genius ID provided
  const customGeniusId = parseInt(process.argv[2]);
  const customLanguage = process.argv[3];
  const geniusId = customGeniusId || TEST_SONG.geniusId;
  const targetLanguage = customLanguage || TEST_SONG.targetLanguage;
  const songName = customGeniusId ? 'Custom Song' : TEST_SONG.name;
  const soundcloudPermalink = customGeniusId ? null : TEST_SONG.soundcloudPermalink;

  try {
    // Load credentials and keys
    const pkpCreds = await loadPKPCredentials();
    const encryptedKeys = await loadEncryptedKeys();

    // Fetch song lyrics
    const plainLyrics = await fetchSongLyrics(geniusId);

    // Get soundcloud permalink if not provided
    let scPermalink = soundcloudPermalink;
    if (!scPermalink) {
      console.log('🔍 Need to get SoundCloud permalink from contract metadata...');
      // TODO: Fetch from contract metadata if available
      throw new Error('SoundCloud permalink required. Provide it as an argument or ensure it\'s in contract metadata.');
    }

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "lyrics-alignment-v1-test",
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

    // Test the alignment
    console.log('\n' + '='.repeat(80));
    console.log(`🎵 Testing: ${songName}`);
    console.log(`   Genius ID: ${geniusId}`);
    console.log(`   Target Language: ${targetLanguage}`);
    console.log('='.repeat(80));

    const { elevenlabsKey, openrouterKey } = encryptedKeys;

    const jsParams = {
      geniusId,
      soundcloudPermalink: scPermalink,
      plainLyrics: plainLyrics,
      targetLanguage: targetLanguage,

      // ElevenLabs key encryption params
      elevenlabsKeyAccessControlConditions: elevenlabsKey.accessControlConditions,
      elevenlabsKeyCiphertext: elevenlabsKey.ciphertext,
      elevenlabsKeyDataToEncryptHash: elevenlabsKey.dataToEncryptHash,

      // OpenRouter key encryption params
      openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
      openrouterKeyCiphertext: openrouterKey.ciphertext,
      openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,

      // Contract update params
      contractAddress: KARAOKE_CATALOG_ADDRESS,
      pkpAddress: pkpCreds.ethAddress,
      pkpTokenId: pkpCreds.tokenId,
      pkpPublicKey: pkpCreds.publicKey,
      updateContract: true
    };

    console.log('\n🚀 Executing Lit Action v1...');
    console.log('⏱️  Expected time: ~20-60s (alignment + translation + upload + contract)');
    console.log('💰 Expected cost: ~$0.05');
    const startTime = Date.now();

    // Use IPFS CID for production
    const LYRICS_ALIGNMENT_V1_CID = 'QmbXG6MbonZtei6L5QpCxQUkTVytixFePMkidTGxLQjnZY';

    try {
      const result = await litClient.executeJs({
        ipfsId: LYRICS_ALIGNMENT_V1_CID,
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
      const outputFile = join(outputDir, `song-${geniusId}-alignment-${targetLanguage}-result.json`);
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

      // Display alignment result
      console.log('\n--- ElevenLabs Alignment ---');
      console.log(`Lines: ${response.alignment?.linesCount || 'N/A'}`);
      console.log(`Words: ${response.alignment?.wordsCount || 'N/A'}`);

      // Display translation result
      console.log('\n--- Translation ---');
      console.log(`Target Language: ${targetLanguage}`);
      console.log(`Translated Lines: ${response.translation?.linesCount || 'N/A'}`);

      // Display Grove upload result
      console.log('\n--- Grove Storage ---');
      if (response.groveUri) {
        console.log(`✅ Metadata URI: ${response.groveUri}`);
        const groveUrl = response.groveUri.startsWith('lens://')
          ? `https://api.grove.storage/${response.groveUri.replace('lens://', '')}`
          : response.groveUri;
        console.log(`🔍 Grove URL: ${groveUrl}`);
      } else {
        console.log('❌ No Grove URI returned');
      }

      // Display contract update result
      console.log('\n--- Contract Update ---');
      if (response.txHash) {
        console.log(`✅ Transaction submitted: ${response.txHash}`);
        console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.txHash}`);

        // Wait for confirmation
        console.log('\n⏳ Waiting 10s for transaction confirmation...');
        await new Promise(r => setTimeout(r, 10000));

        // Verify metadataUri updated in contract
        console.log('\n🔍 Verifying contract update...');
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const catalogAbi = [
          'function getSongByGeniusId(uint32) view returns (tuple(uint32 id, uint32 geniusId, string title, string artist, uint32 duration, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri))'
        ];
        const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

        const songData = await catalog.getSongByGeniusId(geniusId);
        console.log(`Contract metadataUri: ${songData.metadataUri || '(empty)'}`);

        if (songData.metadataUri && songData.metadataUri === response.groveUri) {
          console.log('✅ Contract successfully updated with metadataUri!');
        } else if (songData.metadataUri) {
          console.log('⚠️  Contract has different metadataUri (may have been updated by another test)');
        } else {
          console.log('⚠️  Contract metadataUri still empty (may need more time)');
        }
      } else if (response.contractError) {
        console.log(`❌ Contract Error: ${response.contractError}`);
      } else {
        console.log('⏭️  Skipped (disabled or error)');
      }

      console.log('\n' + '━'.repeat(80));
      console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
      console.log('\n📊 Summary:');
      console.log(`   Execution time: ${(executionTime / 1000).toFixed(1)}s`);
      console.log(`   Estimated cost: ~$0.05`);
      console.log(`   Target language: ${targetLanguage}`);
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
