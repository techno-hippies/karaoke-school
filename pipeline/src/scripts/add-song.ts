#!/usr/bin/env bun
/**
 * Add Song Script
 *
 * Adds a song by fetching lyrics from LRCLIB and auto-translating to Chinese.
 *
 * Workflow:
 *   1. Fetch track metadata from Spotify (required)
 *   2. Search LRCLIB for lyrics using track/artist name
 *   3. Auto-translate to Chinese via Gemini
 *   4. Save song + artist + lyrics to database
 *
 * Usage:
 *   bun src/scripts/add-song.ts --iswc=T0704563291 --title="Single Ladies" --spotify-id=5R5GLTYa1CS5TRA2mVu9Tf
 *
 * Note: Fails immediately if LRCLIB doesn't have lyrics for the song.
 */

import { parseArgs } from 'util';
import {
  createArtist,
  createSong,
  createLyrics,
  getSongByISWC,
  type CreateLyricData,
} from '../db/queries';
import {
  validateISWC,
  normalizeISWC,
} from '../lib/lyrics-parser';
import { slugify } from '../lib/slugify';
import { downloadAndUploadImageToGrove } from '../services/grove';
import { searchGenius } from '../services/genius';
import { searchLyrics } from '../services/lrclib';
import { translateLyrics, LANGUAGES } from '../services/openrouter';
import { validateEnv, GENIUS_API_KEY, OPENROUTER_API_KEY } from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    title: { type: 'string' },
    'spotify-id': { type: 'string' },
    'genius-id': { type: 'string' },
    'genius-url': { type: 'string' },
    'skip-translate': { type: 'boolean', default: false },
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

interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; width: number; height: number }>;
  genres: string[]; // Spotify genres (e.g., ["pop", "r&b", "dance pop"])
}

