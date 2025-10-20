#!/usr/bin/env node

/**
 * Test Script for Artist Profile Generation
 *
 * Tests the /generate-artist-profile endpoint locally
 *
 * Usage:
 *   node test-generate.mjs [artist-id]
 *
 * Examples:
 *   node test-generate.mjs 26369   # Madonna
 *   node test-generate.mjs 16775   # Rihanna
 *   node test-generate.mjs 447     # Lady Gaga
 */

import fetch from 'node-fetch';

// Test artist (default: Madonna)
const DEFAULT_ARTIST_ID = 26369;

// Service URL (change if testing deployed version)
const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';

async function testGenerate(geniusArtistId) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Artist Profile Generation Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`🎤 Genius Artist ID: ${geniusArtistId}`);
  console.log(`🌐 Service URL: ${SERVICE_URL}`);
  console.log('');

  try {
    // Health check first
    console.log('🏥 Checking service health...');
    const healthResponse = await fetch(`${SERVICE_URL}/health`);
    const health = await healthResponse.json();

    if (health.status !== 'healthy') {
      console.error('❌ Service is not healthy:');
      console.error(JSON.stringify(health, null, 2));
      process.exit(1);
    }

    console.log('✅ Service is healthy');
    console.log('');

    // Generate profile
    console.log('🚀 Generating artist profile...');
    console.log('⏱️  This may take 1-2 minutes (PKP mint + Lens account + indexing)');
    console.log('');

    const startTime = Date.now();

    const response = await fetch(`${SERVICE_URL}/generate-artist-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        geniusArtistId,
      }),
    });

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      console.error('❌ Generation failed:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    if (result.success) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ PROFILE GENERATED SUCCESSFULLY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`🎤 Artist: ${result.artistName}`);
      console.log(`🆔 Genius ID: ${result.geniusArtistId}`);
      console.log('');
      console.log('🔑 PKP Details:');
      console.log(`   Address: ${result.pkpAddress}`);
      console.log(`   Token ID: ${result.pkpTokenId}`);
      console.log(`   Tx: ${result.pkpMintTxHash}`);
      console.log(`   Explorer: https://yellowstone-explorer.litprotocol.com/tx/${result.pkpMintTxHash}`);
      console.log('');
      console.log('👤 Lens Account:');
      console.log(`   Handle: ${result.lensHandle}`);
      console.log(`   Address: ${result.lensAccountAddress}`);
      console.log(`   Tx: ${result.lensTxHash}`);
      console.log('');
      console.log('📝 Registry:');
      console.log(`   Contract: ${process.env.ARTIST_REGISTRY_ADDRESS || '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7'}`);
      console.log(`   Tx: ${result.registryTxHash}`);
      console.log(`   Source: ${result.source}`);

      if (result.alreadyRegistered) {
        console.log('   ⚠️  Already registered (returned existing data)');
      }

      console.log('');
      console.log(`⏱️  Total Duration: ${duration}s`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ TEST PASSED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

    } else {
      console.error('❌ Generation returned failure:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

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

// Get artist ID from command line or use default
const artistId = parseInt(process.argv[2]) || DEFAULT_ARTIST_ID;

testGenerate(artistId);
