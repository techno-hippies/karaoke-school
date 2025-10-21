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
    'iswc': { type: 'string' }, // Optional: Manual ISWC for robust MLC search
    'mlc-song-code': { type: 'string' }, // Optional: Manual MLC song code (for new releases)
  },
});

if (!values['genius-id']) {
  console.error('❌ Missing required argument');
  console.error('\nUsage:');
  console.error('  bun songs/02-fetch-mlc-data.ts --genius-id 10047250 [--iswc T3135677504] [--mlc-song-code AD3CCC]');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch MLC work by song code (via title+writer search)
 */
async function fetchWorkByCode(songCode: string, songTitle: string, artistName: string): Promise<any | null> {
  const searchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works?page=0&size=50';

  try {
    // Search by title and writer name
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: songTitle,
        writerFullNames: artistName,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    const works = data.content || [];

    // Find work with matching song code
    const matchedWork = works.find((w: any) => w.songCode === songCode);
    return matchedWork || null;
  } catch {
    return null;
  }
}

/**
 * Convert MLC API work response to our schema
 */
function convertMLCWork(work: any, isrc: string): MLCData {
  // Calculate total publisher shares (direct + administrator)
  let directShare = 0;
  let adminShare = 0;

  for (const pub of work.originalPublishers || []) {
    directShare += pub.publisherShare || 0;
    for (const admin of pub.administratorPublishers || []) {
      adminShare += admin.publisherShare || 0;
    }
  }

  const totalShare = directShare + adminShare;
  const storyMintable = totalShare >= 98 && work.writers.length > 0;

  return {
    isrc,
    mlcSongCode: work.songCode,
    iswc: work.iswc || '',
    writers: work.writers.map((w: any) => ({
      name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown',
      ipi: w.ipiNumber || null,
      role: w.roleCode === 11 ? 'Composer' : 'Writer',
      share: w.writerShare || 0,
    })),
    publishers: work.originalPublishers.map((p: any) => ({
      name: p.publisherName,
      ipi: p.ipiNumber || '',
      share: p.publisherShare || 0,
      administrators: (p.administratorPublishers || []).map((a: any) => ({
        name: a.publisherName,
        ipi: a.ipiNumber || '',
        share: a.publisherShare || 0,
      })),
    })),
    totalPublisherShare: totalShare,
    storyMintable,
  };
}

/**
 * Check if a work's recordings include the target ISRC
 */
async function workHasISRC(songCode: string, targetIsrc: string): Promise<boolean> {
  const recordingsUrl = `https://api.ptl.themlc.com/api/dsp-recording/matched/${songCode}?page=1&limit=10&order=matchedAmount&direction=desc`;

  try {
    const response = await fetch(recordingsUrl, {
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://portal.themlc.com',
        'Referer': 'https://portal.themlc.com/',
      },
    });

    if (!response.ok) return false;

    const data = await response.json() as any;
    const recordings = data.recordings || [];

    // Check if any recording has our ISRC
    return recordings.some((r: any) => r.isrc === targetIsrc);
  } catch {
    return false;
  }
}

/**
 * Fetch MLC data using ISRC matching via recordings endpoint
 */
async function fetchMLCData(isrc: string, songTitle: string, artistName: string, iswc?: string, mlcSongCode?: string): Promise<MLCData | null> {
  console.log(`  Searching MLC database...`);
  console.log(`  ISRC: ${isrc}`);
  console.log(`  Title: ${songTitle}`);

  const searchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works';

  // Strategy 0: Try manual MLC song code first (for new releases)
  if (mlcSongCode) {
    console.log(`  🔍 Fetching work by MLC song code: ${mlcSongCode}...`);
    const work = await fetchWorkByCode(mlcSongCode, songTitle, artistName);

    if (work) {
      console.log(`  ✓ Found by song code: ${work.title} (${work.songCode})`);

      // Check if work has matched recordings
      const hasRecordings = await workHasISRC(work.songCode, isrc);
      if (!hasRecordings) {
        console.log(`  ⚠️  No matched recordings yet (song too new)`);
        console.log(`  ✓ Using MLC data anyway (ISRC will link later)`);
      }

      return convertMLCWork(work, isrc);
    } else {
      console.log(`  ❌ Work not found for song code: ${mlcSongCode}`);
      console.log(`     Searched by title: "${songTitle}" + writer: "${artistName}"`);
    }
  }

  // Strategy 1: Try ISWC search (most accurate, if provided)
  if (iswc) {
    console.log(`  🔍 Trying ISWC search...`);
    const iswcResponse = await fetch(`${searchUrl}?page=0&size=50`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ iswc }),
    });

    if (iswcResponse.ok) {
      const iswcData = await iswcResponse.json() as any;
      if (iswcData.content && iswcData.content.length > 0) {
        const work = iswcData.content[0];
        console.log(`  ✓ Found by ISWC: ${work.title} (${work.songCode})`);
        return convertMLCWork(work, isrc);
      }
    }
  }

  // Strategy 2: Search by title, then check recordings for ISRC match
  console.log(`  🔍 Searching by title...`);

  let page = 0;
  const maxPages = 10; // Limit search to first 500 results (10 pages × 50)

  while (page < maxPages) {
    const searchResponse = await fetch(`${searchUrl}?page=${page}&size=50`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: songTitle }),
    });

    if (!searchResponse.ok) {
      console.log(`  ❌ MLC search failed: ${searchResponse.status}`);
      return null;
    }

    const searchData = await searchResponse.json() as any;
    const works = searchData.content || [];

    console.log(`  ✓ Page ${page + 1}: Found ${works.length} works`);

    // Check each work's recordings for ISRC match
    for (const work of works) {
      const hasMatch = await workHasISRC(work.songCode, isrc);

      if (hasMatch) {
        console.log(`  ✓ Matched ISRC in work: ${work.title} (${work.songCode})`);
        return convertMLCWork(work, isrc);
      }
    }

    // Check if there are more pages
    if (page + 1 >= searchData.totalPages || works.length === 0) {
      break;
    }

    page++;
  }

  console.log(`  ⚠️  No work found with ISRC ${isrc}`);
  return null;
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
    const mlcData = await fetchMLCData(isrc, metadata.title, metadata.artist, values.iswc, values['mlc-song-code']);

    if (!mlcData) {
      console.log('\n⚠️  MLC data not found');
      console.log(`\nNo MLC work matched ISRC: ${isrc}`);
      console.log('\nOptions:');
      console.log('  1. Search manually at: https://portal.themlc.com/search');
      console.log(`     - Search by: "${metadata.title}" by "${metadata.artist}"`);
      console.log(`     - Look for MLC Song Code (format: AD3CCC) or ISWC (format: T1234567890)`);
      console.log(`     - Re-run with: --mlc-song-code <CODE> or --iswc <ISWC>`);
      console.log('  2. Song may be too new or not registered with MLC');
      console.log('  3. Continue without licensing data (skip Story Protocol)');
      console.log('\nTo add manually, edit:');
      console.log(`  ${metadataPath}`);
      process.exit(0);
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
