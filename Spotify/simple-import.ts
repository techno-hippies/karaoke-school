import postgres from 'postgres';
import { createInterface } from 'readline';

const sql = postgres(process.env.DATABASE_URL!);

const SPOTIFY_DATA_PATH = '/media/t42/me/QBittorrent/MusicBrainz Tidal Spotify Deezer Dataset 06 July 2025';

interface TableConfig {
  tableName: string;
  sqlFile: string;
  columns: string[];
}

const tables: TableConfig[] = [
  {
    tableName: 'spotify_artist',
    sqlFile: 'spotify_artist.sql',
    columns: ['id', 'name', 'popularity', 'type', 'uri', 'totalfollowers', 'href', 'genres', 'lastsynctime']
  },
  {
    tableName: 'spotify_album', 
    sqlFile: 'spotify_album.sql',
    columns: ['albumid', 'albumgroup', 'albumtype', 'name', 'releasedate', 'releasedateprecision', 'totaltracks', 'type', 'uri', 'label', 'popularity', 'artistid']
  },
  {
    tableName: 'spotify_track',
    sqlFile: 'spotify_track.sql', 
    columns: ['trackid', 'albumid', 'discnumber', 'durationms', 'explicit', 'href', 'isplayable', 'name', 'previewurl', 'tracknumber', 'type', 'uri']
  },
  {
    tableName: 'spotify_album_artist',
    sqlFile: 'spotify_album_artist.sql',
    columns: ['albumid', 'artistid', 'type']
  },
  {
    tableName: 'spotify_track_artist',
    sqlFile: 'spotify_track_artist.sql',
    columns: ['trackid', 'artistid', 'type']
  }
];

async function fastImport(config: TableConfig) {
  const { tableName, sqlFile, columns } = config;
  const filePath = `${SPOTIFY_DATA_PATH}/${sqlFile}`;
  
  console.log(`\n🚀 Importing ${tableName}...`);
  
  const readStream = createInterface({
    input: require('fs').createReadStream(filePath),
    crlfDelay: Infinity
  });

  let batch: any[] = [];
  let totalProcessed = 0;
  let inInsertBlock = false;
  
  const batchSize = 1000;
  
  for await (const line of readStream) {
    if (line.trim().startsWith('INSERT INTO')) {
      inInsertBlock = true;
    }
    
    if (inInsertBlock && line.trim().startsWith('(') && line.trim().endsWith(');')) {
      // Extract values from the INSERT statement
      const valuesStr = line.trim().replace(');', '').replace(/^[^(]+/, '');
      const values = parseValues(valuesStr, columns.length);
      
      batch.push(values);
      totalProcessed++;
      
      if (batch.length >= batchSize) {
        await insertBatch(tableName, columns, batch);
        batch = [];
        
        if (totalProcessed % 10000 === 0) {
          console.log(`${tableName}: ${totalProcessed.toLocaleString()} records imported`);
        }
      }
    }
    
    if (line.trim().endsWith(';')) {
      inInsertBlock = false;
    }
  }
  
  // Insert remaining records
  if (batch.length > 0) {
    await insertBatch(tableName, columns, batch);
  }
  
  console.log(`✅ ${tableName}: ${totalProcessed.toLocaleString()} records imported complete`);
}

function parseValues(valuesStr: string, expectedCount: number): any[] {
  // Simple parser for PostgreSQL VALUES format
  const values: any[] = [];
  let current = '';
  let inQuotes = false;
  let depth = 0;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    
    if (char === "'" && (i === 0 || valuesStr[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    
    if (!inQuotes) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    
    if (!inQuotes && depth === 0 && (char === ',' || i === valuesStr.length - 1)) {
      let finalValue = current.trim();
      if (finalValue === 'NULL') {
        values.push(null);
      } else if (finalValue.startsWith("'") && finalValue.endsWith("'")) {
        values.push(finalValue.slice(1, -1));
      } else if (finalValue === 'true' || finalValue === 'false') {
        values.push(finalValue === 'true');
      } else if (!isNaN(Number(finalValue))) {
        values.push(Number(finalValue));
      } else {
        values.push(finalValue);
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  return values.slice(0, expectedCount);
}

async function insertBatch(tableName: string, columns: string[], batch: any[]) {
  const columnsStr = columns.map(col => sql.identifier(col)).join(', ');
  
  await sql.begin(async (sql) => {
    for (const row of batch) {
      const query = sql`
        INSERT INTO ${sql(tableName)} (${sql.unsafe(columnsStr)})
        VALUES ${row}
      `;
      await sql.query(query);
    }
  });
}

async function main() {
  console.log('🎵 Starting Spotify dataset import');
  
  for (const table of tables) {
    try {
      await fastImport(table);
    } catch (error) {
      console.error(`❌ Error importing ${table.tableName}:`, error);
      throw error;
    }
  }
  
  console.log('\n✅ All imports completed successfully!');
  await sql.end();
}

if (require.main === module) {
  main();
}
