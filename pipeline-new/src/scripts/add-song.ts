#!/usr/bin/env bun
/**
 * Add Song Script
 *
 * Adds a song from a prepared folder with lyrics files.
 *
 * Expected folder structure:
 *   songs/{iswc}/
 *     en-lyrics.txt    - English lyrics with section markers (required)
 *     zh-lyrics.txt    - Chinese lyrics (optional - add before generate-video)
 *     background.mp4   - Optional background video for snippets
 *
 * Usage:
 *   bun src/scripts/add-song.ts --iswc=T0704563291 --title="Single Ladies" --spotify-id=5R5GLTYa1CS5TRA2mVu9Tf
 */

import { parseArgs } from 'util';
import path from 'path';
import {
  createArtist,
  createSong,
  createLyrics,
  getSongByISWC,
  type CreateLyricData,
} from '../db/queries';
import {
  readAndValidateLyrics,
  printValidationResult,
  validateISWC,
  normalizeISWC,
  parseLyrics,
} from '../lib/lyrics-parser';
import { slugify } from '../lib/slugify';
import { downloadAndUploadImageToGrove } from '../services/grove';
import { validateEnv } from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    title: { type: 'string' },
    'spotify-id': { type: 'string' },
    'genius-id': { type: 'string' },
    'genius-url': { type: 'string' },
    'songs-dir': { type: 'string', default: './songs' },
    'skip-validation': { type: 'boolean', default: false },
  },
  strict: true,
});

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: Array<{ id: string; name: string }>;
  album: {
    images: Array<{ url: string; width: number; height: number }>;
  };
}

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchSpotifyTrack(trackId: string, token: string): Promise<SpotifyTrack> {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify track fetch failed: ${response.status}`);
  }

  return response.json();
}

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL']);

  // Validate required args
  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/add-song.ts --iswc=T0704563291 --title="Single Ladies" --spotify-id=5R5GLTYa1CS5TRA2mVu9Tf');
    process.exit(1);
  }

  if (!values.title) {
    console.error('❌ Missing required argument: --title');
    process.exit(1);
  }

  // Normalize and validate ISWC
  const iswc = normalizeISWC(values.iswc);
  if (!validateISWC(iswc)) {
    console.error(`❌ Invalid ISWC format: ${values.iswc}`);
    console.log('   Expected format: T0704563291 (no dots)');
    process.exit(1);
  }

  console.log('\n🎵 Adding Song');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Title: ${values.title}`);

  // Check if song already exists
  const existing = await getSongByISWC(iswc);
  if (existing) {
    console.log('\n⚠️  Song already exists:');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Title: ${existing.title}`);
    console.log(`   Stage: ${existing.stage}`);
    process.exit(0);
  }

  // Check for lyrics files
  const songsDir = values['songs-dir'];
  const songDir = path.join(songsDir, iswc);
  const enPath = path.join(songDir, 'en-lyrics.txt');
  const zhPath = path.join(songDir, 'zh-lyrics.txt');

  const enExists = await Bun.file(enPath).exists();
  const zhExists = await Bun.file(zhPath).exists();

  if (!enExists) {
    console.log(`\n📁 Song directory: ${songDir}`);
    console.log('   ❌ Missing: en-lyrics.txt (required)');
    console.log('\n   Create en-lyrics.txt first, then run this script again.');
    process.exit(1);
  }

  if (!zhExists) {
    console.log(`\n⚠️  zh-lyrics.txt not found - will store EN only`);
    console.log('   Add zh-lyrics.txt later before generate-video.ts');
  }

  // Parse and validate lyrics
  console.log('\n📋 Validating lyrics...');
  const { en, zh, validation } = zhExists
    ? await readAndValidateLyrics(enPath, zhPath)
    : { en: parseLyrics(await Bun.file(enPath).text()), zh: { lines: [], sectionMarkers: [] }, validation: { valid: true, warnings: [], errors: [], enLineCount: 0, zhLineCount: 0 } };

  if (zhExists) {
    printValidationResult(validation);
    if (!validation.valid && !values['skip-validation']) {
      console.log('\n❌ Lyrics validation failed. Fix errors and try again.');
      console.log('   Use --skip-validation to ignore warnings.');
      process.exit(1);
    }
  } else {
    console.log(`   EN lines: ${en.lines.length}`);
    console.log('   ZH lines: (not provided yet)');
  }

  // Fetch Spotify data if provided
  let spotifyTrack: SpotifyTrack | null = null;
  let artistId: string | undefined;

  if (values['spotify-id']) {
    console.log('\n🎧 Fetching Spotify data...');
    validateEnv(['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET']);

    const token = await getSpotifyToken();
    spotifyTrack = await fetchSpotifyTrack(values['spotify-id'], token);

    console.log(`   Track: ${spotifyTrack.name}`);
    console.log(`   Artist: ${spotifyTrack.artists[0]?.name}`);
    console.log(`   Duration: ${Math.round(spotifyTrack.duration_ms / 1000)}s`);

    // Create artist if we have Spotify data
    if (spotifyTrack.artists[0]) {
      const primaryArtist = spotifyTrack.artists[0];
      const artistSlug = slugify(primaryArtist.name);
      const imageUrl = spotifyTrack.album.images[0]?.url;

      // Upload artist image to Grove for permanence
      let imageGroveUrl: string | undefined;
      if (imageUrl) {
        console.log(`   Uploading artist image to Grove...`);
        try {
          const groveResult = await downloadAndUploadImageToGrove(
            imageUrl,
            `${artistSlug}.jpg`
          );
          imageGroveUrl = groveResult.url;
          console.log(`   Image Grove URL: ${imageGroveUrl}`);
        } catch (error: any) {
          console.log(`   ⚠️  Failed to upload artist image: ${error.message}`);
        }
      }

      const artist = await createArtist({
        spotify_artist_id: primaryArtist.id,
        name: primaryArtist.name,
        slug: artistSlug,
        image_url: imageUrl,
        image_grove_url: imageGroveUrl,
      });
      artistId = artist.id;
      console.log(`   Artist ID: ${artistId}`);
      console.log(`   Artist Slug: ${artistSlug}`);
    }
  }

  // Create song
  console.log('\n💾 Creating song...');
  const song = await createSong({
    iswc,
    title: values.title,
    spotify_track_id: values['spotify-id'],
    artist_id: artistId,
    duration_ms: spotifyTrack?.duration_ms,
    spotify_images: spotifyTrack?.album.images,
    genius_song_id: values['genius-id'] ? parseInt(values['genius-id']) : undefined,
    genius_url: values['genius-url'],
  });

  console.log(`   Song ID: ${song.id}`);

  // Create lyrics entries
  console.log('\n📝 Storing lyrics...');

  const lyricsData: CreateLyricData[] = [];

  // English lyrics
  for (const line of en.lines) {
    lyricsData.push({
      song_id: song.id,
      line_index: line.index,
      language: 'en',
      text: line.text,
      section_marker: line.sectionMarker || undefined,
    });
  }

  // Chinese lyrics
  for (const line of zh.lines) {
    lyricsData.push({
      song_id: song.id,
      line_index: line.index,
      language: 'zh',
      text: line.text,
      section_marker: line.sectionMarker || undefined,
    });
  }

  const lyrics = await createLyrics(lyricsData);
  console.log(`   Created ${lyrics.length} lyric entries (${en.lines.length} EN + ${zh.lines.length} ZH)`);

  // Summary
  console.log('\n✅ Song added successfully');
  console.log(`   ID: ${song.id}`);
  console.log(`   ISWC: ${song.iswc}`);
  console.log(`   Title: ${song.title}`);
  console.log(`   Stage: ${song.stage}`);

  // Check for additional files
  const bgVideoPath = path.join(songDir, 'background.mp4');
  const bgVideoExists = await Bun.file(bgVideoPath).exists();

  console.log('\n📁 Files detected:');
  console.log(`   en-lyrics.txt: ✅`);
  console.log(`   zh-lyrics.txt: ✅`);
  console.log(`   background.mp4: ${bgVideoExists ? '✅' : '❌ (optional)'}`);

  // Check for clip files
  let clipCount = 0;
  for (let i = 1; i <= 20; i++) {
    const clipPath = path.join(songDir, `clip-${i}.mp3`);
    if (await Bun.file(clipPath).exists()) {
      clipCount++;
    } else {
      break;
    }
  }
  if (clipCount > 0) {
    console.log(`   clip-*.mp3: ${clipCount} files`);
  }

  console.log('\n💡 Next steps:');
  console.log(`   • Align lyrics: bun src/scripts/align-lyrics.ts --iswc=${iswc}`);
  console.log(`   • Process audio: bun src/scripts/process-audio.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
