#!/usr/bin/env bun
/**
 * Add Video Segment - Complete Automation Workflow
 *
 * Zero-manual-work pipeline for adding TikTok videos to the platform.
 * This script automates the entire flow from a TikTok video URL to blockchain registration.
 *
 * What it does:
 * 1. Parses TikTok video URL → extracts Spotify track ID
 * 2. Maps Spotify → Genius (gets song ID + artist ID)
 * 3. Checks if song exists on blockchain, registers if not
 * 4. Checks if segment exists locally, creates/processes if not
 * 5. Registers segment on blockchain
 *
 * Usage:
 *   bun workflows/add-video-segment.ts \
 *     --tiktok-video-url "https://www.tiktok.com/@brookemonk/video/7435941517896199454"
 *
 * Example (Brooke Monk dancing to Anti-Hero):
 *   bun workflows/add-video-segment.ts \
 *     --tiktok-video-url "https://www.tiktok.com/@brookemonk/video/7435941517896199454"
 *
 * Options:
 *   --tiktok-video-url    TikTok video URL (required)
 *   --skip-song-check     Skip checking if song exists (assume it does)
 *   --skip-registration   Skip blockchain registration (just process locally)
 *   --min-confidence      Minimum Genius match confidence (default: 0.70)
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getTikTokVideoData } from '../lib/tiktok-video-parser';
import { SpotifyGeniusMatcher } from '../lib/spotify-genius-mapper';
import { graphClient } from '../lib/graphql-client';
import { gql } from 'graphql-request';

const execAsync = promisify(exec);

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  options: {
    'tiktok-video-url': { type: 'string' },
    'skip-song-check': { type: 'boolean', default: false },
    'skip-registration': { type: 'boolean', default: false },
    'min-confidence': { type: 'string', default: '0.70' },
  },
});

if (!values['tiktok-video-url']) {
  console.error('❌ Missing required argument: --tiktok-video-url');
  console.error('\nUsage:');
  console.error('  bun workflows/add-video-segment.ts \\');
  console.error('    --tiktok-video-url "https://www.tiktok.com/@brookemonk/video/..."');
  console.error('\nOptions:');
  console.error('  --skip-song-check      Skip checking if song exists');
  console.error('  --skip-registration    Skip blockchain registration');
  console.error('  --min-confidence       Minimum Genius match confidence (default: 0.70)');
  process.exit(1);
}

const tiktokVideoUrl = values['tiktok-video-url']!;
const skipSongCheck = values['skip-song-check'] || false;
const skipRegistration = values['skip-registration'] || false;
const minConfidence = parseFloat(values['min-confidence'] || '0.70');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find segment hash for a given genius ID and TikTok music ID
 */
function findSegmentHash(geniusId: number, tiktokMusicId: string): string | null {
  const segmentsDir = join(process.cwd(), 'data', 'segments');

  if (!existsSync(segmentsDir)) return null;

  const segmentHashes = readdirSync(segmentsDir);

  for (const hash of segmentHashes) {
    const manifestPath = join(segmentsDir, hash, 'manifest.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (
        manifest.geniusId === geniusId &&
        manifest.tiktokMusicId === tiktokMusicId
      ) {
        return hash;
      }
    } catch (error) {
      // Invalid manifest, skip
      continue;
    }
  }

  return null;
}

/**
 * Get TikTok music URL from video metadata
 */
function getTikTokMusicUrl(tiktokVideoData: any): string | null {
  const musicId = tiktokVideoData.music.id;
  const musicTitle = tiktokVideoData.music.title;

  if (!musicId) return null;

  // Build TikTok music URL
  // Format: https://www.tiktok.com/music/{slug}-{id}
  const slug = musicTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `https://www.tiktok.com/music/${slug}-${musicId}`;
}

// ============================================================================
// Main Workflow
// ============================================================================

