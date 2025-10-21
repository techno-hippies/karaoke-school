#!/usr/bin/env bun
/**
 * Step 2: Fetch MLC Licensing Data
 *
 * Fetches mechanical licensing data from The MLC (Mechanical Licensing Collective)
 * Required for Story Protocol compliance (need ≥98% publisher share)
 *
 * Usage:
 *   bun songs/02-fetch-mlc-data.ts --genius-id 10047250
 *
 * Next Steps:
 *   Run 03-build-metadata.ts to create complete metadata JSON
 */

import { parseArgs } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { MLCDataSchema } from '../../lib/schemas/index.js';
import type { MLCData } from '../../lib/schemas/index.js';

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
  },
});

if (!values['genius-id']) {
  console.error('❌ Missing required argument');
  console.error('\nUsage:');
  console.error('  bun songs/02-fetch-mlc-data.ts --genius-id 10047250');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch MLC data using ISRC
 */
async function fetchMLCData(isrc: string, songTitle: string, artistName: string): Promise<MLCData | null> {
  console.log(`  Searching MLC database...`);
  console.log(`  ISRC: ${isrc}`);
  console.log(`  Title: ${songTitle}`);
  console.log(`  Artist: ${artistName}`);

  // Note: MLC doesn't have a public API - data must be manually looked up at:
  // https://portal.themlc.com/search
  //
  // For automation, you would need:
  // 1. MLC portal credentials
  // 2. Puppeteer/Playwright to scrape the portal
  // 3. Or partner with a music rights service (e.g., Loudr, DistroKid)

  console.log('\n  ⚠️  MLC data must be manually entered');
  console.log('  Visit: https://portal.themlc.com/search');
  console.log(`  Search by ISRC: ${isrc}`);
  console.log('\n  Enter the data below (or press Ctrl+C to skip):\n');

  // For now, return null (manual process)
  // In production, this would integrate with MLC API or scraper
  return null;
}

/**
 * Manual MLC data entry
 */
function promptManualMLCData(): MLCData {
  console.log('Enter MLC data (JSON format):');
  console.log('Example:');
  console.log(JSON.stringify({
    isrc: 'USRC17607839',
    mlcSongCode: 'TB46ND',
    iswc: 'T-345.246.800-1',
    writers: [
      { name: 'Beyoncé Knowles', ipi: '00246105805', role: 'Composer', share: 50 },
      { name: 'Terius Nash', ipi: '00346729988', role: 'Composer', share: 50 }
    ],
    publishers: [
      { name: 'Sony Music Publishing', ipi: '00026990329', share: 100, administrators: [] }
    ],
    totalPublisherShare: 100,
    storyMintable: true
  }, null, 2));

  // Note: In an interactive session, you'd use readline/prompts
  // For now, we'll just create a placeholder
  throw new Error('Manual MLC data entry not implemented - please add data directly to metadata file');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('📜 MLC Licensing Data Fetch\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Load existing metadata
    console.log(`Step 1: Loading metadata for song ${geniusId}...`);
    const metadataPath = path.join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);

    if (!existsSync(metadataPath)) {
      console.error(`❌ Metadata file not found: ${metadataPath}`);
      console.error('\nRun first:');
      console.error(`  bun songs/01-register-song.ts --genius-id ${geniusId} --genius-artist-id <id>`);
      process.exit(1);
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    console.log(`  ✓ Title: ${metadata.title}`);
    console.log(`  ✓ Artist: ${metadata.artist}`);

    // Step 2: Get ISRC from Spotify
    if (!metadata.spotify?.id) {
      console.error('\n❌ No Spotify ID found');
      console.error('Cannot fetch ISRC without Spotify metadata');
      console.error('\nPlease add Spotify ID manually to metadata file');
      process.exit(1);
    }

    console.log(`\nStep 2: Fetching ISRC from Spotify...`);
    console.log(`  Spotify ID: ${metadata.spotify.id}`);

    // Fetch Spotify track data (requires Spotify API credentials)
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.log('  ⚠️  Spotify credentials not found in .env');
      console.log('  Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to enable automatic ISRC fetch');
      console.log('\n  For now, please add ISRC manually to metadata file');
      console.log('  You can find it at: https://open.spotify.com/track/' + metadata.spotify.id);
      process.exit(0);
    }

    // Get Spotify access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error(`Spotify auth failed: ${tokenResponse.status}`);
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    // Fetch track data
    const trackResponse = await fetch(
      `https://api.spotify.com/v1/tracks/${metadata.spotify.id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!trackResponse.ok) {
      throw new Error(`Spotify API error: ${trackResponse.status}`);
    }

    const trackData = (await trackResponse.json()) as any;
    const isrc = trackData.external_ids?.isrc;

    if (!isrc) {
      console.error('\n❌ No ISRC found in Spotify metadata');
      process.exit(1);
    }

    console.log(`  ✓ ISRC: ${isrc}`);

    // Step 3: Fetch MLC data
    console.log(`\nStep 3: Fetching MLC licensing data...`);
    const mlcData = await fetchMLCData(isrc, metadata.title, metadata.artist);

    if (!mlcData) {
      console.log('\n⚠️  MLC data fetch skipped');
      console.log('\nManual steps:');
      console.log('  1. Visit https://portal.themlc.com/search');
      console.log(`  2. Search by ISRC: ${isrc}`);
      console.log('  3. Copy MLC Song Code, ISWC, writers, and publishers');
      console.log(`  4. Add to: ${metadataPath}`);
      console.log('\n  Example structure:');
      console.log('  "licensing": {');
      console.log(`    "isrc": "${isrc}",`);
      console.log('    "mlcSongCode": "TB46ND",');
      console.log('    "iswc": "T-345.246.800-1",');
      console.log('    "writers": [...],');
      console.log('    "publishers": [...],');
      console.log('    "totalPublisherShare": 100,');
      console.log('    "storyMintable": true');
      console.log('  }');
      console.log('\nThen run:');
      console.log(`  bun songs/03-build-metadata.ts --genius-id ${geniusId}`);
      return;
    }

    // Step 4: Validate with Zod
    console.log(`\nStep 4: Validating MLC data...`);
    const validatedData = MLCDataSchema.parse(mlcData);

    console.log(`  ✓ ISRC: ${validatedData.isrc}`);
    console.log(`  ✓ MLC Song Code: ${validatedData.mlcSongCode}`);
    console.log(`  ✓ ISWC: ${validatedData.iswc}`);
    console.log(`  ✓ Writers: ${validatedData.writers.length}`);
    console.log(`  ✓ Publishers: ${validatedData.publishers.length}`);
    console.log(`  ✓ Total Publisher Share: ${validatedData.totalPublisherShare}%`);
    console.log(`  ✓ Story Protocol Mintable: ${validatedData.storyMintable ? 'Yes' : 'No'}`);

    if (!validatedData.storyMintable) {
      console.log('\n⚠️  Warning: Publisher share < 98%');
      console.log('  Story Protocol requires ≥98% publisher share for derivative works');
    }

    // Step 5: Update metadata file
    console.log(`\nStep 5: Updating metadata file...`);
    metadata.licensing = validatedData;
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`  ✓ Updated: ${metadataPath}`);

    // Success
    console.log('\n✅ MLC licensing data added!\n');
    console.log('Next step:');
    console.log(`  bun songs/03-build-metadata.ts --genius-id ${geniusId}`);
    console.log();
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
