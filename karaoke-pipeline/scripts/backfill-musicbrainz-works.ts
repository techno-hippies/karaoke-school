#!/usr/bin/env bun
/**
 * Backfill missing MusicBrainz works from existing recordings
 *
 * Reads work_mbid from musicbrainz_recordings and fetches full work details
 */

import { query, transaction, close } from '../src/db/neon';
import { lookupWork } from '../src/services/musicbrainz';
import { upsertMBWorkSQL } from '../src/db/musicbrainz';

async function main() {
  console.log('🎵 Backfilling MusicBrainz Works');
  console.log('');

  // Find recordings with work_mbid but work not yet in musicbrainz_works
  const recordingsWithWorks = await query<{
    work_mbid: string;
    title: string;
  }>(`
    SELECT DISTINCT
      r.work_mbid,
      r.title as recording_title
    FROM musicbrainz_recordings r
    LEFT JOIN musicbrainz_works w ON r.work_mbid = w.work_mbid
    WHERE r.work_mbid IS NOT NULL
      AND w.work_mbid IS NULL
    ORDER BY r.work_mbid
  `);

  if (recordingsWithWorks.length === 0) {
    console.log('✅ No works need backfilling. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${recordingsWithWorks.length} works to backfill`);
  console.log('');

  const sqlStatements: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const record of recordingsWithWorks) {
    try {
      console.log(`🔍 Fetching work ${record.work_mbid}`);
      console.log(`   Recording: ${record.title}`);

      const work = await lookupWork(record.work_mbid);

      if (!work) {
        console.log(`   ❌ Work not found in MusicBrainz`);
        failedCount++;
        continue;
      }

      console.log(`   ✅ ${work.title}`);
      console.log(`      ISWC: ${work.iswc || 'none'}`);
      console.log(`      Contributors: ${work.relations?.filter(r => r.artist).length || 0}`);

      sqlStatements.push(upsertMBWorkSQL(work));
      successCount++;

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failedCount++;
    }
  }

  console.log('');

  // Execute all SQL statements
  if (sqlStatements.length > 0) {
    try {
      await transaction(sqlStatements);
      console.log(`✅ Executed ${sqlStatements.length} SQL statements`);
    } catch (error) {
      console.error('❌ Failed to execute transaction:', error);
      throw error;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   Total works: ${recordingsWithWorks.length}`);
  console.log(`   ✅ Fetched: ${successCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('');

  await close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
