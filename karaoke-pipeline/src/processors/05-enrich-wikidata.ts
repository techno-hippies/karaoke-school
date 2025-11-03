#!/usr/bin/env bun
/**
 * Processor: Enrich with Wikidata
 * Fetches international library IDs and identifiers from Wikidata
 *
 * Usage:
 *   bun src/processors/05-enrich-wikidata.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';
import { getWikidataArtist } from '../services/wikidata';
import { upsertWikidataArtistSQL, logWikidataProcessingSQL } from '../db/wikidata';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🌐 Wikidata Enrichment');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find artists from grc20_artists with dual-source Wikidata ID discovery:
  // PRIMARY: Quansic (quansic_artists.raw_data.ids.wikidataIds)
  // FALLBACK: MusicBrainz (musicbrainz_artists.all_urls)
  // ARCHITECTURAL FIX: Query from grc20_artists instead of song_pipeline
  // This ensures ALL artists (including featured artists and group members) get enriched
  console.log('⏳ Finding artists ready for Wikidata enrichment...');

  const artistsToProcess = await query<{
    spotify_artist_id: string;
    artist_name: string;
    wikidata_id: string | null;
    source: string;
  }>(`
    WITH quansic_wikidata AS (
      -- PRIMARY SOURCE: Quansic
      SELECT DISTINCT
        ga.spotify_artist_id,
        ga.name as artist_name,
        qa.raw_data->'ids'->'wikidataIds'->>0 as wikidata_id,
        'quansic' as source
      FROM grc20_artists ga
      JOIN quansic_artists qa ON ga.spotify_artist_id = qa.spotify_artist_id
      WHERE qa.raw_data->'ids'->'wikidataIds' IS NOT NULL
        AND jsonb_array_length(qa.raw_data->'ids'->'wikidataIds') > 0
    ),
    mb_wikidata AS (
      -- FALLBACK SOURCE: MusicBrainz
      SELECT DISTINCT
        ga.spotify_artist_id,
        ga.name as artist_name,
        SUBSTRING((SELECT value FROM jsonb_each_text(ma.all_urls)
                   WHERE key LIKE '%wikidata%' LIMIT 1) FROM 'Q[0-9]+') as wikidata_id,
        'musicbrainz' as source
      FROM grc20_artists ga
      JOIN musicbrainz_artists ma ON ga.mbid = ma.artist_mbid
      WHERE ma.all_urls IS NOT NULL
        AND (SELECT value FROM jsonb_each_text(ma.all_urls) WHERE key LIKE '%wikidata%' LIMIT 1) IS NOT NULL
    ),
    combined_sources AS (
      -- Prioritize Quansic, use MusicBrainz as fallback
      SELECT
        COALESCE(qw.spotify_artist_id, mw.spotify_artist_id) as spotify_artist_id,
        COALESCE(qw.artist_name, mw.artist_name) as artist_name,
        COALESCE(qw.wikidata_id, mw.wikidata_id) as wikidata_id,
        COALESCE(qw.source, mw.source) as source
      FROM quansic_wikidata qw
      FULL OUTER JOIN mb_wikidata mw ON qw.spotify_artist_id = mw.spotify_artist_id
      WHERE COALESCE(qw.wikidata_id, mw.wikidata_id) IS NOT NULL
    )
    SELECT
      cs.spotify_artist_id,
      cs.artist_name,
      cs.wikidata_id,
      cs.source
    FROM combined_sources cs
    LEFT JOIN wikidata_artists wd ON cs.wikidata_id = wd.wikidata_id
    WHERE wd.wikidata_id IS NULL
    ORDER BY cs.source DESC, cs.spotify_artist_id
    LIMIT ${batchSize}
  `);

  if (artistsToProcess.length === 0) {
    console.log('✅ No artists need Wikidata enrichment. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${artistsToProcess.length} artists to process`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const artist of artistsToProcess) {
    const { spotify_artist_id, artist_name, wikidata_id, source } = artist;

    if (!wikidata_id) {
      console.log(`⏭️  ${artist_name}: No valid Wikidata ID found`);
      skippedCount++;
      continue;
    }

    const sourceLabel = source === 'quansic' ? '🎯 Quansic' : '📚 MusicBrainz';
    console.log(`\n🔍 ${artist_name} (${wikidata_id}) [${sourceLabel}]`);

    try {
      // Fetch from Wikidata API
      console.log(`   Fetching from Wikidata API...`);
      const wikidataArtist = await getWikidataArtist(wikidata_id);

      if (!wikidataArtist) {
        console.log(`   ⚠️  Not found on Wikidata`);
        // await query(logWikidataProcessingSQL(spotify_artist_id, 'skipped', 'Not found on Wikidata'));
        skippedCount++;
        continue;
      }

      // Log what we found
      const libraryIds = [];
      if (wikidataArtist.viafId) libraryIds.push(`VIAF: ${wikidataArtist.viafId}`);
      if (wikidataArtist.gndId) libraryIds.push(`GND: ${wikidataArtist.gndId}`);
      if (wikidataArtist.bnfId) libraryIds.push(`BNF: ${wikidataArtist.bnfId}`);
      if (wikidataArtist.locId) libraryIds.push(`LOC: ${wikidataArtist.locId}`);
      if (wikidataArtist.sbnId) libraryIds.push(`SBN: ${wikidataArtist.sbnId}`);
      if (wikidataArtist.bnmmId) libraryIds.push(`BNMM: ${wikidataArtist.bnmmId}`);
      if (wikidataArtist.selibrId) libraryIds.push(`SELIBR: ${wikidataArtist.selibrId}`);

      if (libraryIds.length > 0) {
        console.log(`   ✅ Library IDs: ${libraryIds.join(', ')}`);
      }

      const identifierCount = wikidataArtist.identifiers ? Object.keys(wikidataArtist.identifiers).length : 0;
      if (identifierCount > 0) {
        console.log(`   ✅ Other identifiers: ${identifierCount}`);
      }

      const labelCount = wikidataArtist.labels ? Object.keys(wikidataArtist.labels).length : 0;
      if (labelCount > 0) {
        console.log(`   ✅ Labels in ${labelCount} languages`);
      }

      // Upsert to database
      const sql = upsertWikidataArtistSQL(wikidataArtist, spotify_artist_id);
      await query(sql);
      // await transaction([
      //   sql,
      //   logWikidataProcessingSQL(spotify_artist_id, 'success', 'Wikidata enrichment complete', {
      //     libraryIds: libraryIds.length,
      //     identifiers: identifierCount,
      //     labels: labelCount,
      //   }),
      // ]);

      console.log(`   ✅ SAVED`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      // await query(logWikidataProcessingSQL(spotify_artist_id, 'failed', error.message));
      failedCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log(`   Total processed: ${artistsToProcess.length}`);
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
