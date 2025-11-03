/**
 * Import LRCLIB corpus from SQLite to Neon PostgreSQL
 *
 * CHUNKED VERSION: Processes in LIMIT/OFFSET batches (reliable on large DBs)
 *
 * Usage:
 *   # Import all (processes 100k rows at a time)
 *   bun scripts/lrclib/import-chunked.ts
 *
 *   # Resume from specific offset
 *   bun scripts/lrclib/import-chunked.ts --start=1000000
 */

import { Database } from 'bun:sqlite';
import { query } from '../../src/db/neon';

const SQLITE_PATH = '/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3';
const CHUNK_SIZE = 100000; // Read 100k rows per chunk
const BATCH_SIZE = 100;    // Insert 100 rows per batch (1,800 params)
const TOTAL_ROWS = 19111246; // From LRCLIB dump metadata

interface SQLiteTrack {
  track_id: number;
  lyrics_id: number;
  track_name: string;
  track_name_lower: string;
  artist_name: string;
  artist_name_lower: string;
  album_name: string | null;
  album_name_lower: string | null;
  duration: number | null;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
  has_plain_lyrics: boolean;
  has_synced_lyrics: boolean;
  instrumental: boolean;
  lyrics_source: string | null;
  lyrics_created_at: string | null;
  lyrics_updated_at: string | null;
}

async function insertBatch(batch: SQLiteTrack[]): Promise<{ inserted: number; skipped: number }> {
  if (batch.length === 0) return { inserted: 0, skipped: 0 };

  try {
    const values: any[] = [];
    const placeholders: string[] = [];

    batch.forEach((row, idx) => {
      const baseIdx = idx * 18;
      placeholders.push(`(
        $${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4},
        $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8},
        $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12},
        $${baseIdx + 13}, $${baseIdx + 14}, $${baseIdx + 15}, $${baseIdx + 16},
        $${baseIdx + 17}, $${baseIdx + 18}
      )`);

      values.push(
        row.track_id, row.lyrics_id,
        row.track_name, row.track_name_lower,
        row.artist_name, row.artist_name_lower,
        row.album_name, row.album_name_lower,
        row.duration,
        row.plain_lyrics, row.synced_lyrics,
        Boolean(row.has_plain_lyrics),
        Boolean(row.has_synced_lyrics),
        Boolean(row.instrumental),
        row.lyrics_source,
        row.lyrics_created_at, row.lyrics_updated_at,
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
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (lrclib_track_id) DO NOTHING
      RETURNING id
    `;

    const result = await query(insertQuery, values);
    return { inserted: result.length, skipped: batch.length - result.length };
  } catch (error) {
    console.error(`Batch insert FAILED:`, error);
    return { inserted: 0, skipped: 0 };
  }
}

async function importChunk(db: Database, offset: number, limit: number) {
  const selectQuery = `
    SELECT
      t.id as track_id, l.id as lyrics_id,
      t.name as track_name, t.name_lower as track_name_lower,
      t.artist_name, t.artist_name_lower,
      t.album_name, t.album_name_lower,
      t.duration,
      l.plain_lyrics, l.synced_lyrics,
      l.has_plain_lyrics, l.has_synced_lyrics, l.instrumental,
      l.source as lyrics_source,
      l.created_at as lyrics_created_at,
      l.updated_at as lyrics_updated_at
    FROM tracks t
    JOIN lyrics l ON t.last_lyrics_id = l.id
    LIMIT ${limit} OFFSET ${offset}
  `;

  const stmt = db.query(selectQuery);
  const rows = stmt.all() as unknown as SQLiteTrack[];

  if (rows.length === 0) return { imported: 0, skipped: 0 };

  // Process in batches
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const result = await insertBatch(batch);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
  }

  return { imported: totalInserted, skipped: totalSkipped };
}

async function importFromSQLite(startOffset: number = 0) {
  console.log('LRCLIB SQLite -> Neon Import (CHUNKED)');
  console.log('=======================================');
  console.log(`SQLite DB: ${SQLITE_PATH}`);
  console.log(`Chunk size: ${CHUNK_SIZE.toLocaleString()}`);
  console.log(`Batch size: ${BATCH_SIZE.toLocaleString()}`);
  console.log(`Total rows: ${TOTAL_ROWS.toLocaleString()}`);
  console.log(`Starting at: ${startOffset.toLocaleString()}`);
  console.log();

  const db = new Database(SQLITE_PATH, { readonly: true } as any);

  try {
    let totalImported = 0;
    let totalSkipped = 0;
    let offset = startOffset;

    while (offset < TOTAL_ROWS) {
      const chunkNum = Math.floor(offset / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(TOTAL_ROWS / CHUNK_SIZE);
      const startTime = Date.now();

      console.log(`\nChunk #${chunkNum}/${totalChunks} (offset ${offset.toLocaleString()})`);

      const result = await importChunk(db, offset, CHUNK_SIZE);
      totalImported += result.imported;
      totalSkipped += result.skipped;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const rate = (CHUNK_SIZE / parseFloat(duration)).toFixed(0);

      console.log(`  Imported: ${result.imported.toLocaleString()}, Skipped: ${result.skipped.toLocaleString()}`);
      console.log(`  Duration: ${duration}s (${rate} rows/s)`);
      console.log(`  Progress: ${((offset + CHUNK_SIZE) / TOTAL_ROWS * 100).toFixed(2)}% - Total imported: ${totalImported.toLocaleString()}`);

      offset += CHUNK_SIZE;
    }

    console.log('\nImport Complete!');
    console.log('=================');
    console.log(`Total imported: ${totalImported.toLocaleString()}`);
    console.log(`Total skipped: ${totalSkipped.toLocaleString()}`);

    // Show final stats
    const stats = await query('SELECT * FROM lrclib_corpus_stats');
    console.log('\nFinal Stats:');
    console.table(stats);
  } finally {
    db.close();
  }
}

// Parse CLI args
const args = process.argv.slice(2);
let startOffset = 0;

for (const arg of args) {
  if (arg.startsWith('--start=')) {
    startOffset = parseInt(arg.split('=')[1], 10);
  }
}

// Run import
importFromSQLite(startOffset).catch(console.error);
