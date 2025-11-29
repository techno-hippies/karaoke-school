#!/usr/bin/env bun
/**
 * Fix Artist Images
 *
 * Updates existing artists with actual Spotify artist photos
 * (instead of album covers which were incorrectly stored before)
 *
 * Usage:
 *   bun src/scripts/fix-artist-images.ts
 */

import { query } from '../db/connection';
import { downloadAndUploadImageToGrove } from '../services/grove';
import { validateEnv } from '../config';

interface Artist {
  id: string;
  spotify_artist_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  image_grove_url: string | null;
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

interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; width: number; height: number }>;
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

async function main() {
  validateEnv(['DATABASE_URL', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET']);

  console.log('🎨 Fixing Artist Images\n');

  // Get all artists
  const artists = await query<Artist>(
    'SELECT id, spotify_artist_id, name, slug, image_url, image_grove_url FROM artists'
  );

  console.log(`Found ${artists.length} artists\n`);

  const token = await getSpotifyToken();

  for (const artist of artists) {
    console.log(`\n📷 ${artist.name} (${artist.slug})`);
    console.log(`   Spotify ID: ${artist.spotify_artist_id}`);
    console.log(`   Current image: ${artist.image_url?.substring(0, 50)}...`);

    try {
      // Fetch actual artist data from Spotify
      const spotifyArtist = await fetchSpotifyArtist(artist.spotify_artist_id, token);
      const artistImageUrl = spotifyArtist.images[0]?.url;

      if (!artistImageUrl) {
        console.log(`   ⚠️  No artist image on Spotify`);
        continue;
      }

      console.log(`   Spotify artist image: ${artistImageUrl.substring(0, 50)}...`);

      // Check if it's different from current
      if (artist.image_url === artistImageUrl) {
        console.log(`   ✅ Already has correct artist image`);
        continue;
      }

      // Upload new image to Grove
      console.log(`   Uploading to Grove...`);
      const groveResult = await downloadAndUploadImageToGrove(
        artistImageUrl,
        `artist-${artist.slug}.jpg`
      );

      // Update database
      await query(
        `UPDATE artists
         SET image_url = $1, image_grove_url = $2
         WHERE id = $3`,
        [artistImageUrl, groveResult.url, artist.id]
      );

      console.log(`   ✅ Updated!`);
      console.log(`   New Grove URL: ${groveResult.url}`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
