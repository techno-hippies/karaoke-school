#!/usr/bin/env bun
/**
 * Update all existing Spotify tracks with album image URLs
 * Fetches from Spotify API and updates spotify_tracks.image_url
 */

import { query, transaction } from '../../src/db/neon';
import { getTrack } from '../../src/services/spotify';
import { upsertSpotifyTrackSQL } from '../../src/db/spotify';

async function main() {
  console.log('📸 Updating Spotify track image URLs');
  console.log('');

  // Get all tracks without image_url
  const tracks = await query<{
    spotify_track_id: string;
    title: string;
  }>(`
    SELECT spotify_track_id, title
    FROM spotify_tracks
    WHERE image_url IS NULL
    ORDER BY spotify_track_id
  `);

  if (tracks.length === 0) {
    console.log('✅ All tracks already have image URLs');
    return;
  }

  console.log(`Found ${tracks.length} tracks needing image URLs\n`);

  let updated = 0;
  let failed = 0;

  for (const track of tracks) {
    try {
      console.log(`📥 Fetching: ${track.title}`);

      // Fetch from Spotify API
      const spotifyTrack = await getTrack(track.spotify_track_id);

      if (!spotifyTrack) {
        console.log(`   ❌ Track not found on Spotify`);
        failed++;
        continue;
      }

      if (!spotifyTrack.image_url) {
        console.log(`   ⚠️  No album image available`);
        failed++;
        continue;
      }

      // Update database
      const sql = upsertSpotifyTrackSQL(spotifyTrack);
      await query(sql);

      console.log(`   ✓ Updated: ${spotifyTrack.image_url.substring(0, 50)}...`);
      updated++;
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated}/${tracks.length}`);
  console.log(`Failed: ${failed}/${tracks.length}`);
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
