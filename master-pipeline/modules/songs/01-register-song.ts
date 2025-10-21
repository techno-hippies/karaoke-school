#!/usr/bin/env bun
/**
 * Step 1: Register Song on Blockchain
 *
 * Fetches song metadata from Genius API and registers in SongRegistryV1
 *
 * Usage:
 *   bun songs/01-register-song.ts --genius-id 10047250 --genius-artist-id 498
 *
 * Next Steps:
 *   1. Run 02-fetch-mlc-data.ts to fetch licensing data
 *   2. Run 03-build-metadata.ts to create complete metadata JSON
 */

import { parseArgs } from 'util';
import { songExists, registerSong } from '../../lib/contracts.js';
import { requireEnv } from '../../lib/config.js';
import { mkdir } from 'fs/promises';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'genius-artist-id': { type: 'string' },
  },
});

if (!values['genius-id'] || !values['genius-artist-id']) {
  console.error('❌ Missing required arguments');
  console.error('\nUsage:');
  console.error('  bun songs/01-register-song.ts \\');
  console.error('    --genius-id 10047250 \\');
  console.error('    --genius-artist-id 498');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const geniusArtistId = parseInt(values['genius-artist-id']!);

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🎵 Song Registration\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Check if song already registered
    console.log(`Step 1: Checking if song ${geniusId} exists...`);
    const exists = await songExists(geniusId);

    if (exists) {
      console.log('⚠️  Song already registered on blockchain');
      console.log('\nTo update metadata, run:');
      console.log(`  bun songs/03-build-metadata.ts --genius-id ${geniusId}`);
      return;
    }

    // Step 2: Fetch song data from Genius
    console.log(`\nStep 2: Fetching song data from Genius...`);
    const GENIUS_API_KEY = requireEnv('GENIUS_API_KEY');

    const geniusResponse = await fetch(
      `https://api.genius.com/songs/${geniusId}?access_token=${GENIUS_API_KEY}`
    );

    if (!geniusResponse.ok) {
      throw new Error(`Genius API error: ${geniusResponse.status}`);
    }

    const geniusData = (await geniusResponse.json()) as any;
    const song = geniusData.response.song;

    console.log(`  ✓ Title: ${song.title}`);
    console.log(`  ✓ Artist: ${song.primary_artist.name}`);
    console.log(`  ✓ Album: ${song.album?.name || 'N/A'}`);

    // Step 3: Extract Spotify ID
    console.log(`\nStep 3: Extracting Spotify ID...`);
    const spotifyMedia = song.media?.find((m: any) => m.provider === 'spotify');
    const spotifyUrl = spotifyMedia?.url || '';
    const spotifyId = spotifyUrl ? spotifyUrl.split('/track/')[1]?.split('?')[0] || '' : '';

    if (spotifyId) {
      console.log(`  ✓ Spotify ID: ${spotifyId}`);
    } else {
      console.log('  ⚠️  No Spotify ID found (will use empty string)');
    }

    // Step 4: Extract TikTok Music ID (if available)
    console.log(`\nStep 4: Extracting TikTok Music ID...`);
    // Note: This would come from TikTok URL matching later
    const tiktokMusicId = '';
    console.log('  ⚠️  No TikTok Music ID yet (will be added during segment processing)');

    // Step 5: Register on blockchain
    console.log(`\nStep 5: Registering song on blockchain...`);

    const onchainData = await registerSong({
      geniusId,
      geniusArtistId,
      spotifyId,
      tiktokMusicId,
      title: song.title,
      artist: song.primary_artist.name,
      duration: 1, // Placeholder - will be updated from LRCLib or actual audio file
      coverUri: song.song_art_image_url, // Reference only, not Grove URI yet
      metadataUri: '', // Will be set after building metadata
      copyrightFree: false, // Will be determined from MLC data
    });

    // Step 6: Save initial metadata
    console.log(`\nStep 6: Saving initial metadata...`);
    const dataDir = path.join(process.cwd(), 'data', 'metadata');
    await mkdir(dataDir, { recursive: true });

    const metadataPath = path.join(dataDir, `${geniusId}.json`);
    const initialMetadata = {
      version: '1.0.0',
      geniusId,
      title: song.title,
      artist: song.primary_artist.name,
      album: song.album?.name || null,
      duration: 1, // Placeholder - will be updated from LRCLib
      coverUri: song.song_art_image_url,
      spotify: spotifyId ? { id: spotifyId, url: spotifyUrl } : undefined,
      licensing: null, // Step 2: Fetch MLC data
      lyrics: null, // Step 3: LRCLib reference only (no full lyrics)
      segments: [], // Step 4: Populated when segments registered
      createdAt: new Date().toISOString(),
      blockchain: onchainData, // Blockchain registration data
    };

    writeFileSync(metadataPath, JSON.stringify(initialMetadata, null, 2));
    console.log(`  ✓ Saved to: ${metadataPath}`);

    // Success
    console.log('\n✅ Song registered successfully!\n');
    console.log('Next steps:');
    console.log(`  1. bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}`);
    console.log(`  2. bun songs/03-build-metadata.ts --genius-id ${geniusId}`);
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
