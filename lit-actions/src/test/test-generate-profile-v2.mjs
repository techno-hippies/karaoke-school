#!/usr/bin/env node

/**
 * Test Generate Artist Profile v2
 *
 * Tests the Lit Action that calls Render to generate artist profiles
 *
 * Usage:
 *   bun run src/test/test-generate-profile-v2.mjs [geniusArtistId]
 *
 * Examples:
 *   bun run src/test/test-generate-profile-v2.mjs 447      # Lady Gaga
 *   bun run src/test/test-generate-profile-v2.mjs 26369   # Madonna
 *   bun run src/test/test-generate-profile-v2.mjs 25000   # Random new artist
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Get artist ID from command line or use default
const geniusArtistId = parseInt(process.argv[2]) || 447; // Default: Lady Gaga

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Artist Profile Generator v2 - Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`🎤 Testing Genius Artist ID: ${geniusArtistId}`);
console.log('');

async function testGenerateProfile() {
  const startTime = Date.now();

  try {
    // 1. Set up Auth Manager
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

    // 2. Initialize Lit client
    console.log('📡 Connecting to Lit Network (Naga)...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network');
    console.log('');

    // 3. Create authentication context
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
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');
    console.log('');

    // 4. Load Lit Action code
    const litActionPath = path.resolve(__dirname, '../artist/generate-profile-v2.js');
    const litActionCode = fs.readFileSync(litActionPath, 'utf8');

    console.log('📝 Loaded Lit Action code');
    console.log(`   Path: ${litActionPath}`);
    console.log('');

    // 3. Execute Lit Action
    console.log('🚀 Executing Lit Action...');
    console.log('   This may take 15-30 seconds for new artists');
    console.log('   (PKP mint + Lens account + contract registration)');
    console.log('');

    const executeStartTime = Date.now();

    const result = await litClient.executeJs({
      code: litActionCode,
      authContext: authContext,
      jsParams: {
        geniusArtistId: geniusArtistId
      }
    });

    const executionTime = ((Date.now() - executeStartTime) / 1000).toFixed(2);

    console.log(`✅ Lit Action execution complete (${executionTime}s)`);
    console.log('');

    // 4. Parse response
    const response = JSON.parse(result.response);

    if (response.success) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ PROFILE GENERATED SUCCESSFULLY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      console.log(`🎤 Artist: ${response.artistName}`);
      console.log(`🆔 Genius ID: ${response.geniusArtistId}`);
      console.log(`📦 Source: ${response.source}`);
      console.log('');

      console.log('🔑 PKP Details:');
      console.log(`   Address: ${response.pkpAddress}`);
      if (response.pkpTokenId) {
        console.log(`   Token ID: ${response.pkpTokenId}`);
      }
      if (response.pkpMintTxHash) {
        console.log(`   Mint Tx: ${response.pkpMintTxHash}`);
        console.log(`   Explorer: https://yellowstone-explorer.litprotocol.com/tx/${response.pkpMintTxHash}`);
      }
      console.log('');

      console.log('👤 Lens Account:');
      console.log(`   Handle: ${response.lensHandle}`);
      console.log(`   Address: ${response.lensAccountAddress}`);
      if (response.lensTxHash) {
        console.log(`   Tx: ${response.lensTxHash}`);
      }
      console.log('');

      console.log('📝 Registry:');
      console.log(`   Contract: 0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7 (Base Sepolia)`);
      if (response.registryTxHash) {
        console.log(`   Tx: ${response.registryTxHash}`);
        console.log(`   Explorer: https://sepolia.basescan.org/tx/${response.registryTxHash}`);
      }
      console.log('');

      console.log('📹 Content Status:');
      console.log(`   Profile Ready: ${response.profileReady ? '✅' : '❌'}`);
      console.log(`   Videos Ready: ${response.hasContent ? '✅' : '⏳ Processing'}`);
      console.log(`   Content Generating: ${response.contentGenerating ? 'Yes (background)' : 'No'}`);

      if (response.alreadyRegistered) {
        console.log('   ⚠️  Already registered (returned cached data)');
      }
      console.log('');

      if (response.message) {
        console.log(`💬 ${response.message}`);
        console.log('');
      }

      if (response.nextSteps && response.nextSteps.length > 0) {
        console.log('📋 Next Steps:');
        response.nextSteps.forEach((step, idx) => {
          console.log(`   ${idx + 1}. ${step}`);
        });
        console.log('');
      }

      if (response.processing) {
        console.log('⏱️  Performance:');
        console.log(`   Total Time: ${response.processing.totalTime}s`);
        if (response.processing.renderResponse) {
          console.log(`   Render: ${response.processing.renderResponse}`);
        }
        console.log('');
      }

      if (response.renderService) {
        console.log('🔧 Render Service:');
        console.log(`   API: ${response.renderService.url}`);
        console.log(`   Health: ${response.renderService.healthCheck}`);
        console.log('');
      }

    } else {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ PROFILE GENERATION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('Error:', response.error);
      if (response.stack) {
        console.error('');
        console.error('Stack:', response.stack);
      }
      console.error('');
      process.exit(1);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ TEST COMPLETED (${totalTime}s total)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ TEST FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack:');
      console.error(error.stack);
    }
    console.error('');
    process.exit(1);
  }
}

testGenerateProfile();
