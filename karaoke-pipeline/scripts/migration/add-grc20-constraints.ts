/**
 * Add data integrity constraints to GRC-20 tables
 *
 * RUN THIS BEFORE ANY POPULATION SCRIPTS!
 *
 * Constraints added:
 * 1. Unique ISWC per work (NULL-safe)
 * 2. Unique Genius song ID per work (NULL-safe)
 * 3. Unique Spotify track ID per recording (NULL-safe)
 * 4. Foreign key constraints already exist
 */

import { query } from '../../src/db/neon';

async function main() {
  console.log('🔒 Adding GRC-20 data integrity constraints...\n');

  // 1. Make genius_artist_id unique constraint NULL-safe (for artists)
  console.log('1. Fixing genius_artist_id unique constraint (NULL-safe)...');
  try {
    await query('ALTER TABLE grc20_artists DROP CONSTRAINT IF EXISTS grc20_artists_genius_artist_id_key');
    await query('DROP INDEX IF EXISTS grc20_artists_genius_artist_id_key');

    await query(`
      CREATE UNIQUE INDEX grc20_artists_genius_artist_id_key
        ON grc20_artists(genius_artist_id)
        WHERE genius_artist_id IS NOT NULL
    `);

    await query(`
      COMMENT ON INDEX grc20_artists_genius_artist_id_key
        IS 'Ensures one artist per Genius artist ID (NULLs allowed - partial unique index)'
    `);
    console.log('   ✅ genius_artist_id constraint updated (NULL-safe)\n');
  } catch (err: any) {
    console.error('   ❌ Error updating genius_artist_id constraint:', err.message);
    throw err;
  }

  // 2. Make genius_song_id unique constraint NULL-safe (for works)
  console.log('2. Fixing genius_song_id unique constraint (NULL-safe)...');
  try {
    await query('ALTER TABLE grc20_works DROP CONSTRAINT IF EXISTS grc20_works_genius_song_id_key');
    await query('DROP INDEX IF EXISTS grc20_works_genius_song_id_key');

    await query(`
      CREATE UNIQUE INDEX grc20_works_genius_song_id_key
        ON grc20_works(genius_song_id)
        WHERE genius_song_id IS NOT NULL
    `);

    await query(`
      COMMENT ON INDEX grc20_works_genius_song_id_key
        IS 'Ensures one work per Genius song (NULLs allowed - partial unique index)'
    `);
    console.log('   ✅ genius_song_id constraint updated (NULL-safe)\n');
  } catch (err: any) {
    console.error('   ❌ Error updating genius_song_id constraint:', err.message);
    throw err;
  }

  // 3. Add unique constraint on ISWC (preferred work identifier)
  console.log('3. Adding ISWC unique constraint (NULL-safe)...');
  try {
    await query('DROP INDEX IF EXISTS grc20_works_iswc_unique');

    await query(`
      CREATE UNIQUE INDEX grc20_works_iswc_unique
        ON grc20_works(iswc)
        WHERE iswc IS NOT NULL
    `);

    await query(`
      COMMENT ON INDEX grc20_works_iswc_unique
        IS 'Ensures one work per ISWC code (NULLs allowed). ISWC from Quansic → MusicBrainz → MLC'
    `);
    console.log('   ✅ ISWC unique constraint added\n');
  } catch (err: any) {
    if (err.message.includes('could not create unique index')) {
      console.error('   ❌ Duplicate ISWCs found! Database has duplicate works.');
      console.error('   → Run wipe script first: DELETE FROM grc20_works; DELETE FROM grc20_artists;');
      throw new Error('Cannot add ISWC constraint - duplicate ISWCs exist');
    }
    throw err;
  }

  // 4. Add unique constraint on spotify_track_id in recordings
  console.log('4. Adding Spotify track ID unique constraint on recordings (NULL-safe)...');
  try {
    await query('DROP INDEX IF EXISTS grc20_work_recordings_spotify_track_id_unique');

    await query(`
      CREATE UNIQUE INDEX grc20_work_recordings_spotify_track_id_unique
        ON grc20_work_recordings(spotify_track_id)
        WHERE spotify_track_id IS NOT NULL
    `);

    await query(`
      COMMENT ON INDEX grc20_work_recordings_spotify_track_id_unique
        IS 'Ensures one recording per Spotify track (NULLs allowed)'
    `);
    console.log('   ✅ Spotify track ID unique constraint added\n');
  } catch (err: any) {
    if (err.message.includes('could not create unique index')) {
      console.error('   ❌ Duplicate Spotify tracks found! Database has duplicate recordings.');
      console.error('   → Run wipe script first');
      throw new Error('Cannot add Spotify constraint - duplicate tracks exist');
    }
    throw err;
  }

  console.log('✅ All constraints added successfully!\n');
  console.log('Summary of protection:');
  console.log('  - No duplicate artists per Genius artist ID ✅');
  console.log('  - No duplicate works per Genius song ID ✅');
  console.log('  - No duplicate works per ISWC ✅');
  console.log('  - No duplicate recordings per Spotify track ✅');
  console.log('  - All NULLs allowed (partial indexes) ✅');
  console.log('\n📝 Now safe to run population scripts in order:');
  console.log('  1. populate-grc20-artists.ts');
  console.log('  2. populate-grc20-works.ts');
  console.log('  3. populate-grc20-recordings.ts');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
