#!/usr/bin/env node

/**
 * Test Script for Generate Artist Profile v1 - STEP 1
 *
 * Step 1: Fetch Genius artist data
 *
 * Flow:
 * 1. Fetch artist metadata from Genius API
 * 2. Validate data structure
 *
 * Expected time: ~1-3s (Genius API only)
 * Expected cost: $0 (free)
 *
 * Usage:
 *   bun run src/test/test-generate-profile-v1-step1.mjs [artist-id]
 *
 * Examples:
 *   bun run src/test/test-generate-profile-v1-step1.mjs 26369  # Madonna
 *   bun run src/test/test-generate-profile-v1-step1.mjs 16775  # Rihanna
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

// Test artist (Madonna - not yet in registry)
const TEST_ARTIST = {
  artistId: 26369,
  name: 'Madonna'
};

// Lit Action CID
const LIT_ACTION_CID = 'QmUNj6G6z5D2fd61GyWPHk3tR4YuWc8qZUeBUvkyhK3264';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function runTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Generate Artist Profile v1 - STEP 1 TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Get artist ID from command line or use default
  const artistId = parseInt(process.argv[2]) || TEST_ARTIST.artistId;
  console.log(`🎤 Testing artist ID: ${artistId}`);
  console.log('📋 Step: Fetch Genius artist data');
  console.log('');

  try {
    // Load PKP credentials
    const pkpData = await loadPKPCredentials();
    console.log('');

    // Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "generate-profile-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');
    console.log('');

    // Initialize Lit client
    console.log('🌐 Connecting to Lit Network (Naga)...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network');
    console.log('');

    // Create authentication context
    console.log('🔐 Creating authentication context...');
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
    console.log('');

    // Execute Lit Action
    console.log('🚀 Executing Generate Profile Lit Action (Step 1)...');
    console.log(`   CID: ${LIT_ACTION_CID}`);
    console.log('');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: {
        geniusArtistId: artistId,
      }
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Lit Action completed');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('');

    // Parse and display results
    if (result.response) {
      const data = JSON.parse(result.response);

      if (data.success) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ STEP 1 COMPLETE: Genius Data Fetched');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log(`🎤 Name:      ${data.artist.name}`);
        console.log(`🆔 ID:        ${data.artist.id}`);
        console.log(`👥 Followers: ${data.artist.followers_count?.toLocaleString() || 'N/A'}`);
        console.log(`✅ Verified:  ${data.artist.is_verified ? 'Yes' : 'No'}`);
        console.log(`🌐 URL:       ${data.artist.url}`);
        console.log(`🖼️  Image:     ${data.artist.image_url}`);

        if (data.artist.description) {
          const desc = data.artist.description;
          console.log('');
          console.log('📝 Description:');
          console.log(`   ${desc.length > 150 ? desc.substring(0, 150) + '...' : desc}`);
        }

        if (data.artist.instagram_name) {
          console.log(`📸 Instagram: @${data.artist.instagram_name}`);
        }
        if (data.artist.twitter_name) {
          console.log(`🐦 Twitter:   @${data.artist.twitter_name}`);
        }

        console.log('');
        console.log('📊 Metadata:');
        console.log(`   Step: ${data.step} (${data.stepName})`);
        console.log(`   Processing time: ${data.processingTimeMs}ms`);
        console.log(`   Version: ${data.version}`);

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TEST PASSED - Step 1 Complete');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📌 Next steps:');
        console.log('   - Step 2: Add PKP minting capability');
        console.log('   - Step 3: Add Lens account creation');
        console.log('   - Step 4: Add ArtistRegistryV2 registration');

      } else {
        console.log('❌ Lit Action returned error:');
        console.log(data.error);
        process.exit(1);
      }
    } else {
      console.log('❌ No response from Lit Action');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ TEST FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    console.error('');
    process.exit(1);
  }
}

runTest();
