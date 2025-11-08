#!/usr/bin/env bun
/**
 * Manual Track Seeding
 * Creates track entries for testing enrichment pipeline
 *
 * Usage: bun src/tasks/ingestion/seed-tracks-manual.ts
 */

import { query } from '../../db/connection';
import { getTrack } from '../../services/spotify';
import { createEnrichmentTasks } from '../../db/queries';

// Manual mapping of TikTok video IDs to Spotify track IDs for testing
const MANUAL_MAPPINGS = [
  // Add known Spotify IDs for @gioscottii's videos here
  // Format: { tiktok_video_id: string, spotify_track_id: string }
];

async function main() {
  console.log('🎵 Manual Track Seeding\n');

  // Get all TikTok videos without tracks
  const unmappedVideos = await query<{
    video_id: string;
    music_title: string;
    music_author: string;
  }>(`
    SELECT v.video_id, v.music_title, v.music_author
    FROM tiktok_videos v
    LEFT JOIN tracks t ON v.video_id = t.tiktok_video_id
    WHERE t.spotify_track_id IS NULL
    ORDER BY v.play_count DESC NULLS LAST
  `);

  console.log(`Found ${unmappedVideos.length} unmapped videos\n`);

  if (unmappedVideos.length === 0) {
    console.log('✅ All videos already have tracks\n');
    return;
  }

  // Show unmapped videos for manual mapping
  console.log('📋 Unmapped videos:');
  for (const video of unmappedVideos.slice(0, 10)) {
    console.log(`   ${video.video_id}: "${video.music_title}" by ${video.music_author}`);
  }

  console.log('\n💡 To map videos to Spotify tracks:');
  console.log('   1. Search for tracks on Spotify');
  console.log('   2. Add mappings to MANUAL_MAPPINGS array in this file');
  console.log('   3. Run this script again\n');

  // Process manual mappings
  if (MANUAL_MAPPINGS.length === 0) {
    console.log('⚠️  No manual mappings configured yet\n');
    return;
  }

  let successCount = 0;
  let failedCount = 0;

  for (const mapping of MANUAL_MAPPINGS) {
    const { tiktok_video_id, spotify_track_id } = mapping;

    try {
      console.log(`\n🎵 Processing ${tiktok_video_id} → ${spotify_track_id}`);

      // Fetch Spotify track metadata
      const track = await getTrack(spotify_track_id);

      if (!track) {
        console.log(`   ❌ Track not found on Spotify`);
        failedCount++;
        continue;
      }

      console.log(`   ✅ ${track.title} by ${track.artists.map(a => a.name).join(', ')}`);

      // Create track entry
      await query(`
        INSERT INTO tracks (
          spotify_track_id,
          tiktok_video_id,
          title,
          artists,
          album_name,
          release_date,
          duration_ms,
          isrc,
          primary_artist_id,
          primary_artist_name,
          stage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
        ON CONFLICT (spotify_track_id) DO UPDATE SET
          tiktok_video_id = EXCLUDED.tiktok_video_id,
          updated_at = NOW()
      `, [
        spotify_track_id,
        tiktok_video_id,
        track.title,
        track.artists,
        track.album_name,
        track.release_date,
        track.duration_ms,
        track.isrc,
        track.artists[0]?.id || null,
        track.artists[0]?.name || null,
      ]);

      // Create enrichment tasks
      const taskTypes = [
        'iswc_discovery',
        'musicbrainz',
        'genius_songs',
        'genius_artists',
        'wikidata_works',
        'wikidata_artists',
        'quansic_artists',
        'lyrics_discovery',
      ];

      for (const taskType of taskTypes) {
        await query(`
          INSERT INTO enrichment_tasks (
            spotify_track_id,
            task_type,
            status
          ) VALUES ($1, $2, 'pending')
          ON CONFLICT (spotify_track_id, task_type) DO NOTHING
        `, [spotify_track_id, taskType]);
      }

      console.log(`   ✅ Created track and ${taskTypes.length} enrichment tasks`);
      successCount++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('');
}

main()
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
