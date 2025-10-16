#!/usr/bin/env node

/**
 * Test Script for Artist Metadata v1 Lit Action
 *
 * Free action - no encrypted keys needed
 * Uses exposed Genius API key
 *
 * Flow:
 * 1. Fetch artist metadata from Genius
 * 2. Fetch top 10 songs by artist
 *
 * Expected time: ~2-5s (Genius API only)
 * Expected cost: $0 (free)
 *
 * Usage:
 *   bun run src/test/test-artist-v1.mjs
 *   bun run src/test/test-artist-v1.mjs [artist-id]
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

// Test artist (Taylor Swift)
const TEST_ARTIST = {
  artistId: 1177,
  name: 'Taylor Swift'
};

// Lit Action CID
const LIT_ACTION_CID = 'QmXgS2pLhSavsNBGa81atWqn3UHGciTDhasdQxsAx9f4bJ';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function runTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Artist Metadata v1 Lit Action Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Get artist ID from command line or use default
  const artistId = parseInt(process.argv[2]) || TEST_ARTIST.artistId;
  console.log(`🎤 Testing artist ID: ${artistId}`);
  console.log('');

  try {
    // Load PKP credentials
    const pkpData = await loadPKPCredentials();
    console.log('');

    // Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "artist-v1-test",
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
    console.log('🚀 Executing Artist Metadata Lit Action...');
    console.log(`   CID: ${LIT_ACTION_CID}`);
    console.log('');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext: authContext,
      jsParams: {
        artistId: artistId,
        includeTopSongs: true,
        userAddress: pkpData.ethAddress,
        sessionId: `test-${Date.now()}`
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
        console.log('📊 ARTIST METADATA');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log(`🎤 Name:      ${data.artist.name}`);
        console.log(`🆔 ID:        ${data.artist.id}`);
        console.log(`👥 Followers: ${data.artist.followers_count?.toLocaleString() || 'N/A'}`);
        console.log(`✅ Verified:  ${data.artist.is_verified ? 'Yes' : 'No'}`);
        console.log(`🌐 URL:       ${data.artist.url}`);

        if (data.artist.description) {
          console.log('');
          console.log('📝 Description:');
          console.log(`   ${data.artist.description.substring(0, 200)}...`);
        }

        if (data.artist.instagram_name) {
          console.log(`📸 Instagram: @${data.artist.instagram_name}`);
        }
        if (data.artist.twitter_name) {
          console.log(`🐦 Twitter:   @${data.artist.twitter_name}`);
        }

        if (data.topSongs && data.topSongs.length > 0) {
          console.log('');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`🎵 TOP SONGS (${data.topSongs.length})`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          data.topSongs.forEach((song, i) => {
            console.log(`${i + 1}. ${song.title}`);
            console.log(`   ID: ${song.id} | ${song.artist_names}`);
          });
        }

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TEST PASSED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
