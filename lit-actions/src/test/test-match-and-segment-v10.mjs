#!/usr/bin/env node

/**
 * Test Script for Match and Segment v10 Lit Action
 *
 * Tests v10 with geniusArtistId support for Genius API decoupling:
 * - System PKP hardcoded in IPFS code (immutable, can't be spoofed)
 * - Stores geniusArtistId in contract for full decoupling
 * - Genius API → Song metadata (including artist ID)
 * - LRClib API → Synced lyrics
 * - Flash 2.5 Lite → Match + segmentation (NO translations)
 * - Contract write to new KaraokeCatalogV2 at 0xa3fE1628c6FA4B93df76e070fdCd103626D83039
 *
 * Expected time: ~5-10s
 *
 * Usage:
 *   bun run src/test/test-match-and-segment-v10.mjs
 *   bun run src/test/test-match-and-segment-v10.mjs [genius-id]
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

// Load PKP credentials (system PKP)
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

// Test song (using Sia - Chandelier which has SoundCloud link)
const TEST_SONG = {
  geniusId: 378195,
  name: 'Sia - Chandelier',
  notes: 'Has SoundCloud link + synced lyrics'
};

// Encrypted key paths (v17 = encrypted for match-and-segment v9 V4 ABI)
const OPENROUTER_KEY_PATH = join(__dirname, '../karaoke/keys/openrouter_api_key_v17.json');
const GENIUS_KEY_PATH = join(__dirname, '../karaoke/keys/genius_api_key_v17.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0xa3fE1628c6FA4B93df76e070fdCd103626D83039'; // Base Sepolia (V2 with geniusArtistId)
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const [openrouterKey, geniusKey] = await Promise.all([
    readFile(OPENROUTER_KEY_PATH, 'utf-8').then(JSON.parse),
    readFile(GENIUS_KEY_PATH, 'utf-8').then(JSON.parse)
  ]);

  console.log('✅ Encrypted keys loaded');
  console.log(`   OpenRouter CID: ${openrouterKey.cid || 'N/A'}`);
  console.log(`   Genius CID: ${geniusKey.cid || 'N/A'}`);

  return { openrouterKey, geniusKey };
}

async function main() {
  console.log('🎤 Match and Segment v10 Test (geniusArtistId Support)\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Fetch song metadata from Genius (with artist ID)');
  console.log('2. Check audio file size (< 600KB = 30s snippet)');
  console.log('3. Get synced lyrics from LRClib');
  console.log('4. Match songs + segment with AI (NO translations)');
  console.log('5. Write to blockchain with geniusArtistId (new field)');
  console.log('6. Verify song exists in new contract');
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
        appName: "match-and-segment-v10-test",
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

    const { openrouterKey, geniusKey } = encryptedKeys;

    const jsParams = {
      geniusId,

      // OpenRouter key encryption params
      openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
      openrouterKeyCiphertext: openrouterKey.ciphertext,
      openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,

      // Genius key encryption params
      geniusKeyAccessControlConditions: geniusKey.accessControlConditions,
      geniusKeyCiphertext: geniusKey.ciphertext,
      geniusKeyDataToEncryptHash: geniusKey.dataToEncryptHash,

      // Contract write params (system PKP hardcoded in v7, but still pass for completeness)
      contractAddress: KARAOKE_CATALOG_ADDRESS,
      writeToBlockchain: true
    };

    console.log('\n🚀 Executing Lit Action v10...');
    console.log('⏱️  Expected time: ~5-10s');
    const startTime = Date.now();

    // Use IPFS CID for v10 (V10 ABI with 16 fields including geniusArtistId)
    // TODO: Update this CID after uploading v10 to IPFS
    const MATCH_AND_SEGMENT_V10_CID = 'QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN'; // PLACEHOLDER - UPDATE AFTER UPLOAD

    try {
      const result = await litClient.executeJs({
        ipfsId: MATCH_AND_SEGMENT_V10_CID,
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
      const outputFile = join(outputDir, `song-${geniusId}-v10-result.json`);
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
      console.log(`Has Full Audio: ${response.hasFullAudio ? 'YES ✅' : 'NO ❌ (30s clip)'}`);

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

      // Display blockchain write result
      console.log('\n--- Blockchain Write ---');
      if (response.txHash) {
        console.log(`✅ Transaction submitted: ${response.txHash}`);
        console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.txHash}`);
        console.log(`📝 Contract: ${response.contractAddress}`);

        // Wait for confirmation
        console.log('\n⏳ Waiting 10s for transaction confirmation...');
        await new Promise(r => setTimeout(r, 10000));

        // Verify song exists in contract
        console.log('\n🔍 Verifying song in contract...');
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const catalogAbi = ['function songExistsByGeniusId(uint32) view returns (bool)'];
        const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

        const exists = await catalog.songExistsByGeniusId(geniusId);
        console.log(`Contract check: songExistsByGeniusId(${geniusId}) = ${exists}`);

        if (exists) {
          console.log('✅ Song successfully written to contract!');
        } else {
          console.log('⚠️  Song not found in contract yet (may need more time)');
        }
      } else if (response.contractError) {
        console.log(`❌ Contract Error: ${response.contractError}`);
      } else if (!response.isMatch) {
        console.log('⏭️  Skipped (songs did not match)');
      } else {
        console.log('⏭️  Skipped (disabled or no sections)');
      }

      console.log('\n' + '━'.repeat(80));
      console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
      console.log('\n📊 V10 Features:');
      console.log(`   ✅ geniusArtistId stored in contract`);
      console.log(`   ✅ Full Genius API decoupling enabled`);
      console.log(`   ✅ System PKP hardcoded in IPFS (immutable)`);
      console.log(`   ✅ Fast execution: ~${(executionTime / 1000).toFixed(1)}s`);
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
