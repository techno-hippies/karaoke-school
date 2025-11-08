/**
 * Wikidata Artists Enrichment Task Processor
 *
 * Enriches artists with Wikidata metadata:
 * - International library IDs (VIAF, GND, BNF, LOC, SBN, BNMM, SELIBR)
 * - Labels in multiple languages
 * - Aliases (validated by Gemini to filter tour names/albums)
 * - 40+ platform identifiers (social media, music platforms, etc.)
 *
 * Depends on:
 * - Genius enrichment (provides artist IDs)
 * - Quansic artists enrichment (provides Wikidata IDs)
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';
import { getWikidataArtist } from '../../services/wikidata';
import { upsertWikidataArtistSQL } from '../../db/wikidata';

interface ArtistResult {
  wikidata_id: string;
  library_ids: number;
  identifiers: number;
  languages: number;
}

/**
 * Main Wikidata artists enrichment processor
 */
export async function processWikidataArtists(limit: number = 50): Promise<void> {
  console.log(`\n🌐 Wikidata Artists Enrichment (limit: ${limit})\n`);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('wikidata_artists', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending Wikidata artists tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track artists
    const trackData = await query<{
      artists: Array<{ id: string; name: string }>;
    }>(`
      SELECT artists
      FROM tracks
      WHERE spotify_track_id = $1
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
    let artistsSkipped = 0;
    const results: ArtistResult[] = [];

    for (const artist of artists) {
      const spotifyArtistId = artist.id;
      const artistName = artist.name;

      console.log(`\n   🎤 ${artistName} (${spotifyArtistId})`);

      // Check if already processed
      const existing = await query<{ wikidata_id: string }>(`
        SELECT wikidata_id FROM wikidata_artists
        WHERE spotify_artist_id = $1
      `, [spotifyArtistId]);

      if (existing.length > 0) {
        console.log(`      ✅ Already in cache`);
        artistsProcessed++;
        continue;
      }

      // Get Wikidata ID from Quansic data
      const quansicData = await query<{
        wikidata_ids: any;
      }>(`
        SELECT raw_data->'ids'->'wikidataIds' as wikidata_ids
        FROM quansic_artists
        WHERE spotify_artist_id = $1
      `, [spotifyArtistId]);

      let wikidataId: string | null = null;

      if (quansicData.length > 0 && quansicData[0].wikidata_ids) {
        const wikidataIds = quansicData[0].wikidata_ids;
        if (Array.isArray(wikidataIds) && wikidataIds.length > 0) {
          wikidataId = wikidataIds[0];
          console.log(`      🎯 Found Wikidata ID from Quansic: ${wikidataId}`);
        }
      }

      // Fallback: Try MusicBrainz (if we have MBID)
      if (!wikidataId) {
        const mbData = await query<{
          all_urls: any;
        }>(`
          SELECT ma.all_urls
          FROM musicbrainz_artists ma
          WHERE ma.artist_mbid IN (
            SELECT artist_mbid FROM genius_artists
            WHERE spotify_artist_id = $1
          )
          LIMIT 1
        `, [spotifyArtistId]);

        if (mbData.length > 0 && mbData[0].all_urls) {
          const allUrls = mbData[0].all_urls;
          for (const [key, value] of Object.entries(allUrls)) {
            if (key.includes('wikidata') && typeof value === 'string') {
              const match = value.match(/Q[0-9]+/);
              if (match) {
                wikidataId = match[0];
                console.log(`      📚 Found Wikidata ID from MusicBrainz: ${wikidataId}`);
                break;
              }
            }
          }
        }
      }

      if (!wikidataId) {
        console.log(`      ⚠️ No Wikidata ID found, skipping`);
        artistsSkipped++;
        continue;
      }

      try {
        // Fetch from Wikidata API
        console.log(`      🔍 Fetching from Wikidata...`);
        const wikidataArtist = await getWikidataArtist(wikidataId);

        if (!wikidataArtist) {
          console.log(`      ❌ Not found in Wikidata`);
          artistsSkipped++;
          continue;
        }

        // Count library IDs
        const libraryIds = [
          wikidataArtist.viafId,
          wikidataArtist.gndId,
          wikidataArtist.bnfId,
          wikidataArtist.locId,
          wikidataArtist.sbnId,
          wikidataArtist.bnmmId,
          wikidataArtist.selibrId,
        ].filter(Boolean).length;

        const identifiers = Object.keys(wikidataArtist.identifiers || {}).length;
        const languages = Object.keys(wikidataArtist.labels || {}).length;

        console.log(`      ✅ Library IDs: ${libraryIds}, Identifiers: ${identifiers}, Languages: ${languages}`);

        // Store in wikidata_artists table
        const wikidataSQL = upsertWikidataArtistSQL(wikidataArtist, spotifyArtistId);
        await query(wikidataSQL);

        artistsProcessed++;
        results.push({
          wikidata_id: wikidataId,
          library_ids: libraryIds,
          identifiers,
          languages,
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.log(`      ❌ Error: ${error.message}`);
        artistsSkipped++;
      }
    }

    console.log(`\n   📊 Track summary: ${artistsProcessed} processed, ${artistsSkipped} skipped`);

    if (artistsProcessed > 0) {
      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'wikidata',
        result_data: {
          artists_processed: artistsProcessed,
          artists_skipped: artistsSkipped,
          results,
        },
      });
      completedCount++;
    } else {
      await updateEnrichmentTask(task.id, {
        status: 'skipped',
        error_message: 'No artists could be enriched (no Wikidata IDs found)',
      });
      skippedCount++;
    }
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
  processWikidataArtists(limit)
    .catch(error => {
      console.error('❌ Wikidata artists enrichment failed:', error);
      process.exit(1);
    });
}
