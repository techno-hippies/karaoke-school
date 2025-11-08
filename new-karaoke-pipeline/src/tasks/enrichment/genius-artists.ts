/**
 * Genius Artists Enrichment Task Processor
 *
 * Fetches full artist profiles from Genius for all artists discovered in songs:
 * 1. Find tracks with completed Genius Songs tasks
 * 2. Extract unique artist IDs from result_data
 * 3. Fetch full artist details from Genius API
 * 4. Store in genius_artists cache table
 *
 * Note: This processor depends on Genius Songs being completed first
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';
import { GeniusService } from '../../services/genius';
import { upsertGeniusArtistSQL } from '../../db/genius';

interface GeniusArtistResult {
  genius_artist_id: number;
  name: string;
  has_bio: boolean;
  has_social_links: boolean;
}

/**
 * Get unique Genius artist IDs that need enrichment
 */
async function getArtistsNeedingEnrichment(limit: number): Promise<Array<{
  genius_artist_id: number;
  artist_name: string;
  spotify_track_id: string;
}>> {
  // Get artist IDs from completed Genius Songs tasks
  const results = await query<{
    genius_artist_id: number;
    artist_name: string;
    spotify_track_id: string;
  }>(`
    SELECT DISTINCT ON (
      (result_data->>'genius_artist_id')::integer
    )
      (result_data->>'genius_artist_id')::integer as genius_artist_id,
      result_data->>'url' as artist_name,
      spotify_track_id
    FROM enrichment_tasks
    WHERE task_type = 'genius_songs'
      AND status = 'completed'
      AND result_data->>'genius_artist_id' IS NOT NULL
      AND (result_data->>'genius_artist_id')::integer NOT IN (
        SELECT genius_artist_id FROM genius_artists
      )
    ORDER BY (result_data->>'genius_artist_id')::integer
    LIMIT $1
  `, [limit]);

  return results;
}

/**
 * Main Genius Artists enrichment processor
 */
export async function processGeniusArtists(limit: number = 50): Promise<void> {
  console.log(`\n👤 Genius Artists Enrichment Task Processor (limit: ${limit})\n`);

  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.log('⚠️ GENIUS_API_KEY not set, skipping Genius artists enrichment\n');
    return;
  }

  const genius = new GeniusService(apiKey);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('genius_artists', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending Genius artists enrichment tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track details with Genius song data
    const songData = await query<{
      title: string;
      genius_artist_id: number | null;
      artist_name: string | null;
    }>(`
      SELECT
        t.title,
        (et.result_data->>'genius_artist_id')::integer as genius_artist_id,
        et.result_data->>'url' as artist_name
      FROM tracks t
      LEFT JOIN enrichment_tasks et ON t.spotify_track_id = et.spotify_track_id
        AND et.task_type = 'genius_songs'
        AND et.status = 'completed'
      WHERE t.spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (songData.length === 0 || !songData[0].genius_artist_id) {
      console.log(`   ⚠️ Track ${task.spotify_track_id} - No Genius song data, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const track = songData[0];
    const artistId = track.genius_artist_id!;
    const artistName = track.artist_name || 'Unknown';

    console.log(`   🎵 "${track.title}" - Artist: ${artistName} (ID: ${artistId})`);

    try {
      // Check if artist already exists in cache
      const existingArtist = await query(`
        SELECT genius_artist_id FROM genius_artists
        WHERE genius_artist_id = $1
      `, [artistId]);

      if (existingArtist.length > 0) {
        console.log(`      ✅ Artist already in cache`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: 'cache',
          result_data: { genius_artist_id: artistId },
        });
        completedCount++;
        continue;
      }

      // Fetch full artist details from Genius API
      console.log(`      🔍 Fetching from Genius API...`);
      const fullArtist = await genius.getFullArtist(artistId);

      if (!fullArtist) {
        console.log(`      ❌ Could not fetch artist data`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'Could not fetch artist details',
        });
        failedCount++;
        continue;
      }

      // Store artist in database
      await query(upsertGeniusArtistSQL(fullArtist));
      console.log(`      ✅ Stored artist: ${fullArtist.name}`);

      const result: GeniusArtistResult = {
        genius_artist_id: artistId,
        name: fullArtist.name,
        has_bio: !!fullArtist.description,
        has_social_links: !!(fullArtist.facebook_name || fullArtist.instagram_name || fullArtist.twitter_name),
      };

      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'genius_api',
        result_data: result,
      });
      completedCount++;

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      await updateEnrichmentTask(task.id, {
        status: 'failed',
        error_message: error.message,
      });
      failedCount++;
    }

    // Rate limit: Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Completed: ${completedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('');
}

// Run if called directly
if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 50;
  processGeniusArtists(limit)
    .catch(error => {
      console.error('❌ Genius artists enrichment failed:', error);
      process.exit(1);
    });
}
