/**
 * Wikidata Works Enrichment Task Processor
 *
 * Enriches tracks with Wikidata work/composition metadata:
 * - ISWC codes
 * - Composers and lyricists
 * - 40+ international library identifiers (VIAF, BNF, DNB, etc.)
 *
 * Depends on: MusicBrainz enrichment (provides Wikidata IDs via work relations)
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';
import { getWikidataWork } from '../../services/wikidata-works';
import { upsertWikidataWorkSQL } from '../../db/wikidata';

interface WorkResult {
  wikidata_id: string;
  iswc: string | null;
  composer_count: number;
  lyricist_count: number;
  identifier_count: number;
}

/**
 * Main Wikidata works enrichment processor
 */
export async function processWikidataWorks(limit: number = 50): Promise<void> {
  console.log(`\n🌐 Wikidata Works Enrichment (limit: ${limit})\n`);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('wikidata_works', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending Wikidata works tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get MusicBrainz work data to extract Wikidata ID
    const works = await query<{
      work_mbid: string;
      title: string;
      raw_data: any;
    }>(`
      SELECT mbw.work_mbid, mbw.title, mbw.raw_data
      FROM musicbrainz_recordings mbr
      JOIN musicbrainz_works mbw ON mbr.work_mbid = mbw.work_mbid
      WHERE mbr.isrc = (
        SELECT isrc FROM tracks WHERE spotify_track_id = $1
      )
      AND mbw.raw_data IS NOT NULL
      LIMIT 1
    `, [task.spotify_track_id]);

    if (works.length === 0) {
      console.log(`   ⚠️ No MusicBrainz work found for ${task.spotify_track_id}, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const work = works[0];

    // Extract Wikidata ID from MusicBrainz relations
    let wikidataId: string | null = null;
    if (work.raw_data?.relations) {
      for (const rel of work.raw_data.relations) {
        if (rel.type === 'wikidata' && rel.url) {
          const match = rel.url.match(/Q[0-9]+/);
          if (match) {
            wikidataId = match[0];
            break;
          }
        }
      }
    }

    if (!wikidataId) {
      console.log(`   ⚠️ No Wikidata ID found for "${work.title}", skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    console.log(`   🌐 "${work.title}" (${wikidataId})`);

    try {
      // Check cache first
      const cached = await query<{ wikidata_id: string }>(`
        SELECT wikidata_id FROM wikidata_works WHERE wikidata_id = $1
      `, [wikidataId]);

      if (cached.length > 0) {
        console.log(`      ✅ Found in cache`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: 'cache',
          result_data: { wikidata_id: wikidataId, cached: true },
        });
        completedCount++;
        continue;
      }

      // Fetch from Wikidata API
      console.log(`      🔍 Fetching from Wikidata...`);
      const wikidataWork = await getWikidataWork(wikidataId);

      if (!wikidataWork) {
        console.log(`      ❌ Not found in Wikidata`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'Work not found in Wikidata',
        });
        failedCount++;
        continue;
      }

      // Store in wikidata_works table
      const wikidataSQL = upsertWikidataWorkSQL(wikidataWork);
      await query(wikidataSQL);

      const resultData: WorkResult = {
        wikidata_id: wikidataId,
        iswc: wikidataWork.iswc,
        composer_count: wikidataWork.composers?.length || 0,
        lyricist_count: wikidataWork.lyricists?.length || 0,
        identifier_count: Object.keys(wikidataWork.identifiers || {}).length,
      };

      console.log(`      ✅ Stored (ISWC: ${wikidataWork.iswc || 'none'}, ${resultData.composer_count} composers, ${resultData.identifier_count} IDs)`);

      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'wikidata',
        result_data: resultData,
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

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
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
  processWikidataWorks(limit)
    .catch(error => {
      console.error('❌ Wikidata works enrichment failed:', error);
      process.exit(1);
    });
}
