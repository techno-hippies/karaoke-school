/**
 * Direct Karafun CSV Import - The Right Way
 *
 * 1. Create simple table
 * 2. Bulk insert with VALUES in large batches
 * 3. No JSONB nonsense
 */

import { neon } from '@neondatabase/serverless';
import { parse } from 'csv-parse/sync';

// PRODUCTION BRANCH (main)
const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING ||
  'postgresql://neondb_owner:npg_zSPoW2j6RZIb@ep-shiny-star-a182o113-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const CSV_PATH = '/media/t42/th42/Code/karaoke-school-v1/karafuncatalog.csv';

async function main() {
  console.log('🎤 Direct Karafun CSV Import\n');

  const sql = neon(CONNECTION_STRING);

  // 1. Create table
  console.log('1. Creating table...');

  // Drop existing table and recreate
  try {
    await sql.query('DROP TABLE IF EXISTS karafun_songs CASCADE');
  } catch (e) {
    // Ignore errors
  }

  await sql.query(`
    CREATE TABLE karafun_songs (
      karafun_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      year INTEGER,
      is_duo BOOLEAN DEFAULT false,
      is_explicit BOOLEAN DEFAULT false,
      date_added DATE NOT NULL,
      styles TEXT,
      languages TEXT,
      popularity_score INTEGER GENERATED ALWAYS AS (100000 - karafun_id) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await sql.query('CREATE INDEX idx_karafun_artist ON karafun_songs(artist)');
  await sql.query('CREATE INDEX idx_karafun_title ON karafun_songs(title)');
  await sql.query('CREATE INDEX idx_karafun_popularity ON karafun_songs(popularity_score DESC)');
  await sql.query('CREATE INDEX idx_karafun_year ON karafun_songs(year) WHERE year IS NOT NULL');

  console.log('   ✅ Table created\n');

  // 2. Read CSV and filter English only
  console.log('2. Reading CSV...');
  const csvContent = await Bun.file(CSV_PATH).text();
  const allRecords = parse(csvContent, {
    delimiter: ';',
    columns: false,
    skip_empty_lines: true,
    from: 2,
  });

  // Filter English only
  const records = allRecords.filter(row => {
    const languages = row[8]; // languages column
    return languages === 'English';
  });

  console.log(`   Total: ${allRecords.length.toLocaleString()} songs`);
  console.log(`   English only: ${records.length.toLocaleString()} songs\n`);

  // 3. Bulk insert
  console.log('3. Bulk inserting...');
  const batchSize = 1000;
  const batches = Math.ceil(records.length / batchSize);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    const values = batch.map(row => {
      const [id, title, artist, year, duo, explicit, dateAdded, styles, languages] = row;

      const cleanYear = parseInt(year);
      const finalYear = (cleanYear >= 1900 && cleanYear <= 2100) ? cleanYear : null;

      // Fix invalid dates like "0000-00-00"
      const cleanDate = dateAdded && dateAdded !== '0000-00-00' ? `'${dateAdded}'` : 'NOW()';

      return `(${id}, ${esc(title)}, ${esc(artist)}, ${finalYear}, ${duo === '1'}, ${explicit === '1'}, ${cleanDate}, ${esc(styles)}, ${esc(languages)})`;
    }).join(',\n  ');

    const insertSql = `
      INSERT INTO karafun_songs (karafun_id, title, artist, year, is_duo, is_explicit, date_added, styles, languages)
      VALUES ${values}
      ON CONFLICT (karafun_id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        year = EXCLUDED.year,
        updated_at = NOW()
    `;

    await sql.query(insertSql);

    const progress = ((i + batch.length) / records.length * 100).toFixed(1);
    console.log(`   [${batchNum}/${batches}] ${progress}% - ${(i + batch.length).toLocaleString()} songs`);
  }

  // 4. Verify
  console.log('\n4. Verifying...');
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE languages LIKE '%English%') as english,
      COUNT(*) FILTER (WHERE year IS NOT NULL) as with_year
    FROM karafun_songs
  `;

  console.log(`   Total songs: ${result[0].total.toLocaleString()}`);
  console.log(`   English: ${result[0].english.toLocaleString()}`);
  console.log(`   With year: ${result[0].with_year.toLocaleString()}`);

  console.log('\n✅ Import complete!\n');
}

function esc(str: string): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

main().catch(console.error);
