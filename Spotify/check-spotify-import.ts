import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

interface TableCount {
  table: string;
  count: number;
}

async function checkSpotifyImport() {
  console.log('🔍 Checking Spotify import status...\n');

  const tables: TableCount[] = [];
  
  const tableNames = [
    'spotify_artist',
    'spotify_album', 
    'spotify_track',
    'spotify_album_artist',
    'spotify_track_artist',
    'spotify_artist_image',
    'spotify_album_image',
    'spotify_album_externalid',
    'spotify_track_externalid'
  ];

  for (const tableName of tableNames) {
    try {
      const result = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
      tables.push({ table: tableName, count: parseInt(result[0].count) });
    } catch (error) {
      console.error(`Error checking ${tableName}:`, error);
      tables.push({ table: tableName, count: 0 });
    }
  }

  // Display results
  console.log('📊 Spotify Tables Status:');
  console.log('═'.repeat(50));
  
  for (const { table, count } of tables) {
    const status = count > 0 ? '✅' : '❌';
    console.log(`${status} ${table.padEnd(25)} ${count.toLocaleString().padStart(10)}`);
  }

  // Summary
  const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);
  const hasData = tables.filter(t => t.count > 0).length;
  
  console.log('═'.repeat(50));
  console.log(`📈 Summary: ${hasData}/9 tables with data`);
  console.log(`🔢 Total records: ${totalRecords.toLocaleString()}`);
  
  // Expected counts
  const expected = {
    'spotify_artist': 214000,
    'spotify_album': 408000,
    'spotify_track': 2100000,
    'spotify_track_externalid': 2100000,
    'spotify_album_externalid': 400000
  };
  
  console.log('\n🎯 Progress vs Expected:');
  let overallProgress = 0;
  let progressCount = 0;
  
  for (const [table, expectedCount] of Object.entries(expected)) {
    const tableData = tables.find(t => t.table === table);
    if (tableData) {
      const progress = Math.min(100, (tableData.count / expectedCount) * 100);
      console.log(`   ${table.padEnd(25)} ${tableData.count.toLocaleString().padStart(10)} / ${expectedCount.toLocaleString()} (${progress.toFixed(1)}%)`);
      
      overallProgress += progress;
      progressCount++;
    }
  }
  
  const avgProgress = progressCount > 0 ? overallProgress / progressCount : 0;
  console.log(`\n📊 Overall Import Progress: ${avgProgress.toFixed(1)}%`);
  
  // Check data quality
  console.log('\n🔧 Data Quality Checks:');
  
  try {
    // Check for ISRC coverage
    const isrcResult = await sql`
      SELECT COUNT(*) as count 
      FROM spotify_track_externalid 
      WHERE name = 'isrc'
    `;
    const isrcCount = parseInt(isrcResult[0].count);
    console.log(`   📋 ISRCs in track_externalid: ${isrcCount.toLocaleString()}`);
    
    // Check for UPC/EAN coverage  
    const upcResult = await sql`
      SELECT COUNT(*) as count 
      FROM spotify_album_externalid 
      WHERE name IN ('upc', 'ean')
    `;
    const upcCount = parseInt(upcResult[0].count);
    console.log(`   📦 UPC/EAN in album_externalid: ${upcCount.toLocaleString()}`);
    
    // Check artist distinctness
    const artistDistinct = await sql`
      SELECT COUNT(DISTINCT id) as count from spotify_artist
    `;
    console.log(`   🎨 Distinct artists: ${artistDistinct[0].count.toLocaleString()}`);
    
  } catch (error) {
    console.error('   ❌ Data quality checks failed:', error);
  }
  
  await sql.end();
  
  return {
    tables,
    totalRecords,
    hasData: hasData / 9,
    progress: avgProgress
  };
}

if (require.main === module) {
  checkSpotifyImport();
}
