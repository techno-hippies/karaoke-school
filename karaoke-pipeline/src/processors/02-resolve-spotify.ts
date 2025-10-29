#!/usr/bin/env bun
/**
 * Processor: Resolve Spotify Metadata
 * Takes videos with spotify_track_id and resolves full track + artist metadata
 *
 * Usage:
 *   bun src/processors/02-resolve-spotify.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';
import { getTrack, getArtist } from '../services/spotify';
import {
  upsertSpotifyTrackSQL,
  upsertSpotifyArtistSQL,
  createPipelineEntrySQL,
  logProcessingSQL,
} from '../db/spotify';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🎵 Spotify Metadata Resolver');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Step 1: Find videos with Spotify IDs that haven't been processed
  console.log('⏳ Finding unprocessed videos with Spotify IDs...');

  const unprocessedVideos = await query<{
    video_id: string;
    spotify_track_id: string;
    creator_username: string;
  }>(`
    SELECT v.video_id, v.spotify_track_id, v.creator_username
    FROM tiktok_videos v
    WHERE v.is_copyrighted = TRUE
      AND v.spotify_track_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM song_pipeline tp
        WHERE tp.tiktok_video_id = v.video_id
      )
    ORDER BY v.play_count DESC
    LIMIT ${batchSize}
  `);

  if (unprocessedVideos.length === 0) {
    console.log('✅ No unprocessed videos found. All caught up!');
    return;
  }

  console.log(`✅ Found ${unprocessedVideos.length} videos to process`);
  console.log('');

  // Step 2: Check cache for existing tracks
  const trackIds = unprocessedVideos.map(v => v.spotify_track_id);
  const cachedTracks = await query<{
    spotify_track_id: string;
    isrc: string | null;
  }>(`
    SELECT spotify_track_id, isrc
    FROM spotify_tracks
    WHERE spotify_track_id = ANY(ARRAY[${trackIds.map(id => `'${id}'`).join(',')}])
  `);

  const cachedTrackIds = new Set(cachedTracks.map(t => t.spotify_track_id));
  const uncachedVideos = unprocessedVideos.filter(v => !cachedTrackIds.has(v.spotify_track_id));

  console.log(`💾 Cache hits: ${cachedTracks.length}`);
  console.log(`🌐 API requests needed: ${uncachedVideos.length}`);
  console.log('');

  // Step 3: Fetch uncached tracks from Spotify API
  const sqlStatements: string[] = [];
  let successCount = 0;
  let failCount = 0;

  if (uncachedVideos.length > 0) {
    console.log('⏳ Fetching tracks from Spotify API...');

    for (const video of uncachedVideos) {
      try {
        const track = await getTrack(video.spotify_track_id);

        if (!track) {
          console.log(`  ❌ ${video.spotify_track_id}: Not found`);
          sqlStatements.push(
            logProcessingSQL(
              video.spotify_track_id,
              'spotify_resolve',
              'failed',
              'api',
              'Track not found on Spotify'
            )
          );
          failCount++;
          continue;
        }

        console.log(`  ✅ ${track.title} - ${track.artists.map(a => a.name).join(', ')}`);
        console.log(`     ISRC: ${track.isrc || 'N/A'} | Artists: ${track.artists.length}`);

        // Store track
        sqlStatements.push(upsertSpotifyTrackSQL(track));

        // Store all artists
        for (const artistRef of track.artists) {
          try {
            const artist = await getArtist(artistRef.id);
            if (artist) {
              sqlStatements.push(upsertSpotifyArtistSQL(artist));
            }
          } catch (error) {
            console.warn(`    ⚠️  Failed to fetch artist ${artistRef.name}`);
          }
        }

        // Log success
        sqlStatements.push(
          logProcessingSQL(
            track.spotify_track_id,
            'spotify_resolve',
            'success',
            'api',
            `Fetched track and ${track.artists.length} artists`
          )
        );

        successCount++;

        // Rate limit: 10 requests/second max
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`  ❌ ${video.spotify_track_id}: ${error.message}`);
        sqlStatements.push(
          logProcessingSQL(
            video.spotify_track_id,
            'spotify_resolve',
            'failed',
            'api',
            error.message
          )
        );
        failCount++;
      }
    }

    console.log('');
  }

  // Step 4: Create song_pipeline entries for all videos
  console.log('⏳ Creating pipeline entries...');

  // For cached tracks, create pipeline entries immediately
  for (const video of unprocessedVideos.filter(v => cachedTrackIds.has(v.spotify_track_id))) {
    const cached = cachedTracks.find(t => t.spotify_track_id === video.spotify_track_id);
    if (cached) {
      // Get primary artist ID from cache
      const artistResult = await query<{ spotify_artist_id: string }>(`
        SELECT (artists->0->>'id')::text as spotify_artist_id
        FROM spotify_tracks
        WHERE spotify_track_id = '${video.spotify_track_id}'
      `);

      const primaryArtistId = artistResult[0]?.spotify_artist_id || null;

      sqlStatements.push(
        createPipelineEntrySQL(
          video.video_id,
          video.spotify_track_id,
          cached.isrc,
          primaryArtistId
        )
      );

      sqlStatements.push(
        logProcessingSQL(
          video.spotify_track_id,
          'spotify_resolve',
          'success',
          'cache',
          'Used cached track metadata'
        )
      );
    }
  }

  // For newly fetched tracks, get their ISRCs and create entries
  for (const video of uncachedVideos) {
    const trackResult = await query<{ isrc: string | null }>(`
      SELECT isrc FROM spotify_tracks WHERE spotify_track_id = '${video.spotify_track_id}'
    `);

    if (trackResult.length > 0) {
      const artistResult = await query<{ spotify_artist_id: string }>(`
        SELECT (artists->0->>'id')::text as spotify_artist_id
        FROM spotify_tracks
        WHERE spotify_track_id = '${video.spotify_track_id}'
      `);

      const primaryArtistId = artistResult[0]?.spotify_artist_id || null;

      sqlStatements.push(
        createPipelineEntrySQL(
          video.video_id,
          video.spotify_track_id,
          trackResult[0].isrc,
          primaryArtistId
        )
      );
    }
  }

  // Step 5: Execute all SQL statements
  if (sqlStatements.length > 0) {
    try {
      await transaction(sqlStatements);
      console.log(`✅ Executed ${sqlStatements.length} SQL statements`);
    } catch (error) {
      console.error('❌ Failed to execute transaction:', error);
      throw error;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Total videos: ${unprocessedVideos.length}`);
  console.log(`   - Cache hits: ${cachedTracks.length}`);
  console.log(`   - API fetches: ${successCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log('');
  console.log('✅ Done! Videos moved to pipeline with status: spotify_resolved');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await close();
  });
