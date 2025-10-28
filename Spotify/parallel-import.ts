import { neon } from '@neondatabase/serverless';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DATABASE_URL = process.env.DATABASE_URL!;
const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

// Define table import strategies based on size
const importStrategies = {
  // Large tables - use parallel splitting
  large: ['spotify_track', 'spotify_track_externalid', 'spotify_album_image', 'spotify_artist_image'],
  // Medium tables - single process
  medium: ['spotify_album', 'spotify_album_externalid', 'spotify_track_artist', 'spotify_album_artist'],
  // Small tables - single process, do first
  small: ['spotify_artist']
};

async function splitAndImportTable(tableName: string, numProcesses: number = 4): Promise<void> {
  console.log(`🚀 Starting parallel import for ${tableName} with ${numProcesses} processes`);
  
  const promises = [];
  
  for (let i = 0; i < numProcesses; i++) {
    const processNum = i + 1;
    const command = `dotenvx run -f .env -- bun import-table-chunk.ts ${tableName} ${processNum} ${numProcesses}`;
    
    promises.push(
      execAsync(command, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }).catch(error => {
        console.error(`❌ Process ${processNum} for ${tableName} failed:`, error.message);
        return { stdout: '', stderr: error.message };
      })
    );
  }
  
  try {
    const results = await Promise.all(promises);
    console.log(`✅ All ${numProcesses} processes completed for ${tableName}`);
    
    // Show summary
    results.forEach((result, index) => {
      const lines = result.stdout.trim().split('\n');
      const summaryLine = lines.find(line => line.includes('Total records:') || line.includes('records imported'));
      if (summaryLine) {
        console.log(`   Process ${index + 1}: ${summaryLine.trim()}`);
      }
    });
    
  } catch (error) {
    console.error(`❌ Parallel import failed for ${tableName}:`, error);
    throw error;
  }
}

async function importTableSingle(tableName: string): Promise<void> {
  console.log(`📥 Starting single-process import for ${tableName}`);
  
  const command = `dotenvx run -f .env -- bun import-table-single.ts ${tableName}`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10
    });
    
    console.log(`✅ ${tableName} import completed`);
    const lines = stdout.trim().split('\n');
    const summaryLine = lines.find(line => line.includes('records') || line.includes('imported'));
    if (summaryLine) {
      console.log(`   ${summaryLine.trim()}`);
    }
    
  } catch (error) {
    console.error(`❌ Import failed for ${tableName}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🎵 Starting Parallel Spotify Dataset Import');
  console.log(`📍 Database: ${DATABASE_URL.substring(0, 50)}...`);
  console.log(`📂 Source: ${SPOTIFY_DATA_PATH}\n`);
  
  const startTime = Date.now();
  
  try {
    // Phase 1: Import small tables first (dependencies)
    console.log('🔄 Phase 1: Small/Lookup Tables (Dependency Setup)');
    for (const tableName of importStrategies.small) {
      await importTableSingle(tableName);
    }
    
    // Phase 2: Import medium tables in parallel groups
    console.log('\n🔄 Phase 2: Medium Tables (Group Parallel)');
    const mediumGroup1 = importStrategies.medium.slice(0, 2); // 2 tables in parallel
    const mediumPromises = mediumGroup1.map(table => importTableSingle(table));
    await Promise.all(mediumPromises);
    
    const mediumGroup2 = importStrategies.medium.slice(2, 4); // Next 2 tables
    await Promise.all(mediumGroup2.map(table => importTableSingle(table)));
    
    // Phase 3: Import large tables with internal parallelization
    console.log('\n🔄 Phase 3: Large Tables (Internal Parallelization)');
    
    // Import largest table first
    await splitAndImportTable('spotify_track', 6);
    
    // Import other large tables with fewer processes
    await splitAndImportTable('spotify_track_externalid', 4);
    await splitAndImportTable('spotify_album_image', 3);
    await splitAndImportTable('spotify_artist_image', 2);
    
    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n🎉 All imports completed in ${totalDuration} minutes!`);
    
    // Run verification
    console.log('\n🔍 Running verification...');
    await execAsync('dotenvx run -f .env -- bun check-spotify-import.ts');
    
  } catch (error) {
    console.error('❌ Parallel import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
