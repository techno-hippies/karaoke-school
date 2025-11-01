/**
 * Wipe all GRC-20 tables
 *
 * Deletes all data from grc20_* tables in correct dependency order
 * Use this to start fresh with clean data
 */

import { query } from '../../src/db/neon';

async function main() {
  console.log('🗑️  Wiping all GRC-20 tables...\n');

  // Show current counts
  const counts = await query(`
    SELECT
      (SELECT COUNT(*) FROM grc20_artists) as artists,
      (SELECT COUNT(*) FROM grc20_works) as works,
      (SELECT COUNT(*) FROM grc20_work_recordings) as recordings
  `);

  console.log('Current counts:');
  console.log(`  - Artists: ${counts[0].artists}`);
  console.log(`  - Works: ${counts[0].works}`);
  console.log(`  - Recordings: ${counts[0].recordings}\n`);

  if (counts[0].artists === '0' && counts[0].works === '0' && counts[0].recordings === '0') {
    console.log('✅ Tables already empty, nothing to wipe.\n');
    return;
  }

  console.log('⚠️  Deleting all data in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Delete in correct order (due to foreign keys)
  console.log('\n1. Deleting recordings...');
  await query('DELETE FROM grc20_work_recordings');
  console.log('   ✅ grc20_work_recordings cleared');

  console.log('\n2. Deleting works...');
  await query('DELETE FROM grc20_works');
  console.log('   ✅ grc20_works cleared');

  console.log('\n3. Deleting artists...');
  await query('DELETE FROM grc20_artists');
  console.log('   ✅ grc20_artists cleared');

  // Reset sequences
  console.log('\n4. Resetting ID sequences...');
  await query('ALTER SEQUENCE grc20_artists_id_seq RESTART WITH 1');
  await query('ALTER SEQUENCE grc20_works_id_seq RESTART WITH 1');
  await query('ALTER SEQUENCE grc20_work_recordings_id_seq RESTART WITH 1');
  console.log('   ✅ Sequences reset to 1');

  console.log('\n✅ All GRC-20 tables wiped successfully!\n');
  console.log('📝 Next steps:');
  console.log('  1. Run: bun scripts/migration/add-grc20-constraints.ts');
  console.log('  2. Run: bun scripts/migration/populate-grc20-artists.ts');
  console.log('  3. Run: bun scripts/migration/populate-grc20-works.ts');
  console.log('  4. Run: bun scripts/migration/populate-grc20-recordings.ts');
}

main().catch(err => {
  console.error('\n❌ Wipe failed:', err.message);
  process.exit(1);
});
