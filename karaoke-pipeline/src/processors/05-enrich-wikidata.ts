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

  // Find artists from karaoke_segments → spotify_tracks → match to musicbrainz for Wikidata URL
  console.log('⏳ Finding artists ready for Wikidata enrichment...');

  const artistsToProcess = await query<{
    spotify_artist_id: string;
    artist_name: string;
    wikidata_url: string;
    wikidata_id: string | null;
  }>(`
    WITH processed_artists AS (
      SELECT DISTINCT
        st.artists->0->>'id' as spotify_artist_id,
        st.artists->0->>'name' as artist_name
      FROM karaoke_segments ks
      JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
      WHERE ks.fal_enhanced_grove_cid IS NOT NULL
        AND st.artists->0->>'id' IS NOT NULL
    ),
    artist_wikidata AS (
      SELECT
        pa.spotify_artist_id,
        pa.artist_name,
        (SELECT value FROM jsonb_each_text(mb.all_urls) WHERE key LIKE '%wikidata%' LIMIT 1) as wikidata_url,
        SUBSTRING((SELECT value FROM jsonb_each_text(mb.all_urls) WHERE key LIKE '%wikidata%' LIMIT 1) FROM 'Q[0-9]+') as wikidata_id
      FROM processed_artists pa
      JOIN musicbrainz_artists mb ON LOWER(TRIM(pa.artist_name)) = LOWER(TRIM(mb.name))
      WHERE mb.all_urls IS NOT NULL
        AND (SELECT value FROM jsonb_each_text(mb.all_urls) WHERE key LIKE '%wikidata%' LIMIT 1) IS NOT NULL
    )
    SELECT
      aw.spotify_artist_id,
      aw.artist_name,
      aw.wikidata_url,
      aw.wikidata_id
    FROM artist_wikidata aw
    LEFT JOIN wikidata_artists wd ON aw.wikidata_id = wd.wikidata_id
    WHERE wd.wikidata_id IS NULL
    ORDER BY aw.spotify_artist_id
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
    const { spotify_artist_id, artist_name, wikidata_id } = artist;

    if (!wikidata_id) {
      console.log(`⏭️  ${artist_name}: No valid Wikidata ID found`);
      skippedCount++;
      continue;
    }

    console.log(`\n🔍 ${artist_name} (${wikidata_id})`);

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
