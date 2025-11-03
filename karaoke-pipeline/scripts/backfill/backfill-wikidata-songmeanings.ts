#!/usr/bin/env bun
/**
 * Backfill SongMeanings IDs in wikidata_artists
 *
 * After fixing P6190 → P7200 in wikidata.ts, this script re-fetches
 * Wikidata data for all existing artists to populate songmeanings IDs.
 *
 * Usage:
 *   bun scripts/backfill/backfill-wikidata-songmeanings.ts [batchSize]
 */

import { query, close } from '../../src/db/neon';
import { getWikidataArtist } from '../../src/services/wikidata';
import { upsertWikidataArtistSQL } from '../../src/db/wikidata';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 50;

  console.log('🎵 Backfilling SongMeanings IDs from Wikidata');
  console.log(`📊 Batch size: ${batchSize}\n`);

  // Find all wikidata_artists that need re-enrichment
  const artistsToProcess = await query<{
    wikidata_id: string;
    spotify_artist_id: string | null;
    current_identifiers: any;
  }>(`
    SELECT
      wikidata_id,
      spotify_artist_id,
      identifiers as current_identifiers
    FROM wikidata_artists
    WHERE wikidata_id IS NOT NULL
    ORDER BY enriched_at ASC
    LIMIT ${batchSize}
  `);

  if (artistsToProcess.length === 0) {
    console.log('✅ No artists to process!\n');
    await close();
    return;
  }

  console.log(`✅ Found ${artistsToProcess.length} artists to re-enrich\n`);

  let successCount = 0;
  let failedCount = 0;
  let songmeaningsFoundCount = 0;

  for (const artist of artistsToProcess) {
    const { wikidata_id, spotify_artist_id, current_identifiers } = artist;

    try {
      console.log(`⏳ Fetching ${wikidata_id}...`);

      // Re-fetch from Wikidata API with corrected property mapping
      const wikidataData = await getWikidataArtist(wikidata_id);

      if (!wikidataData) {
        console.log(`   ⚠️  No data returned from Wikidata API`);
        failedCount++;
        continue;
      }

      // Check if songmeanings ID was found
      const hasSongMeanings = wikidataData.identifiers?.songmeanings;
      if (hasSongMeanings) {
        songmeaningsFoundCount++;
        console.log(`   ✅ Found SongMeanings ID: ${hasSongMeanings}`);
      }

      // Update wikidata_artists with fresh data using upsert
      const sql = upsertWikidataArtistSQL(wikidataData, spotify_artist_id);
      await query(sql);

      successCount++;
      console.log(`   ✅ Updated successfully\n`);

      // Rate limiting (Wikidata requests ~1 per second)
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}\n`);
      failedCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total processed: ${artistsToProcess.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   🎵 SongMeanings IDs found: ${songmeaningsFoundCount}`);

  // Show stats
  const stats = await query<{
    total: number;
    with_songmeanings: number;
  }>(`
    SELECT
      COUNT(*) as total,
      COUNT(identifiers->>'songmeanings') as with_songmeanings
    FROM wikidata_artists
  `);

  console.log(`\n📈 Overall Stats:`);
  console.log(`   Total artists: ${stats[0].total}`);
  console.log(`   With SongMeanings: ${stats[0].with_songmeanings}`);

  // Show some examples
  const examples = await query<{
    wikidata_id: string;
    spotify_artist_id: string;
    songmeanings_id: string;
  }>(`
    SELECT
      wikidata_id,
      spotify_artist_id,
      identifiers->>'songmeanings' as songmeanings_id
    FROM wikidata_artists
    WHERE identifiers->>'songmeanings' IS NOT NULL
    LIMIT 10
  `);

  if (examples.length > 0) {
    console.log(`\n🎯 Example SongMeanings IDs:`);
    for (const ex of examples) {
      console.log(`   ${ex.wikidata_id} → ${ex.songmeanings_id}`);
    }
  }

  console.log('\n✅ Done!\n');
  await close();
}

main().catch(console.error);
