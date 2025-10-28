#!/usr/bin/env bun
/**
 * Step 1: Register Song on Blockchain (V2)
 *
 * Fetches song metadata from Genius API, uploads to Grove, and emits event
 *
 * Usage:
 *   bun songs/01-register-song.ts --genius-id 10047250 --genius-artist-id 498
 *
 * Next Steps:
 *   1. Run 02-fetch-mlc-data.ts to fetch licensing data
 *   2. Run 03-build-metadata.ts to create complete metadata JSON
 */

import { parseArgs } from 'util';
import { requireEnv } from '../../lib/config.js';
import { mkdir } from 'fs/promises';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { graphClient, SUBGRAPH_URL } from '../../lib/graphql-client.js';
import { gql } from 'graphql-request';
import { emitSongRegistered } from '../../lib/event-emitter.js';
import { initGroveClient, createLensWalletClient } from '../../lib/lens.js';

// ============================================================================
// CLI Arguments
// ============================================================================

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'genius-artist-id': { type: 'string' },
    'spotify-id': { type: 'string' },
  },
});

if (!values['genius-id'] || !values['genius-artist-id']) {
  console.error('❌ Missing required arguments');
  console.error('\nUsage:');
  console.error('  bun songs/01-register-song.ts \\');
  console.error('    --genius-id 10047250 \\');
  console.error('    --genius-artist-id 498 \\');
  console.error('    [--spotify-id 3n3Ppam7vgaVa1iaRUc9Lp]');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const geniusArtistId = parseInt(values['genius-artist-id']!);
const spotifyId = values['spotify-id'] || '';

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🎵 Song Registration (V2)\n');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Check if song already registered (via The Graph)
    console.log(`Step 1: Checking if song ${geniusId} exists in The Graph...`);

    const SONG_EXISTS_QUERY = gql`
      query CheckSongExists($geniusId: BigInt!) {
        songs(where: { geniusId: $geniusId }) {
          id
          geniusId
          metadataUri
        }
      }
    `;

    const result = await graphClient.request<{ songs: any[] }>(
      SONG_EXISTS_QUERY,
      { geniusId: geniusId.toString() }
    );

    if (result.songs.length > 0) {
      console.log('⚠️  Song already registered on blockchain');
      console.log(`   Metadata URI: ${result.songs[0].metadataUri}`);
      console.log('\nTo update metadata, run:');
      console.log(`  bun songs/03-build-metadata.ts --genius-id ${geniusId}`);
      return;
    }

    console.log('  ✓ Song not found, proceeding with registration');

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

    // Step 3: Extract or Use Spotify ID
    console.log(`\nStep 3: Extracting Spotify ID...`);
    let finalSpotifyId = spotifyId; // Use parameter if provided

    if (!finalSpotifyId) {
      // Try to extract from Genius media array
      const spotifyMedia = song.media?.find((m: any) => m.provider === 'spotify');
      const spotifyUrl = spotifyMedia?.url || '';
      finalSpotifyId = spotifyUrl ? spotifyUrl.split('/track/')[1]?.split('?')[0] || '' : '';
    }

    if (finalSpotifyId) {
      console.log(`  ✓ Spotify ID: ${finalSpotifyId}`);
    } else {
      console.log('  ⚠️  No Spotify ID found (will use empty string)');
    }

    // Step 4: Extract TikTok Music ID (if available)
    console.log(`\nStep 4: Extracting TikTok Music ID...`);
    // Note: This would come from TikTok URL matching later
    const tiktokMusicId = '';
    console.log('  ⚠️  No TikTok Music ID yet (will be added during segment processing)');

    // Step 5: Build and upload metadata to Grove
    console.log(`\nStep 5: Building and uploading song metadata to Grove...`);

    const songMetadata = {
      $schema: 'https://github.com/yourusername/karaoke-school/blob/main/schemas/song-v2.json',
      version: '2.0.0',
      geniusId,
      title: song.title,
      artist: song.primary_artist.name,
      spotifyId: finalSpotifyId,
      coverUri: song.song_art_image_url, // Will be replaced with Grove URI later
      createdAt: new Date().toISOString(),
    };

    // Initialize Grove/Lens storage
    const storage = initGroveClient();
    const { immutable } = await import('@lens-chain/storage-client');
    const { chains } = await import('@lens-chain/sdk/viem');

    // Upload metadata to Grove
    const uploadResult = await storage.uploadAsJson(songMetadata, {
      name: `song-${geniusId}-metadata.json`,
      acl: immutable(chains.testnet.id),
    });
    const metadataUri = uploadResult.uri;

    console.log(`  ✓ Metadata uploaded to Grove: ${metadataUri}`);

    // Step 6: Emit SongRegistered event to Lens Chain
    console.log(`\nStep 6: Emitting SongRegistered event to Lens Chain...`);

    const txHash = await emitSongRegistered({
      geniusId,
      metadataUri,
      geniusArtistId,
    });

    console.log(`  ✓ Transaction hash: ${txHash}`);

    // Step 7: Save local copy of metadata
    console.log(`\nStep 7: Saving local metadata copy...`);
    const dataDir = path.join(process.cwd(), 'data', 'songs');
    await mkdir(dataDir, { recursive: true });

    const metadataPath = path.join(dataDir, `${geniusId}.json`);
    const localMetadata = {
      ...songMetadata,
      metadataUri,
      geniusArtistId,
      blockchain: {
        network: 'lens-testnet',
        txHash,
        registeredAt: new Date().toISOString(),
      },
    };

    writeFileSync(metadataPath, JSON.stringify(localMetadata, null, 2));
    console.log(`  ✓ Saved to: ${metadataPath}`);

    // Success
    console.log('\n✅ Song registered successfully!\n');
    console.log('Song details:');
    console.log(`  • Genius ID: ${geniusId}`);
    console.log(`  • Artist ID: ${geniusArtistId}`);
    console.log(`  • Metadata URI: ${metadataUri}`);
    console.log(`  • Transaction: ${txHash}`);
    console.log('\nThe Graph will index this song shortly.');
    console.log('You can now process segments for this song.');
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
