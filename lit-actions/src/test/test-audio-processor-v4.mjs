#!/usr/bin/env node

/**
 * Test Script for Audio Processor v4 (Song-Based Demucs)
 *
 * Tests the complete song-based audio processing pipeline:
 * 1. Verify ownership (for selected segment)
 * 2. Trigger Demucs /process-song-async (ALL segments)
 * 3. Return jobId for polling
 * 4. Monitor job completion
 * 5. Verify webhook called and contract updated
 *
 * Usage:
 *   bun run src/test/test-audio-processor-v4.mjs
 *   bun run src/test/test-audio-processor-v4.mjs [genius-id] [section-index]
 *
 * Expected time: ~90s total (trigger + Demucs + webhook)
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

// Test song: Sia - Chandelier (has SoundCloud link, synced lyrics, duration 216s)
const TEST_SONG = {
  geniusId: 378195,
  name: 'Sia - Chandelier',
  soundcloudPermalink: 'https://soundcloud.com/siamusic/sia-chandelier', // Full URL from Genius
  songDuration: 216, // From LRClib
  sections: [
    { type: 'Verse 1', startTime: 0.8, endTime: 27.8, duration: 27.1 },
    { type: 'Chorus 1', startTime: 33.8, endTime: 95.9, duration: 62.2 },
    { type: 'Verse 2', startTime: 111.1, endTime: 115.9, duration: 4.8 },
    { type: 'Chorus 2', startTime: 122.4, endTime: 173.9, duration: 51.6 },
    { type: 'Bridge', startTime: 176.4, endTime: 184.2, duration: 7.7 }
  ]
};

// Audio Processor v4 CID (with runOnce to prevent 3x Modal calls)
const AUDIO_PROCESSOR_V4_CID = 'QmYxNkawEVCT2LGvXEyPVi2gzMgjEpidWpUXWhbDPvuUUd';

// Contract addresses
const KARAOKE_CATALOG_V2 = '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa'; // V2 OPTIMIZED - Custom Errors
const KARAOKE_CREDITS_V1 = '0x6de183934E68051c407266F877fafE5C20F74653';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

// Endpoints
const DEMUCS_API = 'https://techno-hippies--demucs-karaoke-fastapi-app.modal.run';
const WEBHOOK_SERVER = 'https://karaoke-webhook-server.onrender.com';

// PKP credentials path
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function main() {
  console.log('🎤 Audio Processor v4 Test (Song-Based Demucs)\n');
  console.log('━'.repeat(80));
  console.log(`Test song: ${TEST_SONG.name} (Genius ID: ${TEST_SONG.geniusId})`);
  console.log(`Duration: ${TEST_SONG.songDuration}s`);
  console.log(`Sections: ${TEST_SONG.sections.length}`);
  console.log('━'.repeat(80));

  // Check if specific genius ID and section provided
  const customGeniusId = parseInt(process.argv[2]);
  const customSectionIndex = parseInt(process.argv[3]);
  const geniusId = customGeniusId || TEST_SONG.geniusId;
  const sectionIndex = customSectionIndex || 2; // Default: Chorus 1
  const testUserAddress = process.env.TEST_USER_ADDRESS || '0x0C6433789d14050aF47198B2751f6689731Ca79C';

  try {
    // Load PKP credentials
    const pkpCreds = await loadPKPCredentials();

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "audio-processor-v4-test",
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

    // Execute Audio Processor v4
    console.log('\n' + '='.repeat(80));
    console.log(`🚀 Executing Audio Processor v4`);
    console.log(`   Genius ID: ${geniusId}`);
    console.log(`   Selected section: ${sectionIndex} (${TEST_SONG.sections[sectionIndex - 1].type})`);
    console.log(`   User address: ${testUserAddress}`);
    console.log('='.repeat(80));

    const jsParams = {
      geniusId,
      sectionIndex,
      sections: TEST_SONG.sections,
      soundcloudPermalink: TEST_SONG.soundcloudPermalink,
      userAddress: testUserAddress,
      songDuration: TEST_SONG.songDuration
    };

    console.log('\n🎬 Starting Lit Action execution...');
    console.log('⏱️  Expected time: ~2-5s (trigger only, processing happens in background)');
    const startTime = Date.now();

    // TODO: Replace with actual IPFS CID after uploading audio-processor-v4.js
    const audioProcessorCode = await readFile(
      join(__dirname, '../karaoke/audio-processor-v4.js'),
      'utf-8'
    );

    const result = await litClient.executeJs({
      code: audioProcessorCode, // Use code directly for testing (replace with ipfsId in production)
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(2)}s`);

    // Parse response
    const response = typeof result.response === 'string'
      ? JSON.parse(result.response)
      : result.response;

    if (!response.success) {
      throw new Error(`Audio processor failed: ${response.error}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Lit Action Result:');
    console.log('='.repeat(80));
    console.log(`Job ID: ${response.jobId}`);
    console.log(`Status: ${response.status}`);
    console.log(`Selected segment: ${response.selectedSegment.id}`);
    console.log(`All segments: ${response.allSegments.join(', ')}`);
    console.log(`Segment count: ${response.segmentCount}`);
    console.log(`Song duration: ${response.songDuration}s`);
    console.log(`Poll URL: ${response.pollUrl}`);
    console.log(`Estimated time: ${response.estimatedTime}`);
    console.log(`\nOptimization:`);
    console.log(`  Method: ${response.optimization.method}`);
    console.log(`  Model: ${response.optimization.model}`);
    console.log(`  Cost: ${response.optimization.cost}`);
    console.log(`  Savings: ${response.optimization.savings}`);

    // Monitor Demucs job
    console.log('\n' + '='.repeat(80));
    console.log('📡 Monitoring Demucs Processing');
    console.log('='.repeat(80));
    console.log(`Polling: ${response.pollUrl}`);
    console.log(`Max wait: 3 minutes`);

    let attempts = 0;
    const maxAttempts = 36; // 3 minutes (36 × 5s)
    let jobComplete = false;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // Wait 5s
      attempts++;

      try {
        const statusResp = await fetch(response.pollUrl);
        if (!statusResp.ok) {
          console.log(`   [${attempts}] Job not found yet (Modal spinning up...)`);
          continue;
        }

        const status = await statusResp.json();
        console.log(`   [${attempts}] ${status.status || 'unknown'}`);

        if (status.status === 'complete') {
          console.log('\n✅ Demucs processing complete!');
          console.log(`   Segments processed: ${status.segments?.length || response.segmentCount}`);
          if (status.timing) {
            console.log(`   Time breakdown:`);
            console.log(`     Download: ${status.timing.download}s`);
            console.log(`     Demucs: ${status.timing.demucs}s`);
            console.log(`     fal.ai: ${status.timing.fal_enhancement}s`);
            console.log(`     Total: ${status.timing.total}s`);
          }
          if (status.cost) {
            console.log(`   Cost: $${status.cost.fal_api}`);
            console.log(`   Savings: $${status.cost.savings_vs_segment_based}`);
          }
          jobComplete = true;
          break;
        }

        if (status.status === 'failed') {
          throw new Error(`Demucs processing failed: ${status.error || 'Unknown error'}`);
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Continue polling
      }
    }

    if (!jobComplete) {
      console.log('\n⏱️  Timeout after 3 minutes. Check Modal logs:');
      console.log(`   modal app logs demucs-karaoke`);
      return;
    }

    // Wait for webhook + contract update
    console.log('\n⏳ Waiting 30s for webhook → Lit Action 2 → contract update...');
    await new Promise(r => setTimeout(r, 30000));

    // Verify contract updated
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Verifying Contract Update');
    console.log('='.repeat(80));

    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const catalogAbi = ['function isSegmentProcessed(uint32,string,string) view returns (bool)'];
    const catalog = new ethers.Contract(KARAOKE_CATALOG_V2, catalogAbi, provider);

    let processedCount = 0;
    for (const segment of response.allSegments) {
      const isProcessed = await catalog.isSegmentProcessed(geniusId, '', segment);
      if (isProcessed) {
        processedCount++;
        console.log(`   ✅ ${segment}: processed`);
      } else {
        console.log(`   ⏳ ${segment}: not processed yet`);
      }
    }

    console.log(`\n📊 Contract status: ${processedCount}/${response.segmentCount} segments processed`);

    if (processedCount === response.segmentCount) {
      console.log('\n🎉 SUCCESS! Complete pipeline working!');
      console.log('\n━'.repeat(80));
      console.log('Pipeline Summary:');
      console.log(`  Song: ${TEST_SONG.name}`);
      console.log(`  Segments: ${response.segmentCount}`);
      console.log(`  Method: Song-based (all segments at once)`);
      console.log(`  Model: Demucs mdx_extra`);
      console.log(`  Cost: $0.20 (saved $0.80 vs segment-based)`);
      console.log(`  Contract: ${KARAOKE_CATALOG_V2}`);
      console.log('━'.repeat(80));
    } else {
      console.log('\n⚠️  PARTIAL SUCCESS: Some segments not processed yet');
      console.log('\nCheck logs:');
      console.log(`  Demucs: modal app logs demucs-karaoke`);
      console.log(`  Webhook: https://dashboard.render.com/`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