async function fetchSpotifyArtist(artistId: string, token: string): Promise<SpotifyArtist> {
  const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify artist fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Parse LRCLIB plain lyrics into lines
 * Filters empty lines, preserves all lyrics
 */
function parsePlainLyrics(plainLyrics: string): string[] {
  return plainLyrics
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET']);

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

  if (!values['spotify-id']) {
    console.error('❌ Missing required argument: --spotify-id');
    console.log('   Spotify ID is required to fetch metadata and search LRCLIB');
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

  // Fetch Spotify data (required)
  console.log('\n🎧 Fetching Spotify data...');
  const token = await getSpotifyToken();
  const spotifyTrack = await fetchSpotifyTrack(values['spotify-id'], token);
  let artistId: string | undefined;

  console.log(`   Track: ${spotifyTrack.name}`);
  console.log(`   Artist: ${spotifyTrack.artists[0]?.name}`);
  console.log(`   Duration: ${Math.round(spotifyTrack.duration_ms / 1000)}s`);

  const artistName = spotifyTrack.artists[0]?.name || 'Unknown Artist';

  // Fetch lyrics from LRCLIB (fail fast if not found)
  console.log('\n📝 Fetching lyrics from LRCLIB...');
  const lrcResult = await searchLyrics(spotifyTrack.name, artistName);

  if (!lrcResult || !lrcResult.plainLyrics) {
    console.error(`\n❌ Lyrics not found on LRCLIB`);
    console.error(`   Track: "${spotifyTrack.name}"`);
    console.error(`   Artist: "${artistName}"`);
    console.error(`\n   LRCLIB doesn't have this song. You'll need to add lyrics manually.`);
    process.exit(1);
  }

  console.log(`   ✅ Found lyrics (${lrcResult.plainLyrics.split('\n').length} lines)`);

  // Parse lyrics into lines
  const enLines = parsePlainLyrics(lrcResult.plainLyrics);
  console.log(`   EN lines (cleaned): ${enLines.length}`);

  // Translate to Chinese via Gemini
  let zhLines: string[] = [];
  if (!values['skip-translate']) {
    if (!OPENROUTER_API_KEY) {
      console.log('\n⚠️  OPENROUTER_API_KEY not set - skipping translation');
    } else {
      console.log('\n🌐 Translating to Chinese via Gemini...');
      try {
        zhLines = await translateLyrics(enLines, 'zh', LANGUAGES.zh.name);
        console.log(`   ✅ Translated ${zhLines.length} lines`);

        if (zhLines.length !== enLines.length) {
          console.log(`   ⚠️  Line count mismatch: EN=${enLines.length}, ZH=${zhLines.length}`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  Translation failed: ${error.message}`);
        console.log('   Continuing with EN only...');
      }
    }
  } else {
    console.log('\n⏭️  Skipping translation (--skip-translate)');
  }

  // Create artist if we have Spotify data
  if (spotifyTrack.artists[0]) {
    const primaryArtist = spotifyTrack.artists[0];
    const artistSlug = slugify(primaryArtist.name);

    // Fetch actual artist data to get artist photo (not album cover)
    console.log('\n👤 Fetching artist details...');
    const spotifyArtist = await fetchSpotifyArtist(primaryArtist.id, token);
    const artistImageUrl = spotifyArtist.images[0]?.url; // Artist photo, not album cover

    // Upload artist image to Grove for permanence
    let imageGroveUrl: string | undefined;
    if (artistImageUrl) {
      console.log(`   Uploading artist image to Grove...`);
      try {
        const groveResult = await downloadAndUploadImageToGrove(
          artistImageUrl,
          `artist-${artistSlug}.jpg`
        );
        imageGroveUrl = groveResult.url;
        console.log(`   Artist Image Grove URL: ${imageGroveUrl}`);
      } catch (error: any) {
        console.log(`   ⚠️  Failed to upload artist image: ${error.message}`);
      }
    }

    const artist = await createArtist({
      spotify_artist_id: primaryArtist.id,
      name: primaryArtist.name,
      slug: artistSlug,
      image_url: artistImageUrl,
      image_grove_url: imageGroveUrl,
      genres: spotifyArtist.genres || [],
    });
    artistId = artist.id;
    console.log(`   Artist ID: ${artistId}`);
    console.log(`   Artist Slug: ${artistSlug}`);
    if (spotifyArtist.genres?.length) {
      console.log(`   Genres: ${spotifyArtist.genres.join(', ')}`);
    }
  }

  // Upload song cover images to Grove for permanence
  // Spotify provides: [0] 640x640, [1] 300x300, [2] 64x64
  let coverGroveUrl: string | undefined;
  let thumbnailGroveUrl: string | undefined;

  if (spotifyTrack?.album.images?.length) {
    const coverUrl = spotifyTrack.album.images[0]?.url;     // 640x640
    const thumbUrl = spotifyTrack.album.images[1]?.url;     // 300x300 (displays at 100x100)

    if (coverUrl) {
      console.log('\n🖼️  Uploading cover images to Grove...');
      try {
        const coverResult = await downloadAndUploadImageToGrove(
          coverUrl,
          `${iswc}-cover.jpg`
        );
        coverGroveUrl = coverResult.url;
        console.log(`   Cover (640x640): ${coverGroveUrl}`);
      } catch (error: any) {
        console.log(`   ⚠️  Failed to upload cover: ${error.message}`);
      }
    }

    if (thumbUrl) {
      try {
        const thumbResult = await downloadAndUploadImageToGrove(
          thumbUrl,
          `${iswc}-thumb.jpg`
        );
        thumbnailGroveUrl = thumbResult.url;
        console.log(`   Thumbnail (300x300): ${thumbnailGroveUrl}`);
      } catch (error: any) {
        console.log(`   ⚠️  Failed to upload thumbnail: ${error.message}`);
      }
    }
  }

  // Search Genius for song (auto-populate if not provided)
  let geniusSongId: number | undefined = values['genius-id'] ? parseInt(values['genius-id']) : undefined;
  let geniusUrl: string | undefined = values['genius-url'];

  if (!geniusSongId && GENIUS_API_KEY) {
    console.log('\n🔍 Searching Genius...');
    const searchQuery = `${values.title} ${artistName}`;

    try {
      const geniusResult = await searchGenius(searchQuery);
      if (geniusResult) {
        geniusSongId = geniusResult.id;
        geniusUrl = geniusResult.url;
        console.log(`   Found: ${geniusResult.title} by ${geniusResult.primary_artist.name}`);
        console.log(`   Genius ID: ${geniusSongId}`);
        console.log(`   URL: ${geniusUrl}`);
      } else {
        console.log(`   ⚠️  No Genius result found for "${searchQuery}"`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Genius search failed: ${error.message}`);
    }
  } else if (!GENIUS_API_KEY) {
    console.log('\n⚠️  GENIUS_API_KEY not set - skipping Genius search');
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
    cover_grove_url: coverGroveUrl,
    thumbnail_grove_url: thumbnailGroveUrl,
    genius_song_id: geniusSongId,
    genius_url: geniusUrl,
  });

  console.log(`   Song ID: ${song.id}`);

  // Create lyrics entries
  console.log('\n📝 Storing lyrics...');

  const lyricsData: CreateLyricData[] = [];

  // English lyrics
  enLines.forEach((text, index) => {
    lyricsData.push({
      song_id: song.id,
      line_index: index,
      language: 'en',
      text,
    });
  });

  // Chinese lyrics (if translated)
  zhLines.forEach((text, index) => {
    lyricsData.push({
      song_id: song.id,
      line_index: index,
      language: 'zh',
      text,
    });
  });

  const lyrics = await createLyrics(lyricsData);
  console.log(`   Created ${lyrics.length} lyric entries (${enLines.length} EN + ${zhLines.length} ZH)`);

  // Summary
  console.log('\n✅ Song added successfully');
  console.log(`   ID: ${song.id}`);
  console.log(`   ISWC: ${song.iswc}`);
  console.log(`   Title: ${song.title}`);
  console.log(`   Stage: ${song.stage}`);

  console.log('\n💡 Next steps:');
  console.log(`   • Add original.mp3 to songs/${iswc}/ folder`);
  console.log(`   • Process audio: bun src/scripts/process-audio.ts --iswc=${iswc}`);
  console.log(`   • Align lyrics: bun src/scripts/align-lyrics.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
