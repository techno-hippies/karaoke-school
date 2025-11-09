#!/usr/bin/env bun
/**
 * Spotify Resolution Task
 * Creates tracks from TikTok videos with Spotify IDs
 * Fetches metadata from Spotify API and spawns enrichment tasks
 *
 * Usage: bun src/tasks/ingestion/resolve-spotify.ts [limit]
 */

import { query } from '../../db/connection';
import { createEnrichmentTask } from '../../db/queries';
import { getTrack } from '../../services/spotify';

interface UnresolvedVideo {
  video_id: string;
  spotify_track_id: string;
  creator_username: string;
}

/**
 * Main processor
 */
async function resolveSpotifyTracks(limit: number = 50) {
  console.log('🎵 Spotify Track Resolution');
  console.log('');

  // Find TikTok videos with Spotify IDs that haven't been resolved yet
  const videos = await query<UnresolvedVideo>(`
    SELECT
      tv.video_id,
      tv.spotify_track_id,
      tv.creator_username
    FROM tiktok_videos tv
    WHERE tv.spotify_track_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM tracks t
        WHERE t.spotify_track_id = tv.spotify_track_id
      )
    LIMIT $1
  `, [limit]);

  if (videos.length === 0) {
    console.log('✅ No unresolved videos with Spotify IDs found');
    return;
  }

  console.log(`📊 Found ${videos.length} videos to resolve`);
  console.log('');

  let created = 0;
  let failed = 0;
  let skipped = 0;
  let cached = 0;

  for (const video of videos) {
    try {
      console.log(`🔍 Resolving: ${video.spotify_track_id}`);

      // Check if track already exists (race condition protection)
      const existing = await query(
        'SELECT spotify_track_id FROM tracks WHERE spotify_track_id = $1',
        [video.spotify_track_id]
      );

      if (existing.length > 0) {
        console.log(`   ⏭️  Already in tracks`);
        skipped++;
        continue;
      }

      // Check cache first
      const cachedTrack = await query<{
        spotify_track_id: string;
        title: string;
        artists: any;
        album: any;
        isrc: string | null;
        duration_ms: number;
        release_date: string | null;
      }>(`
        SELECT spotify_track_id, title, artists, album, isrc, duration_ms, release_date
        FROM spotify_tracks
        WHERE spotify_track_id = $1
      `, [video.spotify_track_id]);

      let trackData;

      if (cachedTrack.length > 0) {
        // Use cached data
        console.log(`   💾 Cache hit`);
        trackData = cachedTrack[0];
        cached++;
      } else {
        // Fetch from Spotify API
        const trackInfo = await getTrack(video.spotify_track_id);

        if (!trackInfo) {
          console.log(`   ❌ Not found on Spotify`);
          failed++;
          continue;
        }

        console.log(`   🌐 API fetch`);

        // Store in cache
        await query(`
          INSERT INTO spotify_tracks (
            spotify_track_id,
            title,
            artists,
            album,
            isrc,
            duration_ms,
            release_date,
            popularity,
            preview_url,
            external_urls
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (spotify_track_id) DO NOTHING
        `, [
          trackInfo.spotify_track_id,
          trackInfo.title,
          JSON.stringify(trackInfo.artists),
          JSON.stringify({ name: trackInfo.album, image_url: trackInfo.image_url }),
          trackInfo.isrc || null,
          trackInfo.duration_ms,
          trackInfo.release_date,
          trackInfo.popularity,
          trackInfo.preview_url,
          JSON.stringify({ spotify: trackInfo.spotify_url })
        ]);

        trackData = {
          spotify_track_id: trackInfo.spotify_track_id,
          title: trackInfo.title,
          artists: trackInfo.artists,
          album: { name: trackInfo.album },
          isrc: trackInfo.isrc,
          duration_ms: trackInfo.duration_ms,
          release_date: trackInfo.release_date
        };

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create track entry from cache or fresh data
      const artists = Array.isArray(trackData.artists) ? trackData.artists : JSON.parse(trackData.artists as any);
      const album = typeof trackData.album === 'object' ? trackData.album : JSON.parse(trackData.album as any);

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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (spotify_track_id) DO NOTHING
      `, [
        trackData.spotify_track_id,
        video.video_id,
        trackData.title,
        JSON.stringify(artists),
        album.name,
        trackData.release_date,
        trackData.duration_ms,
        trackData.isrc || null,
        artists[0]?.id || null,
        artists[0]?.name || null,
        'pending'
      ]);

      console.log(`   ✅ Created track: ${trackData.title} by ${artists[0]?.name}`);
      console.log(`      ISRC: ${trackData.isrc || 'N/A'}`);

      // Spawn enrichment tasks
      const enrichmentTypes = [
        'iswc_discovery',
        'musicbrainz',
        'genius_songs',
        'genius_artists',
        'wikidata_works',
        'wikidata_artists',
        'quansic_artists',
        'lyrics_discovery',
        'spotify_artists'
      ];

      for (const taskType of enrichmentTypes) {
        await createEnrichmentTask(trackData.spotify_track_id, taskType);
      }

      console.log(`   📋 Spawned ${enrichmentTypes.length} enrichment tasks`);
      created++;

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }

    console.log('');
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   💾 Cache hits: ${cached}`);
  console.log(`   🌐 API calls: ${created - cached}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('');
}

// CLI execution
if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 50;

  console.log(`🎯 Limit: ${limit} videos`);
  console.log('');

  await resolveSpotifyTracks(limit);

  console.log('✅ Done!');
  process.exit(0);
}

export { resolveSpotifyTracks };
