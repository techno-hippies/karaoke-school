import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

const DATABASE_URL = process.env.DATABASE_URL!;
const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

const sql = neon(DATABASE_URL);

interface ImportStats {
  tableName: string;
  filePath: string;
  totalStatements: number;
  successful: number;
  failed: number;
  startTime: number;
}

async function parseImportLines(filePath: string): Promise<string[]> {
  const fileStream = require('fs').createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const insertStatements: string[] = [];
  let currentStatement = '';
  let inInsertBlock = false;

  for await (const line of rl) {
    if (line.trim().startsWith('INSERT INTO public.')) {
      inInsertBlock = true;
      currentStatement = line;
    } else if (inInsertBlock) {
      currentStatement += '\n' + line;
      
      if (line.trim().endsWith(';')) {
        // Clean up the statement
        let cleanStatement = currentStatement
          .replace(/INSERT INTO public\./g, 'INSERT INTO ')
          .trim();
        
        if (cleanStatement && cleanStatement.length > 20) {
          insertStatements.push(cleanStatement);
        }
        currentStatement = '';
        inInsertBlock = false;
      }
    }
  }

  return insertStatements;
}

async function executeBatch(statements: string[], tableName: string): Promise<{success: number, failed: number}> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    try {
      const statement = statements[i];
      
      // Skip empty or malformed statements
      if (!statement || statement.length < 30) {
        failed++;
        continue;
      }

      await sql.query(statement);
      success++;
      
      // Progress logging
      if ((i + 1) % 1000 === 0 || i === statements.length - 1) {
        const progress = ((i + 1) / statements.length * 100).toFixed(1);
        console.log(`📊 ${tableName}: ${(i + 1).toLocaleString()}/${statements.length.toLocaleString()} (${progress}%)`);
      }
      
    } catch (error: any) {
      failed++;
      
      // Log only the first few errors to avoid spam
      if (failed <= 5) {
        console.error(`❌ Error in ${tableName} (statement ${i + 1}):`, error.message);
        
        // Log the problematic statement
        if (statements[i].length > 100) {
          console.error(`Statement: ${statements[i].substring(0, 100)}...`);
        } else {
          console.error(`Statement: ${statements[i]}`);
        }
      }
    }
  }

  return { success, failed };
}

async function importTable(sqlFile: string): Promise<ImportStats> {
  const tableName = sqlFile.replace('.sql', '');
  const filePath = `${SPOTIFY_DATA_PATH}/${sqlFile}`;
  
  console.log(`\n� Starting import for ${tableName}`);
  console.log(`📁 Reading: ${sqlFile}`);
  
  const stats: ImportStats = {
    tableName,
    filePath,
    totalStatements: 0,
    successful: 0,
    failed: 0,
    startTime: Date.now()
  };

  try {
    // Parse INSERT statements from the SQL dump
    const statements = await parseImportLines(filePath);
    stats.totalStatements = statements.length;
    
    console.log(`📋 Found ${statements.length.toLocaleString()} INSERT statements`);
    
    if (statements.length === 0) {
      console.log(`⚠️  No INSERT statements found in ${sqlFile}`);
      return stats;
    }

    // Process in smaller batches to avoid timeouts
    const batchSize = 500;
    
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      const result = await executeBatch(batch, tableName);
      
      stats.successful += result.success;
      stats.failed += result.failed;
      
      // Brief pause between batches to avoid overwhelming the database
      if (i + batchSize < statements.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log(`✅ ${tableName}: ${stats.successful.toLocaleString()} successful, ${stats.failed.toLocaleString()} failed (${duration}s)`);
    
  } catch (error) {
    console.error(`❌ Fatal error importing ${tableName}:`, error);
    stats.failed = stats.totalStatements;
  }

  return stats;
}

async function main() {
  console.log('🎵 Starting Robust Spotify Dataset Import');
  console.log(`📍 Database: ${DATABASE_URL.substring(0, 50)}...`);
  console.log(`📂 Source: ${SPOTIFY_DATA_PATH}`);
  
  const startTime = Date.now();
  
  // Import order: core tables first, then relationships, then supplemental
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

  const allStats: ImportStats[] = [];
  
  for (const file of files) {
    const stats = await importTable(file);
    allStats.push(stats);
  }

  // Summary
  const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const totalStatements = allStats.reduce((sum, s) => sum + s.totalStatements, 0);
  const totalSuccessful = allStats.reduce((sum, s) => sum + s.successful, 0);
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, 0);
  
  console.log('\n🎉 Import Complete!');
  console.log(`⏱️  Total time: ${totalDuration} minutes`);
  console.log(`📊 Total statements: ${totalStatements.toLocaleString()}`);
  console.log(`✅ Successful: ${totalSuccessful.toLocaleString()}`);
  console.log(`❌ Failed: ${totalFailed.toLocaleString()}`);
  
  const successRate = ((totalSuccessful / totalStatements) * 100).toFixed(1);
  console.log(`📈 Success rate: ${successRate}%`);
  
  if (totalFailed > 0) {
    console.log('\n⚠️  Some imports had failures. Check the logs above for details.');
  }
}

if (require.main === module) {
  main();
}
