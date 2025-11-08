/**
 * Genius Songs Enrichment Task Processor
 *
 * Matches songs to Genius for work-level metadata:
 * 1. Search and match songs on Genius
 * 2. Fetch full song details
 * 3. Fetch referents (lyrics annotations)
 * 4. Store all data in cache tables
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';
import { GeniusService } from '../../services/genius';
import {
  upsertGeniusSongSQL,
  upsertGeniusReferentSQL,
  upsertGeniusArtistSQL,
} from '../../db/genius';

interface GeniusResult {
  genius_song_id: number;
  genius_artist_id: number;
  url: string;
  language: string | null;
  referent_count: number;
}

/**
 * Main Genius Songs enrichment processor
 */
export async function processGeniusSongs(limit: number = 50): Promise<void> {
  console.log(`\n🎵 Genius Songs Enrichment Task Processor (limit: ${limit})\n`);

  const apiKey = process.env.GENIUS_API_KEY;
  if (!apiKey) {
    console.log('⚠️ GENIUS_API_KEY not set, skipping Genius songs enrichment\n');
    return;
  }

  const genius = new GeniusService(apiKey);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('genius_songs', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending Genius songs enrichment tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track details
    const tracks = await query<{
      title: string;
      artists: Array<{ id: string; name: string }>;
    }>(`
      SELECT title, artists
      FROM tracks
      WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (tracks.length === 0) {
      console.log(`   ⚠️ Track ${task.spotify_track_id} not found, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const track = tracks[0];
    const artistName = track.artists[0]?.name || 'Unknown Artist';
    console.log(`   🎵 "${track.title}" by ${artistName}`);

    try {
      // Step 1: Search and match song on Genius
      console.log(`      🔍 Searching on Genius...`);
      const geniusData = await genius.searchAndMatch(
        track.title,
        artistName,
        task.spotify_track_id
      );

      if (!geniusData) {
        console.log(`      ⚠️ No match found`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'No Genius match found',
        });
        failedCount++;
        continue;
      }

      console.log(`      ✅ Genius ID: ${geniusData.genius_song_id}`);
      if (geniusData.language) {
        console.log(`      🌍 Language: ${geniusData.language}`);
      }

      // Step 2: Fetch full song details
      const fullSong = await genius.getFullSong(geniusData.genius_song_id, task.spotify_track_id);
      if (!fullSong) {
        console.log(`      ⚠️ Could not fetch full song`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'Could not fetch full song details',
        });
        failedCount++;
        continue;
      }

      // Step 3: Fetch referents (lyrics annotations)
      const referents = await genius.getReferents(geniusData.genius_song_id);
      console.log(`      📝 ${referents.length} referents`);

      // Step 4: Ensure primary artist exists
      const artistExists = await query(`
        SELECT 1 FROM genius_artists WHERE genius_artist_id = $1
      `, [geniusData.genius_artist_id]);

      if (artistExists.length === 0) {
        console.log(`      👤 Fetching primary artist (ID: ${geniusData.genius_artist_id})...`);
        const artistData = await genius.getFullArtist(geniusData.genius_artist_id);
        if (artistData) {
          await query(upsertGeniusArtistSQL(artistData));
          console.log(`      ✅ Stored artist: ${artistData.name}`);
        }
      }

      // Step 5: Store all data
      await query(upsertGeniusSongSQL(fullSong));

      for (const referent of referents) {
        await query(upsertGeniusReferentSQL(referent));
      }

      const result: GeniusResult = {
        genius_song_id: geniusData.genius_song_id,
        genius_artist_id: geniusData.genius_artist_id,
        url: geniusData.url,
        language: geniusData.language,
        referent_count: referents.length,
      };

      console.log(`      ✅ Enriched with Genius data`);
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
  processGeniusSongs(limit)
    .catch(error => {
      console.error('❌ Genius songs enrichment failed:', error);
      process.exit(1);
    });
}
