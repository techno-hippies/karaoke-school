/**
 * Validate GRC-20 data integrity
 *
 * Checks for:
 * - Orphaned works (missing artist references)
 * - Orphaned recordings (missing work references)
 * - Works without recordings (1:1 relationship expected)
 * - Duplicate ISWCs
 * - Duplicate Spotify tracks
 */

import { query } from '../../src/db/neon';

async function main() {
  console.log('🔍 Validating GRC-20 data integrity...\n');

  let hasErrors = false;

  // 1. Check for duplicate ISWCs
  console.log('1. Checking for duplicate ISWCs...');
  const duplicateIswcs = await query(`
    SELECT iswc, COUNT(*) as count, STRING_AGG(id::text || ': ' || title, ', ') as works
    FROM grc20_works
    WHERE iswc IS NOT NULL
    GROUP BY iswc
    HAVING COUNT(*) > 1
  `);

  if (duplicateIswcs.length > 0) {
    console.error('   ❌ Found duplicate ISWCs:');
    duplicateIswcs.forEach((row: any) => {
      console.error(`      ${row.iswc}: ${row.count} works (${row.works})`);
    });
    hasErrors = true;
  } else {
    console.log('   ✅ No duplicate ISWCs\n');
  }

  // 2. Check for duplicate Spotify tracks
  console.log('2. Checking for duplicate Spotify tracks...');
  const duplicateSpotify = await query(`
    SELECT spotify_track_id, COUNT(*) as count,
           STRING_AGG(id::text || ' (work ' || work_id::text || ')', ', ') as recordings
    FROM grc20_work_recordings
    WHERE spotify_track_id IS NOT NULL
    GROUP BY spotify_track_id
    HAVING COUNT(*) > 1
  `);

  if (duplicateSpotify.length > 0) {
    console.error('   ❌ Found duplicate Spotify tracks:');
    duplicateSpotify.forEach((row: any) => {
      console.error(`      ${row.spotify_track_id}: ${row.count} recordings (${row.recordings})`);
    });
    hasErrors = true;
  } else {
    console.log('   ✅ No duplicate Spotify tracks\n');
  }

  // 3. Check for works without recordings
  console.log('3. Checking for works without recordings...');
  const worksWithoutRecordings = await query(`
    SELECT gw.id, gw.title, gw.iswc
    FROM grc20_works gw
    LEFT JOIN grc20_work_recordings gwr ON gwr.work_id = gw.id
    WHERE gwr.id IS NULL
  `);

  if (worksWithoutRecordings.length > 0) {
    console.error(`   ❌ Found ${worksWithoutRecordings.length} works without recordings:`);
    worksWithoutRecordings.slice(0, 5).forEach((row: any) => {
      console.error(`      Work ${row.id}: ${row.title} (ISWC: ${row.iswc || 'none'})`);
    });
    if (worksWithoutRecordings.length > 5) {
      console.error(`      ... and ${worksWithoutRecordings.length - 5} more`);
    }
    hasErrors = true;
  } else {
    console.log('   ✅ All works have recordings (1:1 relationship maintained)\n');
  }

  // 4. Check for orphaned works (missing artists)
  console.log('4. Checking for works with missing artist references...');
  const orphanedWorks = await query(`
    SELECT gw.id, gw.title, gw.primary_artist_id
    FROM grc20_works gw
    LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
    WHERE gw.primary_artist_id IS NOT NULL
      AND ga.id IS NULL
  `);

  if (orphanedWorks.length > 0) {
    console.error(`   ❌ Found ${orphanedWorks.length} works with broken artist references:`);
    orphanedWorks.slice(0, 5).forEach((row: any) => {
      console.error(`      Work ${row.id}: ${row.title} (artist_id: ${row.primary_artist_id})`);
    });
    hasErrors = true;
  } else {
    console.log('   ✅ All works have valid artist references\n');
  }

  // 5. Check for recordings without works (should be impossible with FK)
  console.log('5. Checking for orphaned recordings...');
  const orphanedRecordings = await query(`
    SELECT gwr.id, gwr.work_id, gwr.spotify_track_id
    FROM grc20_work_recordings gwr
    LEFT JOIN grc20_works gw ON gw.id = gwr.work_id
    WHERE gw.id IS NULL
  `);

  if (orphanedRecordings.length > 0) {
    console.error(`   ❌ Found ${orphanedRecordings.length} orphaned recordings:`);
    orphanedRecordings.forEach((row: any) => {
      console.error(`      Recording ${row.id} (work_id: ${row.work_id}, spotify: ${row.spotify_track_id})`);
    });
    hasErrors = true;
  } else {
    console.log('   ✅ No orphaned recordings\n');
  }

  // Summary
  console.log('═'.repeat(60));
  const counts = await query(`
    SELECT
      (SELECT COUNT(*) FROM grc20_artists) as artists,
      (SELECT COUNT(*) FROM grc20_works) as works,
      (SELECT COUNT(*) FROM grc20_work_recordings) as recordings
  `);

  console.log('\n📊 Summary:');
  console.log(`   Artists: ${counts[0].artists}`);
  console.log(`   Works: ${counts[0].works}`);
  console.log(`   Recordings: ${counts[0].recordings}`);

  if (hasErrors) {
    console.log('\n❌ Validation FAILED - data integrity issues found');
    console.log('\n💡 Recommended fix:');
    console.log('   1. Run: bun scripts/migration/wipe-grc20-tables.ts');
    console.log('   2. Run: bun scripts/migration/add-grc20-constraints.ts');
    console.log('   3. Re-populate all scripts in order');
    process.exit(1);
  } else {
    console.log('\n✅ Validation PASSED - data integrity OK');
  }
}

main().catch(err => {
  console.error('\n❌ Validation error:', err.message);
  process.exit(1);
});
