/**
 * Clear all Spotify data (keep table structure)
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function clearAllData() {
  console.log('🧹 Clearing all Spotify data...\n');

  const tables = [
    'spotify_track_artist',
    'spotify_album_artist',
    'spotify_track_externalid',
    'spotify_album_externalid',
    'spotify_album_image',
    'spotify_artist_image',
    'spotify_track',
    'spotify_album',
    'spotify_artist'
  ];

  // Use TRUNCATE for faster clearing
  try {
    await sql`TRUNCATE TABLE spotify_track_artist, spotify_album_artist,
                             spotify_track_externalid, spotify_album_externalid,
                             spotify_album_image, spotify_artist_image,
                             spotify_track, spotify_album, spotify_artist CASCADE`;
    console.log('✅ All tables cleared');
  } catch (error) {
    console.error('⚠️ Error clearing tables:', error);
  }

  console.log('\n✅ All data cleared!');
}

clearAllData().catch(console.error);
