import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

interface TableInfo {
  table: string;
  columns: string[];
  count: number;
  size_mb?: number;
}

async function getTableInfo(tableName: string): Promise<TableInfo> {
  try {
    // Get column info
    const columnsResult = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      ORDER BY ordinal_position
    `;
    
    // Get record count
    const countResult = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
    
    return {
      table: tableName,
      columns: columnsResult.map(r => `${r.column_name} (${r.data_type})`),
      count: parseInt(countResult[0].count)
    };
  } catch (error) {
    console.error(`Error getting info for ${tableName}:`, error);
    return {
      table: tableName,
      columns: [],
      count: 0
    };
  }
}

async function verifyAllTables() {
  console.log('🔍 Verifying Spotify data import\n');

  const tables = [
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

  let totalRecords = 0;

  for (const tableName of tables) {
    const info = await getTableInfo(tableName);
    totalRecords += info.count;
    
    console.log(`📊 ${info.table.toUpperCase()}`);
    console.log(`   Records: ${info.count.toLocaleString()}`);
    console.log(`   Columns: ${info.columns.length}`);
    console.log(`   Schema: ${info.columns.slice(0, 3).join(', ')}${info.columns.length > 3 ? '...' : ''}\n`);
  }

  console.log(`📈 Summary:`);
  console.log(`   Total tables: ${tables.length}`);
  console.log(`   Total records: ${totalRecords.toLocaleString()}`);
  
  // Expected counts based on dataset description
  const expected = {
    spotify_artist: 214000,
    spotify_album: 408000,
    spotify_track: 2100000
  };

  console.log('\n🎯 Data Quality Check:');
  for (const [table, expectedCount] of Object.entries(expected)) {
    const info = await getTableInfo(table);
    const accuracy = ((info.count / expectedCount) * 100).toFixed(1);
    const status = info.count >= expectedCount * 0.99 ? '✅' : '⚠️';
    console.log(`   ${status} ${table}: ${info.count.toLocaleString()} / ${expectedCount.toLocaleString()} (${accuracy}%)`);
  }

  await sql.end();
}

if (require.main === module) {
  verifyAllTables();
}
