import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function clearTables() {
  console.log('🗑️  Clearing existing Spotify data...');
  
  try {
    const tables = [
      'spotify_track_artist',
      'spotify_album_artist', 
      'spotify_track_externalid',
      'spotify_album_externalid',
      'spotify_artist_image',
      'spotify_album_image',
      'spotify_track',
      'spotify_album',
      'spotify_artist'
    ];
    
    for (const table of tables) {
      await sql`TRUNCATE TABLE ${sql(table)} CASCADE`;
      console.log(`✅ Cleared ${table}`);
    }
    
    console.log('🎉 All tables cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing tables:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  clearTables();
}
