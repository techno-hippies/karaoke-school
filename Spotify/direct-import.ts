import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL!;
const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

// Use neon driver like other projects in this codebase
const sql = neon(DATABASE_URL);

const files = [
  'spotify_artist.sql',
  'spotify_album.sql', 
  'spotify_track.sql',
  'spotify_album_artist.sql',
  'spotify_track_artist.sql',
  'spotify_artist_image.sql',
  'spotify_album_image.sql',
  'spotify_album_externalid.sql',
  'spotify_track_externalid.sql'
];

async function importFile(filename: string) {
  const filePath = `${SPOTIFY_DATA_PATH}/${filename}`;
  const content = readFileSync(filePath, 'utf8');
  
  console.log(`\n📁 Processing ${filename}`);
  
  // Split by semicolons and execute individual statements
  const statements = content
    .split(';\n')
    .filter(stmt => stmt.trim() && 
                    !stmt.trim().startsWith('--') && 
                    !stmt.trim().startsWith('SET') &&
                    !stmt.trim().startsWith('SELECT') &&
                    !stmt.includes('OWNER TOpostgres') &&
                    !stmt.trim().startsWith('CREATE TABLE') &&
                    !stmt.trim().startsWith('ALTER TABLE') &&
                    stmt.trim().includes('INSERT INTO'));
                    
  console.log(`Found ${statements.length} INSERT statements`);
  
  let processed = 0;
  const batchSize = 100;
  
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize);
    
    for (const statement of batch) {
      try {
        if (statement.trim() && statement.trim().includes('INSERT INTO')) {
          // Remove public schema prefix and format properly
          const cleanStatement = statement
            .replace(/INSERT INTO public\./g, 'INSERT INTO ')
            .trim();
            
          if (cleanStatement && !cleanStatement.endsWith(';;')) {
            await sql.query(cleanStatement);
            processed++;
          }
        }
      } catch (error) {
        console.error(`Error in statement ${i + 1}:`, error);
        console.log('Statement:', statement.substring(0, 200) + '...');
        // Continue processing other statements
      }
    }
    
    if (processed % 1000 === 0 || i + batchSize >= statements.length) {
      const progress = ((processed / statements.length) * 100).toFixed(1);
      console.log(`📊 ${filename}: ${processed.toLocaleString()}/${statements.length.toLocaleString()} (${progress}%)`);
    }
  }
  
  console.log(`✅ ${filename}: ${processed.toLocaleString()} records imported`);
}

async function main() {
  console.log('🎵 Starting Spotify dataset import');
  console.log(`Database: ${DATABASE_URL.substring(0, 50)}...`);
  
  const startTime = Date.now();
  
  try {
    for (const file of files) {
      await importFile(file);
    }
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n🎉 All imports completed in ${duration} minutes!`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

if (require.main === module) {
  main();
}
