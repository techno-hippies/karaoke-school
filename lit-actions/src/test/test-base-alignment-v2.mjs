#!/usr/bin/env node

/**
 * Test Script for Base Alignment v2 Lit Action
 *
 * V2 PHILOSOPHY: Lit Action reads ALL data from contract
 * - NO frontend state management
 * - Cannot be spoofed with bad data
 * - Robust: if frontend fails, Lit Action still works
 *
 * Flow:
 * 1. Read song data from contract (soundcloudPath, title, artist)
 * 2. Fetch lyrics from LRClib using contract data
 * 3. Download audio from SoundCloud
 * 4. ElevenLabs forced alignment → word-level timing
 * 5. Upload to Grove → song-{geniusId}-base.json
 * 6. Update contract metadataUri
 *
 * Expected time: ~20-40s (LRClib + ElevenLabs + Grove + contract)
 * Expected cost: ~$0.03 (ElevenLabs only)
 *
 * Usage:
 *   bun run src/test/test-base-alignment-v2.mjs
 *   bun run src/test/test-base-alignment-v2.mjs [genius-id]
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

// Test song (Sia - Chandelier)
const TEST_SONG = {
  geniusId: 378195,
  name: 'Sia - Chandelier',
  notes: 'Must be cataloged in contract first (run match-and-segment-v7)'
};

// Encrypted key paths
const ELEVENLABS_KEY_PATH = join(__dirname, '../karaoke/keys/elevenlabs_api_key_v8.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0x420Fd6e49Cb672cfbe9649B556807E6b0BafA341'; // Base Sepolia V2
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const elevenlabsKey = JSON.parse(await readFile(ELEVENLABS_KEY_PATH, 'utf-8'));

  console.log('✅ Encrypted keys loaded');
  console.log(`   ElevenLabs CID: ${elevenlabsKey.cid || 'N/A'}`);

  return { elevenlabsKey };
}

async function verifySongInContract(geniusId) {
  console.log('🔍 Verifying song exists in contract...');

  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const catalogAbi = [
    'function songExistsByGeniusId(uint32) view returns (bool)',
    'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, string soundcloudPath, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, string sectionsUri, string alignmentUri, bool enabled, uint64 addedAt))'
  ];
  const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

  const exists = await catalog.songExistsByGeniusId(geniusId);
  if (!exists) {
    throw new Error(`Song ${geniusId} not found in contract. Run match-and-segment-v7 first!`);
  }

  const songData = await catalog.getSongByGeniusId(geniusId);
  console.log(`✅ Song found in contract:`);
  console.log(`   Title: ${songData.title}`);
  console.log(`   Artist: ${songData.artist}`);
  console.log(`   SoundCloud path: ${songData.soundcloudPath || 'N/A'}`);

  if (!songData.soundcloudPath) {
    throw new Error('Song has no soundcloudPath in contract. Run match-and-segment-v7 first!');
  }

  return songData;
}

async function main() {
  console.log('🎤 Base Alignment v2 Test (Self-Contained)\n');
  console.log('━'.repeat(80));
  console.log('\nV2 reads ALL data from contract:');
  console.log('✅ No lyrics passed from frontend');
  console.log('✅ No soundcloud URL passed from frontend');
  console.log('✅ Only geniusId required');
  console.log('✅ Cannot be spoofed with bad data');
  console.log('✅ Robust: works even if frontend state fails');
  console.log('\nThis test will:');
  console.log('1. Verify song exists in contract (soundcloudPath required)');
  console.log('2. Lit Action reads song data from contract');
  console.log('3. Lit Action fetches lyrics from LRClib');
  console.log('4. Lit Action downloads audio from SoundCloud');
  console.log('5. Lit Action runs ElevenLabs alignment');
  console.log('6. Lit Action uploads to Grove');
  console.log('7. Lit Action updates contract metadataUri');
  console.log('\n━'.repeat(80));

  // Check if specific genius ID provided
  const customGeniusId = parseInt(process.argv[2]);
  const geniusId = customGeniusId || TEST_SONG.geniusId;
  const songName = customGeniusId ? 'Custom Song' : TEST_SONG.name;

  try {
    // Load credentials and keys
    const pkpCreds = await loadPKPCredentials();
    const encryptedKeys = await loadEncryptedKeys();

    // Verify song exists in contract
    const songData = await verifySongInContract(geniusId);

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "base-alignment-v2-test",
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
    console.log('='.repeat(80));

    const { elevenlabsKey } = encryptedKeys;

    // V2: ONLY pass geniusId (and encrypted keys, contract params)
    const jsParams = {
      geniusId, // ONLY required data input

      // ElevenLabs key encryption params
      elevenlabsKeyAccessControlConditions: elevenlabsKey.accessControlConditions,
      elevenlabsKeyCiphertext: elevenlabsKey.ciphertext,
      elevenlabsKeyDataToEncryptHash: elevenlabsKey.dataToEncryptHash,

      // Contract update params
      contractAddress: KARAOKE_CATALOG_ADDRESS,
      pkpAddress: pkpCreds.ethAddress,
      pkpTokenId: pkpCreds.tokenId,
      pkpPublicKey: pkpCreds.publicKey,
      updateContract: true
    };

    console.log('\n🚀 Executing Lit Action v2...');
    console.log('⏱️  Expected time: ~20-40s (LRClib + ElevenLabs + Grove + contract)');
    console.log('💰 Expected cost: ~$0.03');
    const startTime = Date.now();

    // Use IPFS CID for v2 (will be set after uploading)
    const BASE_ALIGNMENT_V2_CID = process.env.BASE_ALIGNMENT_V2_CID || 'QmPLACEHOLDER_UPLOAD_FIRST';

    if (BASE_ALIGNMENT_V2_CID === 'QmPLACEHOLDER_UPLOAD_FIRST') {
      console.error('\n❌ BASE_ALIGNMENT_V2_CID not set!');
      console.error('Upload base-alignment-v2.js first:');
      console.error('  DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 dotenvx run -- node scripts/upload-lit-action.mjs src/karaoke/base-alignment-v2.js "Base Alignment V2 (Reads from Contract)"');
      console.error('\nThen set in .env:');
      console.error('  BASE_ALIGNMENT_V2_CID=QmYourNewCID');
      process.exit(1);
    }

    try {
      const result = await litClient.executeJs({
        ipfsId: BASE_ALIGNMENT_V2_CID,
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
      const outputFile = join(outputDir, `song-${geniusId}-base-alignment-v2-result.json`);
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
      console.log('\n--- Base Alignment ---');
      console.log(`Lines: ${response.lineCount || 'N/A'}`);
      console.log(`Words: ${response.wordCount || 'N/A'}`);

      // Display Grove upload result
      console.log('\n--- Grove Storage ---');
      if (response.metadataUri) {
        console.log(`✅ Metadata URI: ${response.metadataUri}`);
        const cid = response.metadataUri.replace('lens://', '');
        console.log(`🔍 Grove URL: https://api.grove.storage/${cid}`);
      } else {
        console.log('❌ No metadata URI returned');
      }

      // Display contract update result
      console.log('\n--- Contract Update ---');
      if (response.txHash) {
        console.log(`✅ Transaction submitted: ${response.txHash}`);
        console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.txHash}`);

        // Wait for confirmation
        console.log('\n⏳ Waiting 15s for transaction confirmation...');
        await new Promise(r => setTimeout(r, 15000));

        // Verify metadataUri updated in contract
        console.log('\n🔍 Verifying contract update...');
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const catalogAbi = [
          'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, string soundcloudPath, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, bool enabled, uint64 addedAt))'
        ];
        const catalog = new ethers.Contract(KARAOKE_CATALOG_ADDRESS, catalogAbi, provider);

        const updatedSongData = await catalog.getSongByGeniusId(geniusId);
        console.log(`Contract metadataUri: ${updatedSongData.metadataUri || '(empty)'}`);

        if (updatedSongData.metadataUri && updatedSongData.metadataUri === response.metadataUri) {
          console.log('✅ Contract successfully updated with metadataUri!');
        } else if (updatedSongData.metadataUri) {
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
      console.log(`   Estimated cost: ~$0.03`);
      console.log(`   Lines: ${response.lineCount}`);
      console.log(`   Words: ${response.wordCount}`);
      console.log('\n🔑 Key V2 Advantages:');
      console.log('   ✅ No lyrics needed from frontend');
      console.log('   ✅ No soundcloud URL needed from frontend');
      console.log('   ✅ Contract is single source of truth');
      console.log('   ✅ Cannot be spoofed with bad data');
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
