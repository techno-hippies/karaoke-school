import { importTable } from './import-script';

const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

const tables = [
  { tableName: 'spotify_artist', sqlFile: 'spotify_artist.sql' },
  { tableName: 'spotify_album', sqlFile: 'spotify_album.sql' },
  { tableName: 'spotify_track', sqlFile: 'spotify_track.sql' },
  { tableName: 'spotify_album_artist', sqlFile: 'spotify_album_artist.sql' },
  { tableName: 'spotify_track_artist', sqlFile: 'spotify_track_artist.sql' },
  { tableName: 'spotify_artist_image', sqlFile: 'spotify_artist_image.sql' },
  { tableName: 'spotify_album_image', sqlFile: 'spotify_album_image.sql' },
  { tableName: 'spotify_album_externalid', sqlFile: 'spotify_album_externalid.sql' },
  { tableName: 'spotify_track_externalid', sqlFile: 'spotify_track_externalid.sql' },
];

async function importAll() {
  console.log('🚀 Starting full Spotify dataset import');
  console.log('Import order: Core tables → Relationship tables → Supplemental tables\n');

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    try {
      await importTable(table);
    } catch (error) {
      console.error(`❌ Failed to import ${table.tableName}. Stopping import process.`);
      throw error;
    }
  }
  
  console.log('\n✅ All Spotify tables imported successfully!');
}

if (require.main === module) {
  importAll();
}