async function main() {
  console.log('\n🎬 Add Video Segment - Complete Automation Workflow');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // ========================================================================
    // Step 1: Parse TikTok Video → Extract Spotify Track ID
    // ========================================================================

    console.log('Step 1: Parsing TikTok video...');
    console.log(`  URL: ${tiktokVideoUrl}\n`);

    const tiktokData = await getTikTokVideoData(tiktokVideoUrl);

    console.log(`  ✓ Video ID: ${tiktokData.videoId}`);
    console.log(`  ✓ Music: ${tiktokData.music.title} by ${tiktokData.music.authorName}`);

    if (!tiktokData.music.spotifyTrackId) {
      console.error('\n❌ Error: No Spotify track ID found in TikTok video');
      console.error('   This video may not have a linked Spotify track.');
      console.error('   Please try a different video or add manually using genius-id.');
      process.exit(1);
    }

    console.log(`  ✓ Spotify Track ID: ${tiktokData.music.spotifyTrackId}`);
    console.log(`  ✓ Spotify URL: ${tiktokData.music.spotifyUrl}\n`);

    // ========================================================================
    // Step 2: Map Spotify → Genius (Song ID + Artist ID)
    // ========================================================================

    console.log('Step 2: Mapping Spotify → Genius...\n');

    const matcher = new SpotifyGeniusMatcher();
    const match = await matcher.matchSpotifyToGenius(
      tiktokData.music.spotifyTrackId,
      minConfidence
    );

    if (!match) {
      console.error('\n❌ Error: Could not match Spotify track to Genius song');
      console.error(`   Spotify: ${tiktokData.music.title} by ${tiktokData.music.authorName}`);
      console.error('   Try lowering --min-confidence or add manually using genius-id.');
      process.exit(1);
    }

    console.log(`\n✅ Match found!`);
    console.log(`   Genius ID: ${match.geniusId}`);
    console.log(`   Artist ID: ${match.geniusArtistId || 'N/A'}`);
    console.log(`   Title: ${match.geniusData.title}`);
    console.log(`   Artist: ${match.geniusData.artist}`);
    console.log(
      `   Confidence: ${(match.confidence * 100).toFixed(1)}% (${match.matchType})`
    );
    console.log(`   URL: ${match.geniusData.url}\n`);

    const geniusId = match.geniusId;
    const geniusArtistId = match.geniusArtistId;

    if (!geniusArtistId) {
      console.warn('⚠️  Warning: No artist ID found. Song will be registered without artist link.');
      console.warn('   You can add the artist later using modules/artists/ scripts.\n');
    }

    // ========================================================================
    // Step 3: Check if Song Exists → Register if Not
    // ========================================================================

    if (!skipSongCheck) {
      console.log('Step 3: Checking if song exists on blockchain...\n');

      // Query The Graph to check if song exists
      const SONG_EXISTS_QUERY = gql`
        query CheckSongExists($geniusId: BigInt!) {
          songs(where: { geniusId: $geniusId }) {
            id
            geniusId
            metadataUri
            geniusArtistId
          }
        }
      `;

      const result = await graphClient.request<{ songs: any[] }>(
        SONG_EXISTS_QUERY,
        { geniusId: geniusId.toString() }
      );

      const exists = result.songs.length > 0;

      if (exists) {
        console.log('  ✓ Song already registered on blockchain');

        // Check if local metadata exists, fetch from Grove if not
        const localMetadataPath = join(process.cwd(), 'data', 'songs', `${geniusId}.json`);
        if (!existsSync(localMetadataPath)) {
          console.log('  ℹ️  Local metadata not found, fetching from Grove...\n');

          try {
            const song = result.songs[0];
            const metadataUri = song.metadataUri;

            // Fetch metadata from Grove
            const groveHash = metadataUri.replace('lens://', '');
            const groveUrl = `https://api.grove.storage/${groveHash}`;
            const metadataResponse = await fetch(groveUrl);

            if (!metadataResponse.ok) {
              throw new Error(`Failed to fetch from Grove: ${metadataResponse.status}`);
            }

            const metadata = await metadataResponse.json();

            // Add Spotify ID if we have it and it's missing from metadata
            if (tiktokData.music.spotifyTrackId && !metadata.spotifyId) {
              metadata.spotifyId = tiktokData.music.spotifyTrackId;
            }

            // Save locally
            const dataDir = join(process.cwd(), 'data', 'songs');
            mkdirSync(dataDir, { recursive: true });
            writeFileSync(localMetadataPath, JSON.stringify(metadata, null, 2));

            console.log(`  ✓ Metadata saved locally\n`);
          } catch (error: any) {
            console.error(`  ❌ Failed to fetch metadata: ${error.message}`);
            console.error('  Please run song registration manually with --spotify-id\n');
            process.exit(1);
          }
        } else {
          console.log('  ✓ Local metadata found\n');
        }
      } else {
        console.log('  ℹ️  Song not found. Registering...\n');

        if (!geniusArtistId) {
          console.error('❌ Error: Cannot register song without artist ID');
          console.error('   The Genius API did not return an artist ID for this song.');
          console.error('   Please manually register using:');
          console.error(
            `     bun modules/songs/01-register-song.ts --genius-id ${geniusId} --genius-artist-id <artist_id>`
          );
          process.exit(1);
        }

        const spotifyArg = tiktokData.music.spotifyTrackId
          ? ` --spotify-id ${tiktokData.music.spotifyTrackId}`
          : '';
        const registerCmd = `bun modules/songs/01-register-song.ts --genius-id ${geniusId} --genius-artist-id ${geniusArtistId}${spotifyArg}`;
        console.log(`  → Running: ${registerCmd}\n`);

        try {
          const { stdout } = await execAsync(registerCmd);
          console.log(stdout);
          console.log('  ✓ Song registered successfully\n');
        } catch (error: any) {
          console.error('❌ Error registering song:', error.message);
          process.exit(1);
        }
      }
    } else {
      console.log('Step 3: Skipping song check (--skip-song-check)\n');
    }

    // ========================================================================
    // Step 4: Get TikTok Music URL for Segment Processing
    // ========================================================================

    console.log('Step 4: Building TikTok music URL...\n');

    const tiktokMusicUrl = getTikTokMusicUrl(tiktokData);

    if (!tiktokMusicUrl) {
      console.error('❌ Error: Could not build TikTok music URL');
      console.error('   Missing music ID in video data');
      process.exit(1);
    }

    console.log(`  ✓ TikTok Music URL: ${tiktokMusicUrl}\n`);

    // ========================================================================
    // Step 5: Check if Segment Exists → Create/Process if Not
    // ========================================================================

    console.log('Step 5: Checking if segment exists locally...\n');

    const segmentHash = findSegmentHash(geniusId, tiktokData.music.id);

    if (segmentHash) {
      console.log(`  ✓ Segment already exists: ${segmentHash}\n`);

      // V2 Architecture: Segment already registered via events
      if (!skipRegistration) {
        console.log('Step 6: Segment registration (V2)...\n');
        console.log('  ✓ Segment already registered via events during initial processing');
        console.log('  ✓ The Graph indexed SegmentRegistered and SegmentProcessed events\n');
      } else {
        console.log('Step 6: Skipping registration (--skip-registration)\n');
      }
    } else {
      console.log('  ℹ️  Segment not found. Creating and processing...\n');

      const processCmd =
        `bun modules/segments/01-match-and-process.ts ` +
        `--genius-id ${geniusId} ` +
        `--tiktok-url "${tiktokMusicUrl}"`;

      console.log(`  → Running: ${processCmd}\n`);

      try {
        const { stdout } = await execAsync(processCmd);
        console.log(stdout);
        console.log('  ✓ Segment created and processed successfully\n');

        // Find the newly created segment
        const newSegmentHash = findSegmentHash(geniusId, tiktokData.music.id);

        if (!newSegmentHash) {
          console.error('❌ Error: Segment was created but could not be found');
          process.exit(1);
        }

        console.log(`  ✓ Segment hash: ${newSegmentHash}\n`);

        // V2 Architecture: Events already emitted by segment processor
        if (!skipRegistration) {
          console.log('Step 6: Segment registration (V2)...\n');
          console.log('  ✓ Events already emitted by segment processor (Step 10)');
          console.log('  ✓ The Graph will index SegmentRegistered and SegmentProcessed events\n');
        } else {
          console.log('Step 6: Skipping registration (--skip-registration)\n');
        }
      } catch (error: any) {
        console.error('❌ Error processing segment:', error.message);
        process.exit(1);
      }
    }

    // ========================================================================
    // Success!
    // ========================================================================

    console.log('════════════════════════════════════════════════════════════');
    console.log('✨ Video Segment Added Successfully!\n');
    console.log('Summary:');
    console.log(`  • Genius ID: ${geniusId}`);
    console.log(`  • Song: ${match.geniusData.title} by ${match.geniusData.artist}`);
    console.log(`  • TikTok Video: ${tiktokData.videoUrl}`);
    console.log(`  • Spotify: ${match.spotifyData.name} by ${match.spotifyData.artists.join(', ')}`);
    if (match.spotifyData.isrc) {
      console.log(`  • ISRC: ${match.spotifyData.isrc}`);
    }
    console.log('\nNext Steps:');
    console.log('  1. View on frontend: http://localhost:5173/song/' + geniusId);
    console.log('  2. Play segment: http://localhost:5173/song/' + geniusId + '/play');
    console.log('  3. View artist page: http://localhost:5173/u/<artist_username>\n');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
