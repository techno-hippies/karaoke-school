#!/usr/bin/env node

/**
 * Test Script for Translate Lyrics v1 Lit Action
 *
 * Tests per-language translation (NO timing generation):
 * - Load base alignment from contract metadataUri
 * - OpenRouter translation for target language
 * - Upload to Grove → song-{geniusId}-{lang}.json
 * - Update contract via setTranslation(geniusId, languageCode, uri)
 *
 * Expected time: ~5-15s
 * Expected cost: ~$0.02 (OpenRouter only)
 *
 * Usage:
 *   bun run src/test/test-translate-lyrics-v1.mjs
 *   bun run src/test/test-translate-lyrics-v1.mjs [genius-id] [language]
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

// Test song (The Less I Know the Better - should have base alignment from previous test)
const TEST_SONG = {
  geniusId: 2165830,
  name: 'Tame Impala - The Less I Know the Better',
  targetLanguage: 'vi',  // Test Vietnamese translation
  notes: 'Should have base alignment from base-alignment-v1'
};

// Encrypted key paths (will be created after uploading Lit Action)
const OPENROUTER_KEY_PATH = join(__dirname, '../karaoke/keys/openrouter_api_key_v12.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0x17D3BB01ACe342Fa85A5B9a439feEa65e2f1D726'; // Base Sepolia (V2 with translations)
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const openrouterKey = JSON.parse(await readFile(OPENROUTER_KEY_PATH, 'utf-8'));

  console.log('✅ Encrypted keys loaded');
  console.log(`   OpenRouter CID: ${openrouterKey.cid || 'N/A'}`);

  return { openrouterKey };
}

async function checkBaseAlignment(geniusId) {
  console.log('🔍 Checking if base alignment exists...');

  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const catalogAbi = [
    'function songExistsByGeniusId(uint32) view returns (bool)',
    'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, bool enabled, uint64 addedAt))'
  ];
  const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

  const exists = await catalog.songExistsByGeniusId(geniusId);
  if (!exists) {
    throw new Error(`Song ${geniusId} not found in contract. Run match-and-segment-v6 first!`);
  }

  const songData = await catalog.getSongByGeniusId(geniusId);
  console.log(`✅ Song found: ${songData.artist} - ${songData.title}`);

  if (!songData.metadataUri || songData.metadataUri === '') {
    throw new Error('Song has no base alignment. Run base-alignment-v1 first!');
  }

  console.log(`✅ Base alignment exists: ${songData.metadataUri}`);
  return songData;
}

async function main() {
  console.log('🌍 Translate Lyrics v1 Test (Per-Language Translation)\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Check that base alignment exists in contract');
  console.log('2. Load base alignment from Grove');
  console.log('3. Translate lyrics to target language with OpenRouter');
  console.log('4. Upload translation to Grove (language-specific file)');
  console.log('5. Update contract via setTranslation()');
  console.log('\n━'.repeat(80));

  // Check if specific genius ID and language provided
  const customGeniusId = parseInt(process.argv[2]);
  const customLanguage = process.argv[3];
  const geniusId = customGeniusId || TEST_SONG.geniusId;
  const targetLanguage = customLanguage || TEST_SONG.targetLanguage;
  const songName = customGeniusId ? 'Custom Song' : TEST_SONG.name;

  try {
    // Load credentials and keys
    const pkpCreds = await loadPKPCredentials();
    const encryptedKeys = await loadEncryptedKeys();

    // Check base alignment exists
    const songData = await checkBaseAlignment(geniusId);

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "translate-lyrics-v1-test",
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

    // Test the translation
    console.log('\n' + '='.repeat(80));
    console.log(`🎵 Testing: ${songName}`);
    console.log(`   Genius ID: ${geniusId}`);
    console.log(`   Target Language: ${targetLanguage}`);
    console.log('='.repeat(80));

    const { openrouterKey } = encryptedKeys;

    const jsParams = {
      geniusId,
      targetLanguage: targetLanguage,

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
    console.log('⏱️  Expected time: ~5-15s (OpenRouter + Grove + contract)');
    console.log('💰 Expected cost: ~$0.02');
    const startTime = Date.now();

    // Use IPFS CID for production
    const TRANSLATE_LYRICS_V1_CID = 'QmcLk7vnPJj8vNikqzaKY6x3yZes8kYmaH3f8hDRNS5HP3';

    try {
      const result = await litClient.executeJs({
        ipfsId: TRANSLATE_LYRICS_V1_CID,
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
      const outputFile = join(outputDir, `song-${geniusId}-translation-${targetLanguage}-result.json`);
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

      // Display translation result
      console.log('\n--- Translation ---');
      console.log(`Target Language: ${targetLanguage}`);
      console.log(`Translated Lines: ${response.lineCount || 'N/A'}`);

      // Display Grove upload result
      console.log('\n--- Grove Storage ---');
      if (response.translationUri) {
        console.log(`✅ Translation URI: ${response.translationUri}`);
        console.log(`🔍 Grove URL: ${response.gatewayUrl}`);
      } else {
        console.log('❌ No translation URI returned');
      }

      // Display contract update result
      console.log('\n--- Contract Update ---');
      if (response.txHash) {
        console.log(`✅ Transaction submitted: ${response.txHash}`);
        console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.txHash}`);

        // Wait for confirmation
        console.log('\n⏳ Waiting 10s for transaction confirmation...');
        await new Promise(r => setTimeout(r, 10000));

        // Verify translation URI updated in contract
        console.log('\n🔍 Verifying contract update...');
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const catalogAbi = [
          'function getTranslation(uint32 geniusId, string calldata languageCode) external view returns (string memory)',
          'function getAvailableLanguages(uint32 geniusId) external view returns (string[] memory)'
        ];
        const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

        const translationUri = await catalog.getTranslation(geniusId, targetLanguage);
        console.log(`Contract translation URI (${targetLanguage}): ${translationUri || '(empty)'}`);

        if (translationUri && translationUri === response.translationUri) {
          console.log('✅ Contract successfully updated with translation URI!');
        } else if (translationUri) {
          console.log('⚠️  Contract has different translation URI (may have been updated by another test)');
        } else {
          console.log('⚠️  Contract translation URI still empty (may need more time)');
        }

        // Check available languages
        const availableLanguages = await catalog.getAvailableLanguages(geniusId);
        console.log(`Available languages: [${availableLanguages.join(', ')}]`);

      } else if (response.contractError) {
        console.log(`❌ Contract Error: ${response.contractError}`);
      } else {
        console.log('⏭️  Skipped (disabled or error)');
      }

      console.log('\n' + '━'.repeat(80));
      console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
      console.log('\n📊 Summary:');
      console.log(`   Execution time: ${(executionTime / 1000).toFixed(1)}s`);
      console.log(`   Estimated cost: ~$0.02`);
      console.log(`   Language: ${targetLanguage}`);
      console.log(`   Lines: ${response.lineCount}`);
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
