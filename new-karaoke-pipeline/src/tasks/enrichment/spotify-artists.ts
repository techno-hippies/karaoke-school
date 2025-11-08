#!/usr/bin/env bun
/**
 * Spotify Artists Enrichment Task
 * Queue-driven processor that fetches artist metadata from Spotify API
 */

import { query } from '../../db/connection';
import { getArtists } from '../../services/spotify';
import { getPendingEnrichmentTasks, updateEnrichmentTask } from '../../db/queries';

/**
 * Process pending Spotify artist enrichment tasks
 */
async function processSpotifyArtists(limit: number = 50) {
  console.log('\n🎤 Spotify Artists Enrichment');
  console.log('━'.repeat(50));

  // Get pending tasks from enrichment_tasks queue
  const tasks = await getPendingEnrichmentTasks('spotify_artists', limit);

  if (tasks.length === 0) {
    console.log('✓ No pending tasks');
    return;
  }

  console.log(`📊 Found ${tasks.length} pending tasks\n`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // Batch fetch artist IDs from tasks
  const batchSize = 50; // Spotify API limit

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    console.log(`🔍 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasks.length / batchSize)}...`);

    // Get artist IDs for this batch of tracks
    const trackIds = batch.map(task => task.spotify_track_id);
    const artistIdRows = await query<{ primary_artist_id: string }>(`
      SELECT DISTINCT primary_artist_id
      FROM tracks
      WHERE spotify_track_id = ANY($1)
      AND primary_artist_id IS NOT NULL
    `, [trackIds]);

    const artistIds = artistIdRows.map(row => row.primary_artist_id);

    if (artistIds.length === 0) {
      // No artists to fetch - mark all tasks as skipped
      for (const task of batch) {
        await updateEnrichmentTask(task.id, {
          status: 'skipped',
          error_message: 'No artist ID found in track'
        });
        skipped++;
      }
      continue;
    }

    try {
      // Batch fetch from Spotify API
      const artistInfos = await getArtists(artistIds);

      for (let j = 0; j < artistInfos.length; j++) {
        const artistInfo = artistInfos[j];
        const artistId = artistIds[j];

        if (!artistInfo) {
          console.log(`  ⚠️  Artist ${artistId} not found on Spotify`);

          // Mark tasks for this artist as failed
          for (const task of batch) {
            const trackRows = await query<{ primary_artist_id: string }>(`
              SELECT primary_artist_id FROM tracks WHERE spotify_track_id = $1
            `, [task.spotify_track_id]);

            if (trackRows[0]?.primary_artist_id === artistId) {
              await updateEnrichmentTask(task.id, {
                status: 'failed',
                error_message: `Artist ${artistId} not found on Spotify`
              });
              failed++;
            }
          }
          continue;
        }

        // Check if this is real data or placeholder
        const existingRows = await query<{ popularity: number }>(`
          SELECT popularity FROM spotify_artists WHERE spotify_artist_id = $1
        `, [artistInfo.spotify_artist_id]);

        const hasRealData = existingRows.length > 0 && existingRows[0].popularity > 0;

        if (hasRealData) {
          // Already has real data - mark tasks as completed
          for (const task of batch) {
            const trackRows = await query<{ primary_artist_id: string }>(`
              SELECT primary_artist_id FROM tracks WHERE spotify_track_id = $1
            `, [task.spotify_track_id]);

            if (trackRows[0]?.primary_artist_id === artistInfo.spotify_artist_id) {
              await updateEnrichmentTask(task.id, {
                status: 'completed',
                source: 'cache'
              });
              succeeded++;
            }
          }
          console.log(`  ✓ ${artistInfo.name} (cached)`);
          continue;
        }

        // Insert or update artist metadata with real data from API
        await query(`
          INSERT INTO spotify_artists (
            spotify_artist_id,
            name,
            genres,
            popularity,
            followers,
            images,
            external_urls,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (spotify_artist_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            genres = EXCLUDED.genres,
            popularity = EXCLUDED.popularity,
            followers = EXCLUDED.followers,
            images = EXCLUDED.images,
            external_urls = EXCLUDED.external_urls,
            updated_at = NOW()
        `, [
          artistInfo.spotify_artist_id,
          artistInfo.name,
          JSON.stringify(artistInfo.genres),
          artistInfo.popularity,
          artistInfo.followers,
          JSON.stringify(artistInfo.image_url ? [{ url: artistInfo.image_url }] : []),
          JSON.stringify({}),
        ]);

        // Mark all tasks for this artist as completed
        for (const task of batch) {
          const trackRows = await query<{ primary_artist_id: string }>(`
            SELECT primary_artist_id FROM tracks WHERE spotify_track_id = $1
          `, [task.spotify_track_id]);

          if (trackRows[0]?.primary_artist_id === artistInfo.spotify_artist_id) {
            await updateEnrichmentTask(task.id, {
              status: 'completed',
              source: 'spotify_api',
              result_data: {
                name: artistInfo.name,
                popularity: artistInfo.popularity,
                followers: artistInfo.followers,
                genres: artistInfo.genres
              }
            });
            succeeded++;
          }
        }

        console.log(`  ✓ ${artistInfo.name} (${artistInfo.spotify_artist_id})`);
      }
    } catch (error: any) {
      console.error(`  ✗ Batch failed:`, error.message);

      // Mark all tasks in batch as failed
      for (const task of batch) {
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: error.message
        });
        failed++;
      }
    }
  }

  console.log('\n' + '━'.repeat(50));
  console.log(`✅ Enrichment complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);
}

// CLI execution
const limit = parseInt(process.argv[2] || '50');
await processSpotifyArtists(limit);
process.exit(0);
