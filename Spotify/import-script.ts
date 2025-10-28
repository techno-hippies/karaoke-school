import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = postgres(process.env.DATABASE_URL!);

interface ImportConfig {
  tableName: string;
  sqlFile: string;
  batchSize?: number;
}

const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

const importConfigs: ImportConfig[] = [
  // Core tables (most important)
  { tableName: 'spotify_artist', sqlFile: 'spotify_artist.sql' },
  { tableName: 'spotify_album', sqlFile: 'spotify_album.sql' },
  { tableName: 'spotify_track', sqlFile: 'spotify_track.sql' },
  
  // Relationship tables
  { tableName: 'spotify_album_artist', sqlFile: 'spotify_album_artist.sql' },
  { tableName: 'spotify_track_artist', sqlFile: 'spotify_track_artist.sql' },
  
  // Supplemental tables
  { tableName: 'spotify_artist_image', sqlFile: 'spotify_artist_image.sql' },
  { tableName: 'spotify_album_image', sqlFile: 'spotify_album_image.sql' },
  { tableName: 'spotify_album_externalid', sqlFile: 'spotify_album_externalid.sql' },
  { tableName: 'spotify_track_externalid', sqlFile: 'spotify_track_externalid.sql' },
];

async function extractInsertStatements(filePath: string): Promise<string[]> {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const insertStatements: string[] = [];
  let currentStatement = '';
  let inInsertBlock = false;
  
  for (const line of lines) {
    if (line.trim().startsWith('INSERT INTO')) {
      inInsertBlock = true;
      currentStatement = line;
    } else if (inInsertBlock) {
      currentStatement += '\n' + line;
      
      // Check if statement ends with semicolon
      if (line.trim().endsWith(';')) {
        // Convert VALUES statements to use explicit column names
        if (currentStatement.includes('INSERT INTO')) {
          currentStatement = currentStatement.replace(/INSERT INTO public\.(\w+) VALUES \(/gi, 'INSERT INTO $1 (');
        }
        insertStatements.push(currentStatement);
        currentStatement = '';
        inInsertBlock = false;
      }
    }
  }
  
  return insertStatements;
}

async function importTable(config: ImportConfig): Promise<void> {
  const { tableName, sqlFile } = config;
  const filePath = join(SPOTIFY_DATA_PATH, sqlFile);
  
  console.log(`\n=== Starting import for ${tableName} ===`);
  console.log(`Reading from: ${filePath}`);
  
  try {
    const insertStatements = await extractInsertStatements(filePath);
    console.log(`Found ${insertStatements.length} INSERT statements`);
    
    const batchSize = Math.min(1000, Math.max(1, Math.floor(insertStatements.length / 100)));
    let processed = 0;
    
    for (let i = 0; i < insertStatements.length; i += batchSize) {
      const batch = insertStatements.slice(i, i + batchSize);
      
      // Combine all INSERT statements in batch into a single transaction
      await sql.begin(async (sql) => {
        for (const statement of batch) {
          await sql.unsafe(statement);
        }
      });
      
      processed += batch.length;
      const progress = ((processed / insertStatements.length) * 100).toFixed(1);
      
      if (processed % 10000 === 0 || processed === insertStatements.length) {
        console.log(`${tableName}: ${processed.toLocaleString()}/${insertStatements.length.toLocaleString()} records (${progress}%)`);
      }
    }
    
    console.log(`✅ Completed import for ${tableName}: ${processed.toLocaleString()} records`);
    
  } catch (error) {
    console.error(`❌ Error importing ${tableName}:`, error);
    throw error;
  }
}

async function verifyTable(tableName: string): Promise<number> {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
    return result[0].count;
  } catch (error) {
    console.error(`Error verifying table ${tableName}:`, error);
    return 0;
  }
}

async function main() {
  const startTime = Date.now();
  
  console.log('🚀 Starting Spotify data import to Neon database');
  console.log(`Data source: ${SPOTIFY_DATA_PATH}`);
  
  try {
    // Import each table
    for (const config of importConfigs) {
      await importTable(config);
    }
    
    // Verify all imports
    console.log('\n=== Verifying imports ===');
    for (const config of importConfigs) {
      const count = await verifyTable(config.tableName);
      console.log(`${config.tableName}: ${count.toLocaleString()} records`);
    }
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n✅ All imports completed successfully in ${duration} minutes!`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  main();
}

export { extractInsertStatements, importTable };
