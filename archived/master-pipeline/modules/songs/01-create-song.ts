#!/usr/bin/env bun
/**
 * Create Song Module - V2 Architecture
 *
 * Creates a unified song with:
 * - Genius API metadata (title, artist, cover)
 * - Grove metadata using SongMetadataSchema (immutable)
 * - Optional SongCreated event emission
 *
 * Architecture:
 * - No contracts - metadata stored in Grove
 * - Songs are immutable (use immutable ACL)
 * - Optional reference to artist Lens account
 * - The Graph indexes events (optional)
 *
 * Storage pattern:
 * - Grove URI: lens://song-{geniusId}.json
 * - Local data: data/songs/{geniusId}.json
 *
 * Usage:
 *   # Basic song creation
 *   bun modules/songs/01-create-song.ts --genius-id 10047250
 *
 *   # With artist account reference
 *   bun modules/songs/01-create-song.ts --genius-id 10047250 --artist-username beyonce
 *
 *   # With event emission
 *   bun modules/songs/01-create-song.ts --genius-id 10047250 --emit-event
 */

import { parseArgs } from 'util';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { requireEnv, paths } from '../../lib/config.js';
import { writeJson, ensureDir, readJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import {
  createSongMetadata,
  validateSongMetadata,
  type SongMetadata
} from '../../lib/schemas/grove/song.js';
import { emitSongRegistered } from '../../lib/event-emitter.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'genius-id': { type: 'string' },
      'artist-username': { type: 'string' }, // Optional: Link to artist account
      'emit-event': { type: 'boolean', default: true }, // V2: Emit events by default
      'skip-event': { type: 'boolean', default: false }, // Skip event emission
    },
  });

  if (!values['genius-id']) {
    logger.error('Missing required parameter: --genius-id');
    console.log('\nUsage:');
    console.log('  bun modules/songs/01-create-song.ts --genius-id 10047250');
    console.log('  bun modules/songs/01-create-song.ts --genius-id 10047250 --artist-username beyonce');
    console.log('  bun modules/songs/01-create-song.ts --genius-id 10047250 --emit-event\n');
    console.log('Options:');
    console.log('  --genius-id          Genius song ID (required)');
    console.log('  --artist-username    Artist username in kschool1/* namespace (optional)');
    console.log('  --emit-event         Emit SongCreated event to contract (optional)\n');
    process.exit(1);
  }

  const geniusId = parseInt(values['genius-id']!);
  const artistUsername = values['artist-username'];
  const skipEvent = values['skip-event'];
  const shouldEmitEvent = !skipEvent && values['emit-event'];

  logger.header(`Create Song: ${geniusId}`);

  try {
    // Check if song already exists
    const songPath = paths.song(geniusId.toString());
    try {
      const existingSong = readJson<any>(songPath);
      logger.warn('Song already exists');
      console.log(`   Genius ID: ${existingSong.geniusId}`);
      console.log(`   Title: ${existingSong.title}`);
      console.log(`   Artist: ${existingSong.artist}`);
      console.log(`   Grove URI: ${existingSong.metadataUri}\n`);
      console.log('✅ Skipping song creation (already exists)');
      console.log(`   Delete ${songPath} to recreate\n`);
      return;
    } catch {
      // Song doesn't exist, continue
    }

    // ============ STEP 1: Fetch from Genius API ============
    logger.step('1/3', 'Fetching song metadata from Genius');

    const geniusApiKey = requireEnv('GENIUS_API_KEY');
    const geniusResponse = await fetch(
      `https://api.genius.com/songs/${geniusId}`,
      {
        headers: {
          'Authorization': `Bearer ${geniusApiKey}`,
        },
      }
    );

    if (!geniusResponse.ok) {
      throw new Error(`Genius API error: ${geniusResponse.status} ${geniusResponse.statusText}`);
    }

    const geniusData = await geniusResponse.json();
    const song = geniusData?.response?.song;

    if (!song) {
      throw new Error('No song data in Genius API response');
    }

    const title = song.title;
    const artistName = song.primary_artist.name;
    const geniusArtistId = song.primary_artist.id;
    const coverUrl = song.song_art_image_url;

    console.log(`✅ Song fetched from Genius:`);
    console.log(`   Title: ${title}`);
    console.log(`   Artist: ${artistName}`);
    console.log(`   Genius Artist ID: ${geniusArtistId}`);
    console.log(`   Cover: ${coverUrl}\n`);

    // Extract Spotify ID if available
    const spotifyMedia = song.media?.find((m: any) => m.provider === 'spotify');
    const spotifyUrl = spotifyMedia?.url || '';
    const spotifyId = spotifyUrl ? spotifyUrl.split('/track/')[1]?.split('?')[0] || '' : '';

    if (spotifyId) {
      console.log(`📀 Spotify ID: ${spotifyId}`);
    }

    // Get duration from song stats (approximate)
    const duration = 180; // Default 3 minutes (TODO: fetch from Spotify API or audio file)
    console.log(`⏱️  Duration: ${duration}s (placeholder)\n`);

    // ============ STEP 2: Create Song Metadata (Grove) ============
    logger.step('2/3', 'Creating song metadata');

    const adminWallet = requireEnv('BACKEND_WALLET_ADDRESS');

    // Build optional artist account reference
    let artistAccountUri: string | undefined;
    if (artistUsername) {
      // Load artist account data
      try {
        const artistAccount = readJson<any>(paths.account(artistUsername));
        artistAccountUri = artistAccount.metadataUri;
        console.log(`✅ Linked to artist account: kschool1/${artistUsername}`);
        console.log(`   Artist Grove URI: ${artistAccountUri}\n`);
      } catch {
        console.log(`⚠️  Artist account not found: ${artistUsername}`);
        console.log(`   Song will be created without artist link\n`);
      }
    }

    const songMetadata: SongMetadata = createSongMetadata({
      geniusId,
      title,
      artist: artistName,
      duration,
      coverUri: coverUrl,
      registeredBy: adminWallet,
      spotifyId,
      geniusArtistId,
      artistAccount: artistAccountUri,
    });

    // Validate with Zod
    const validated = validateSongMetadata(songMetadata);

    console.log('☁️  Uploading song metadata to Grove...');
    const storage = StorageClient.create();
    const metadataUpload = await storage.uploadAsJson(validated, {
      name: `song-${geniusId}.json`,
      acl: immutable(chains.testnet.id),
    });
    console.log(`✅ Song metadata uploaded: ${metadataUpload.uri}`);
    console.log(`   Storage: Immutable (cannot be modified)\n`);

    // ============ STEP 3: Save Local Data ============
    logger.step('3/3', 'Saving local song data');

    const songData = {
      geniusId,
      title,
      artist: artistName,
      geniusArtistId,
      spotifyId,
      duration,
      coverUrl,
      metadataUri: metadataUpload.uri,
      artistAccount: artistAccountUri,
      artistUsername,
      createdAt: new Date().toISOString(),
    };

    await ensureDir(paths.songsDir());
    writeJson(songPath, songData);
    console.log(`✅ Song data saved to: ${songPath}\n`);

    // ============ STEP 4: Emit Event to The Graph ============
    if (shouldEmitEvent) {
      logger.step('4/4', 'Emitting SongRegistered event');
      try {
        const txHash = await emitSongRegistered({
          geniusId,
          metadataUri: metadataUpload.uri,
          geniusArtistId,
        });
        console.log(`✅ Event emitted successfully!`);
        console.log(`   Transaction: ${txHash}`);
        console.log(`   The Graph will index this event\n`);
      } catch (error: any) {
        console.log(`⚠️  Failed to emit event: ${error.message}`);
        console.log(`   Song created successfully, but event not emitted\n`);
      }
    } else {
      console.log('ℹ️  Skipping event emission (use --emit-event to enable)\n');
    }

    // Success
    console.log('✅ Song created successfully!\n');
    console.log(`   Genius ID: ${geniusId}`);
    console.log(`   Title: ${title}`);
    console.log(`   Artist: ${artistName}`);
    console.log(`   Grove URI: ${metadataUpload.uri}\n`);

    console.log('Next steps:');
    console.log('  • Create segments for this song');
    console.log('  • Add lyrics (optional)');
    console.log('  • Add MLC licensing data (optional)\n');
  } catch (error: any) {
    logger.error(`Failed to create song: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
