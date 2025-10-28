/**
 * Quick check if Spotify import is complete
 */

import { neon } from '@neondatabase/serverless';

// Try both DATABASE_URL and NEON_DATABASE_URL
const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL or NEON_DATABASE_URL env variable');
}
const sql = neon(dbUrl);

async function checkImport() {
  console.log('📊 Checking Spotify Import Status\n');

  try {
    // Check each table
    const tables = [
      'spotify_artist',
      'spotify_album',
      'spotify_track',
      'spotify_track_externalid',
      'spotify_track_artist'
    ];

    for (const table of tables) {
      try {
        const result = await sql`SELECT COUNT(*) as count FROM ${sql(table)}`;
        const count = Number(result[0].count);
        console.log(`✅ ${table}: ${count.toLocaleString()} rows`);
      } catch (error) {
        console.log(`❌ ${table}: Not found or error`);
      }
    }

    // Check ISRC count (critical for pipeline)
    console.log('\n🔑 ISRC Coverage:');
    const isrcCount = await sql`
      SELECT COUNT(DISTINCT trackid) as tracks_with_isrc
      FROM spotify_track_externalid
      WHERE name = 'isrc'
    `;
    console.log(`   Tracks with ISRC: ${Number(isrcCount[0].tracks_with_isrc).toLocaleString()}`);

    console.log('\n✅ Import check complete!');
  } catch (error) {
    console.error('❌ Error checking import:', error);
  }
}

checkImport().catch(console.error);
