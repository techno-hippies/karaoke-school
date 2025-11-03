#!/usr/bin/env bun
/**
 * Processor: Enrich with Wikidata Works
 * Fetches work/composition metadata from Wikidata
 *
 * Usage:
 *   bun src/processors/05b-enrich-wikidata-works.ts [batchSize]
 */

import { query, close } from '../db/neon';
import { getWikidataWork } from '../services/wikidata-works';
import { upsertWikidataWorkSQL, logWikidataWorkProcessingSQL } from '../db/wikidata';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🌐 Wikidata Works Enrichment');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find works from MusicBrainz with Wikidata URLs
  // NOTE: Currently only MusicBrainz source (Quansic doesn't provide work Wikidata IDs yet)
  console.log('⏳ Finding works ready for Wikidata enrichment...');

  const worksToProcess = await query<{
    spotify_track_id: string;
    work_mbid: string;
    title: string;
    wikidata_id: string | null;
    source: string;
  }>(`
    WITH mb_wikidata_works AS (
      -- SOURCE: MusicBrainz works (extract Wikidata URL from relations array)
      SELECT DISTINCT
        sp.spotify_track_id,
        mbw.work_mbid,
        mbw.title,
        (
          SELECT SUBSTRING(rel->>'url' FROM 'Q[0-9]+')
          FROM jsonb_array_elements(mbw.raw_data->'relations') AS rel
          WHERE rel->>'type' = 'wikidata'
            AND rel->'url' IS NOT NULL
          LIMIT 1
        ) as wikidata_id,
        'musicbrainz' as source
      FROM song_pipeline sp
      JOIN musicbrainz_recordings mbr ON sp.recording_mbid = mbr.recording_mbid
      JOIN musicbrainz_works mbw ON mbr.work_mbid = mbw.work_mbid
      WHERE mbw.raw_data IS NOT NULL
        AND mbw.raw_data->'relations' IS NOT NULL
        AND jsonb_array_length(mbw.raw_data->'relations') > 0
        AND sp.status IN ('metadata_enriched', 'lyrics_ready', 'audio_downloaded',
                          'alignment_complete', 'translations_ready', 'stems_separated',
                          'segments_selected', 'enhanced', 'clips_cropped', 'images_generated')
    )
    SELECT
      mw.spotify_track_id,
      mw.work_mbid,
      mw.title,
      mw.wikidata_id,
      mw.source
    FROM mb_wikidata_works mw
    LEFT JOIN wikidata_works ww ON mw.wikidata_id = ww.wikidata_id
    WHERE ww.wikidata_id IS NULL
      AND mw.wikidata_id IS NOT NULL
    ORDER BY mw.spotify_track_id
    LIMIT ${batchSize}
  `);

  if (worksToProcess.length === 0) {
    console.log('✅ No works need Wikidata enrichment. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${worksToProcess.length} works to process`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const work of worksToProcess) {
    const { spotify_track_id, work_mbid, title, wikidata_id, source } = work;

    if (!wikidata_id) {
      console.log(`⏭️  ${title}: No valid Wikidata ID found`);
      skippedCount++;
      continue;
    }

    const sourceLabel = source === 'musicbrainz' ? '📚 MusicBrainz' : '🎯 Unknown';
    console.log(`\n🔍 ${title} (${wikidata_id}) [${sourceLabel}]`);

    try {
      // Fetch from Wikidata API
      console.log(`   Fetching from Wikidata API...`);
      const wikidataWork = await getWikidataWork(wikidata_id);

      if (!wikidataWork) {
        console.log(`   ⚠️  Not found on Wikidata`);
        skippedCount++;
        continue;
      }

      // Log what we found
      console.log(`   ✅ Title: ${wikidataWork.title || 'N/A'}`);
      if (wikidataWork.iswc) {
        console.log(`   ✅ ISWC: ${wikidataWork.iswc}`);
      }
      if (wikidataWork.language) {
        console.log(`   ✅ Language: ${wikidataWork.language}`);
      }

      const composerCount = wikidataWork.composers?.length || 0;
      if (composerCount > 0) {
        console.log(`   ✅ Composers: ${composerCount}`);
      }

      const lyricistCount = wikidataWork.lyricists?.length || 0;
      if (lyricistCount > 0) {
        console.log(`   ✅ Lyricists: ${lyricistCount}`);
      }

      const performerCount = wikidataWork.performers?.length || 0;
      if (performerCount > 0) {
        console.log(`   ✅ Performers: ${performerCount}`);
      }

      const identifierCount = wikidataWork.identifiers ? Object.keys(wikidataWork.identifiers).length : 0;
      if (identifierCount > 0) {
        console.log(`   ✅ Other identifiers: ${identifierCount}`);
      }

      const labelCount = wikidataWork.labels ? Object.keys(wikidataWork.labels).length : 0;
      if (labelCount > 0) {
        console.log(`   ✅ Labels in ${labelCount} languages`);
      }

      // Upsert to database
      const sql = upsertWikidataWorkSQL(wikidataWork, work_mbid, spotify_track_id);
      await query(sql);

      console.log(`   ✅ SAVED`);
      successCount++;

      // Rate limit: 1 request/second
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failedCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log(`   Total processed: ${worksToProcess.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('═══════════════════════════════════════');
  console.log('');

  await close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
