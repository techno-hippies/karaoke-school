#!/usr/bin/env bun
/**
 * Step 4: Fetch ISRCs from Spotify
 *
 * Converts Spotify Track IDs to ISRCs using Spotify API
 * Based on: processor/src/enrichment/spotify-isrc-fetcher.ts
 *
 * Prerequisites:
 * - Manifest with Spotify Track IDs (data/videos/{handle}/manifest.json)
 * - SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env
 *
 * Usage:
 *   bun run fetch-isrc --creator @charlidamelio
 *
 * Output:
 *   Updated manifest with ISRCs and Spotify metadata
 */

import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    release_date: string;
  };
  external_ids?: {
    isrc?: string;
    ean?: string;
    upc?: string;
  };
  duration_ms: number;
  explicit: boolean;
  popularity: number;
}

interface VideoData {
  postId: string;
  music: {
    title: string;
    spotifyUrl: string | null;
    spotifyTrackId: string | null;
    spotify?: {
      isrc?: string;
      metadata?: any;
      fetchedAt?: string;
    };
  };
  [key: string]: any;
}

interface Manifest {
  videos: VideoData[];
  [key: string]: any;
}

class SpotifyISRCFetcher {
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async ensureAccessToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    console.log('🔑 Getting Spotify access token...');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${this.clientId}:${this.clientSecret}`
        ).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Spotify auth failed: ${response.status}`);
    }

    const data: any = await response.json();
    this.accessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry to be safe
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

    console.log('✅ Access token obtained\n');
  }

  async getTrack(trackId: string): Promise<SpotifyTrack | null> {
    await this.ensureAccessToken();

    const response = await fetch(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      }
    );

    if (response.status === 429) {
      // Rate limited
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`⚠️  Rate limited. Waiting ${retryAfter}s...`);
      await this.sleep(retryAfter * 1000);
      return this.getTrack(trackId);
    }

    if (!response.ok) {
      console.error(`Error fetching ${trackId}: ${response.status}`);
      return null;
    }

    return await response.json();
  }

  async getTracks(trackIds: string[]): Promise<(SpotifyTrack | null)[]> {
    await this.ensureAccessToken();

    // Spotify allows max 50 tracks per request
    const ids = trackIds.slice(0, 50).join(',');

    const response = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${ids}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      }
    );

    if (response.status === 429) {
      // Rate limited
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`⚠️  Rate limited. Waiting ${retryAfter}s...`);
      await this.sleep(retryAfter * 1000);
      return this.getTracks(trackIds);
    }

    if (!response.ok) {
      console.error(`Error fetching batch: ${response.status}`);
      return [];
    }

    const data: any = await response.json();
    return data.tracks || [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  extractMetadata(track: SpotifyTrack): any {
    return {
      name: track.name,
      artists: track.artists.map(a => a.name),
      album: track.album.name,
      releaseDate: track.album.release_date,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      popularity: track.popularity,
      isrc: track.external_ids?.isrc,
      upc: track.external_ids?.upc,
      ean: track.external_ids?.ean,
    };
  }
}

async function fetchISRCs(tiktokHandle: string): Promise<void> {
  console.log('\n🎵 Step 4: Fetch ISRCs from Spotify');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Check for Spotify credentials
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    console.error('❌ Error: Spotify credentials not found\n');
    console.log('Set environment variables in pkp-lens-flow/.env:');
    console.log('  SPOTIFY_CLIENT_ID="your_client_id"');
    console.log('  SPOTIFY_CLIENT_SECRET="your_client_secret"');
    console.log('\nTo get credentials:');
    console.log('  1. Go to https://developer.spotify.com/dashboard');
    console.log('  2. Create an app');
    console.log('  3. Copy Client ID and Client Secret');
    console.log('  4. Add both values to pkp-lens-flow/.env');
    console.log('  5. Run: cd pkp-lens-flow && dotenvx encrypt\n');
    process.exit(1);
  }

  // 2. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  const videos = manifest.videos;
  console.log(`   Found ${videos.length} videos\n`);

  // 3. Create fetcher
  const fetcher = new SpotifyISRCFetcher(clientId, clientSecret);

  // 4. Process videos
  console.log('🔍 Fetching ISRCs from Spotify...\n');

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const trackId = video.music.spotifyTrackId;

    console.log(`   Video ${i + 1}/${videos.length}: ${video.music.title}`);

    if (!trackId) {
      console.log(`   ⚠️  No Spotify Track ID\n`);
      continue;
    }

    console.log(`   • Spotify ID: ${trackId}`);

    // Fetch track data
    const track = await fetcher.getTrack(trackId);

    if (track) {
      const metadata = fetcher.extractMetadata(track);
      const isrc = metadata.isrc;

      // Add to video
      if (!video.music.spotify) {
        video.music.spotify = {};
      }

      video.music.spotify.isrc = isrc;
      video.music.spotify.metadata = metadata;
      video.music.spotify.fetchedAt = new Date().toISOString();

      if (isrc) {
        console.log(`   • ✅ ISRC: ${isrc}`);
      } else {
        console.log(`   • ⚠️  ISRC: Not found`);
      }

      console.log(`   • Artists: ${metadata.artists.join(', ')}`);
      console.log(`   • Album: ${metadata.album}\n`);
    } else {
      console.log(`   • ❌ Failed to fetch track data\n`);
    }

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 5. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 6. Summary
  const isrcsFound = videos.filter(v => v.music.spotify?.isrc).length;
  console.log('═══════════════════════════════════════════');
  console.log('✨ ISRC Fetch Complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   ISRCs found: ${isrcsFound}/${videos.length}`);

  if (isrcsFound > 0) {
    console.log(`\n⚠️  Next: Run MLC scraper to get song codes`);
    console.log(`   (MLC scraper implementation TODO)`);
  }

  console.log('');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run fetch-isrc --creator @charlidamelio\n');
      process.exit(1);
    }

    await fetchISRCs(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
