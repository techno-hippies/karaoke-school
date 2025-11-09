/**
 * Wikidata Artists Enrichment - Simple version that works with actual schema
 *
 * Current wikidata_artists schema:
 * - wikidata_id (PK)
 * - name
 * - aliases (JSONB)
 * - isni
 * - viaf
 * - musicbrainz_id
 * - spotify_id
 * - identifiers (JSONB)
 *
 * Source: Quansic metadata->'ids'->'wikidataIds' array
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';
import { getWikidataArtist } from '../../services/wikidata';

export async function processWikidataArtistsSimple(limit: number = 50): Promise<void> {
  console.log(`\n🌐 Wikidata Artists Enrichment (limit: ${limit})\n`);

  const tasks = await getPendingEnrichmentTasks('wikidata_artists', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending Wikidata artists tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    const trackData = await query<{
      artists: Array<{ id: string; name: string }>;
    }>(`
      SELECT artists FROM tracks WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (trackData.length === 0 || !trackData[0].artists) {
      console.log(`   ⚠️ No artists found for ${task.spotify_track_id}, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const artists = trackData[0].artists;
    console.log(`   🎵 Track has ${artists.length} artist(s)`);

    let artistsProcessed = 0;

    for (const artist of artists) {
      const spotifyArtistId = artist.id;
      const artistName = artist.name;

      console.log(`\n   🎤 ${artistName} (${spotifyArtistId})`);

      // Check cache
      const existing = await query<{ wikidata_id: string }>(`
        SELECT wikidata_id FROM wikidata_artists WHERE spotify_id = $1
      `, [spotifyArtistId]);

      if (existing.length > 0) {
        console.log(`      ✅ Already in cache`);
        artistsProcessed++;
        continue;
      }

      // Get Wikidata ID from Quansic
      const quansicData = await query<{
        wikidata_ids: string[];
      }>(`
        SELECT metadata->'ids'->'wikidataIds' as wikidata_ids
        FROM quansic_artists
        WHERE spotify_artist_id = $1
      `, [spotifyArtistId]);

      let wikidataId: string | null = null;

      if (quansicData.length > 0 && quansicData[0].wikidata_ids) {
        const ids = quansicData[0].wikidata_ids;
        if (Array.isArray(ids) && ids.length > 0) {
          wikidataId = ids[0];
          console.log(`      🎯 Found Wikidata ID from Quansic: ${wikidataId}`);
        }
      }

      if (!wikidataId) {
        console.log(`      ⚠️ No Wikidata ID found, skipping`);
        continue;
      }

      try {
        console.log(`      🔍 Fetching from Wikidata API...`);
        const wikidataArtist = await getWikidataArtist(wikidataId);

        if (!wikidataArtist) {
          console.log(`      ❌ Not found in Wikidata`);
          continue;
        }

        // Extract name from labels
        const name = wikidataArtist.labels?.en || artistName;

        // Store using the ACTUAL schema columns
        await query(`
          INSERT INTO wikidata_artists (
            wikidata_id,
            name,
            spotify_id,
            viaf,
            aliases,
            identifiers
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (wikidata_id) DO UPDATE SET
            name = EXCLUDED.name,
            spotify_id = EXCLUDED.spotify_id,
            viaf = EXCLUDED.viaf,
            aliases = EXCLUDED.aliases,
            identifiers = EXCLUDED.identifiers,
            updated_at = NOW()
        `, [
          wikidataId,
          name,
          spotifyArtistId,
          wikidataArtist.viafId || null,
          JSON.stringify(wikidataArtist.aliases || {}),
          JSON.stringify(wikidataArtist.identifiers || {}),
        ]);

        console.log(`      ✅ Stored: ${name} (VIAF: ${wikidataArtist.viafId || 'none'})`);
        artistsProcessed++;

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    console.log(`\n   📊 Track summary: ${artistsProcessed} processed`);

    if (artistsProcessed > 0) {
      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'wikidata',
        result_data: { artists_processed: artistsProcessed },
      });
      completedCount++;
    } else {
      await updateEnrichmentTask(task.id, {
        status: 'skipped',
        error_message: 'No artists could be enriched',
      });
      skippedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Completed: ${completedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('');
}

if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 50;
  processWikidataArtistsSimple(limit)
    .catch(error => {
      console.error('❌ Wikidata artists enrichment failed:', error);
      process.exit(1);
    });
}
