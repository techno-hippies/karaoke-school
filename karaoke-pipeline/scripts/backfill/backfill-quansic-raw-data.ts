#!/usr/bin/env bun
/**
 * Backfill Quansic raw_data
 *
 * Re-fetches Quansic data for existing recordings to populate raw_data field
 * (which contains work Wikidata IDs and other detailed metadata)
 *
 * Usage:
 *   bun scripts/migration/backfill-quansic-raw-data.ts [batchSize]
 */

import { query, close } from '../../src/db/neon';
import { enrichRecording } from '../../src/services/quansic';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 50;

  console.log('🔄 Backfill Quansic raw_data');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find recordings without raw_data
  console.log('⏳ Finding recordings without raw_data...');

  const recordingsToUpdate = await query<{
    isrc: string;
    title: string;
    spotify_track_id: string | null;
  }>(`
    SELECT isrc, title, spotify_track_id
    FROM quansic_recordings
    WHERE raw_data IS NULL
    ORDER BY enriched_at DESC
    LIMIT ${batchSize}
  `);

  if (recordingsToUpdate.length === 0) {
    console.log('✅ No recordings need backfill. All caught up!');
    await close();
    return;
  }

  console.log(`✅ Found ${recordingsToUpdate.length} recordings to backfill`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;

  for (const recording of recordingsToUpdate) {
    const { isrc, title, spotify_track_id } = recording;

    try {
      console.log(`🔍 ${title} (${isrc})`);

      // Re-fetch from Quansic
      const result = await enrichRecording(isrc, spotify_track_id || undefined);

      if (!result.success || !result.data) {
        console.log(`   ⚠️  Failed to fetch: ${result.error || 'Unknown error'}`);
        failedCount++;
        continue;
      }

      // Update raw_data in database
      const rawDataJson = JSON.stringify(result.data.raw_data).replace(/'/g, "''");
      await query(`
        UPDATE quansic_recordings
        SET raw_data = '${rawDataJson}'::jsonb
        WHERE isrc = '${isrc}'
      `);

      console.log(`   ✅ Updated raw_data`);

      // Check if work has Wikidata ID
      const works = result.data.raw_data?.works || [];
      if (works.length > 0 && works[0]?.work) {
        const contributors = works[0].work.contributors || [];
        const wikidataCount = contributors.filter((c: any) =>
          c.ids?.wikidataIds && c.ids.wikidataIds.length > 0
        ).length;
        if (wikidataCount > 0) {
          console.log(`   🌐 ${wikidataCount} contributors with Wikidata IDs`);
        }
      }

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
  console.log(`   Total processed: ${recordingsToUpdate.length}`);
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
