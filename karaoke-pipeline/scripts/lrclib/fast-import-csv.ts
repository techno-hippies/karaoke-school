/**
 * Fast bulk import from CSV files using PostgreSQL COPY
 * 10-100x faster than INSERT statements
 */

import { readdir } from 'fs/promises';
import { query } from '../../src/db/neon';
import Database from 'bun:sqlite';

const CSV_DIR = '/tmp/lrclib-export';
const SQLITE_DB = '/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3';
const BATCH_SIZE = 1000; // PostgreSQL max ~32K params = ~1700 rows × 18 cols

async function fastImportDirect() {
  console.log('� Fast LRCLIB Direct Import (No CSV)');
  console.log('======================================');
  console.log('Strategy: Stream from SQLite in large batches');
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log();

  console.log('=� Opening SQLite (this may take a while)...');
  const db = new Database(SQLITE_DB, { readonly: true } as any);

  try {
    // Get total count
    const { total } = db.query('SELECT COUNT(*) as total FROM tracks').get() as { total: number };
    console.log(` Database opened: ${total.toLocaleString()} tracks`);
    console.log();

    let processed = 0;
    let imported = 0;
    const startTime = Date.now();

    // Process in batches
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const offset = batchNum * BATCH_SIZE;

      console.log(`=� Batch ${batchNum + 1}/${totalBatches} (offset: ${offset})`);

      // Fetch batch from SQLite
      const rows = db.query(`
        SELECT
          t.id, l.id as lyrics_id,
          t.name, t.name_lower,
          t.artist_name, t.artist_name_lower,
          t.album_name, t.album_name_lower,
          t.duration,
          l.plain_lyrics, l.synced_lyrics,
          l.has_plain_lyrics, l.has_synced_lyrics, l.instrumental,
          l.source, l.created_at, l.updated_at
        FROM tracks t
        JOIN lyrics l ON t.last_lyrics_id = l.id
        ORDER BY t.id
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `).all() as any[];

      if (rows.length === 0) break;

      // Build bulk insert
      const values: any[] = [];
      const placeholders: string[] = [];

      rows.forEach((row, idx) => {
        const base = idx * 18;
        placeholders.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18})`);
        values.push(
          row.id, row.lyrics_id,
          row.name, row.name_lower,
          row.artist_name, row.artist_name_lower,
          row.album_name, row.album_name_lower,
          row.duration,
          row.plain_lyrics, row.synced_lyrics,
          row.has_plain_lyrics ? 1 : 0,
          row.has_synced_lyrics ? 1 : 0,
          row.instrumental ? 1 : 0,
          row.source,
          row.created_at, row.updated_at,
          new Date().toISOString()
        );
      });

      const insertQuery = `
        INSERT INTO lrclib_corpus (
          lrclib_track_id, lrclib_lyrics_id,
          track_name, track_name_lower,
          artist_name, artist_name_lower,
          album_name, album_name_lower,
          duration_seconds,
          plain_lyrics, synced_lyrics,
          has_plain_lyrics, has_synced_lyrics, instrumental,
          lyrics_source,
          lrclib_created_at, lrclib_updated_at,
          imported_at
        ) VALUES ${placeholders.join(',')}
        ON CONFLICT (lrclib_track_id) DO NOTHING
        RETURNING id
      `;

      const result = await query(insertQuery, values);
      const batchImported = result.length;

      processed += rows.length;
      imported += batchImported;

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const eta = ((total - processed) / rate / 3600).toFixed(1);

      console.log(`    ${batchImported}/${rows.length} inserted`);
      console.log(`   =� Progress: ${processed.toLocaleString()}/${total.toLocaleString()} (${(processed/total*100).toFixed(1)}%)`);
      console.log(`   � Rate: ${rate.toFixed(0)} rows/sec`);
      console.log(`   �  ETA: ${eta} hours`);
      console.log();
    }

    const totalTime = (Date.now() - startTime) / 1000 / 60;
    console.log('( Import Complete!');
    console.log('===================');
    console.log(` Imported: ${imported.toLocaleString()}`);
    console.log(`�  Time: ${totalTime.toFixed(1)} minutes`);
    console.log();

    const stats = await query('SELECT * FROM lrclib_corpus_stats');
    console.log('=� Final Stats:');
    console.table(stats);
  } finally {
    db.close();
  }
}

fastImportDirect().catch(console.error);
