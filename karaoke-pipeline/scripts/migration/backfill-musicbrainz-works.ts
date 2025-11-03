#!/usr/bin/env bun
/**
 * Backfill MusicBrainz Works
 *
 * Fetches missing works for recordings that have work_mbid but no entry in musicbrainz_works table
 *
 * Usage:
 *   bun scripts/migration/backfill-musicbrainz-works.ts [batchSize]
 */

import { query, close } from '../../src/db/neon';
import { lookupWork } from '../../src/services/musicbrainz';
import { upsertMBWorkSQL } from '../../src/db/musicbrainz';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 50;

  console.log('🎵 Backfill MusicBrainz Works');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find works that are referenced but not in the table
  console.log('⏳ Finding missing works...');

  const missingWorks = await query<{
    work_mbid: string;
    count: string;
  }>(`
    SELECT
      mbr.work_mbid,
      COUNT(*) as count
    FROM musicbrainz_recordings mbr
    LEFT JOIN musicbrainz_works mbw ON mbr.work_mbid = mbw.work_mbid
    WHERE mbr.work_mbid IS NOT NULL
      AND mbw.work_mbid IS NULL
    GROUP BY mbr.work_mbid
    ORDER BY count DESC
    LIMIT ${batchSize}
  `);

  if (missingWorks.length === 0) {
    console.log('✅ No missing works! All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${missingWorks.length} missing works to fetch`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;

  for (const { work_mbid, count } of missingWorks) {
    try {
      console.log(`🔍 Fetching work ${work_mbid} (${count} recordings)`);

      // Fetch full work details
      const work = await lookupWork(work_mbid);

      if (!work) {
        console.log(`   ❌ Not found in MusicBrainz API`);
        failedCount++;
        continue;
      }

      console.log(`   ✅ ${work.title}`);

      // Check for Wikidata URL
      const wikidataRel = work.relations?.find(
        rel => rel.type === 'wikidata' && rel.url?.resource
      );
      if (wikidataRel) {
        const qid = wikidataRel.url?.resource.match(/Q\d+/)?.[0];
        if (qid) {
          console.log(`   🌐 Wikidata: ${qid}`);
        }
      }

      // Count contributors
      const contributorCount = work.relations?.filter(r => r.artist).length || 0;
      if (contributorCount > 0) {
        console.log(`   👥 Contributors: ${contributorCount}`);
      }

      // Upsert to database
      const sql = upsertMBWorkSQL(work);
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
  console.log(`   Total processed: ${missingWorks.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('═══════════════════════════════════════');
  console.log('');

  await close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
