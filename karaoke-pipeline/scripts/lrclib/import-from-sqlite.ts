/**
 * Import LRCLIB corpus from SQLite to Neon PostgreSQL
 *
 * OPTIMIZED VERSION: Streams rows instead of loading all into memory
 *
 * Usage:
 *   # Import all (19M+ tracks)
 *   bun scripts/lrclib/import-from-sqlite.ts
 *
 *   # Test with limited rows
 *   bun scripts/lrclib/import-from-sqlite.ts --limit=1000
 *
 *   # Resume from specific offset
 *   bun scripts/lrclib/import-from-sqlite.ts --offset=1000000
 */

import { Database } from 'bun:sqlite';
import { query } from '../../src/db/neon';

const SQLITE_PATH = '/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3';
const BATCH_SIZE = 1000; // Insert 1000 rows at a time

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

async function insertBatch(batch: SQLiteTrack[], batchNum: number) {
  if (batch.length === 0) return { inserted: 0, skipped: 0 };

  const startTime = Date.now();

  try {
    // Build INSERT query with ON CONFLICT DO NOTHING
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
        row.track_id,
        row.lyrics_id,
        row.track_name,
        row.track_name_lower,
        row.artist_name,
        row.artist_name_lower,
        row.album_name,
        row.album_name_lower,
        row.duration,
        row.plain_lyrics,
        row.synced_lyrics,
        row.has_plain_lyrics ? 1 : 0,
        row.has_synced_lyrics ? 1 : 0,
        row.instrumental ? 1 : 0,
        row.lyrics_source,
        row.lyrics_created_at,
        row.lyrics_updated_at,
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
    const actualInserted = result.length;
    const skippedInBatch = batch.length - actualInserted;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const rate = (batch.length / parseFloat(duration)).toFixed(0);

    console.log(`Batch #${batchNum}: ${batch.length} rows in ${duration}s (${rate} rows/s) - Inserted: ${actualInserted}, Skipped: ${skippedInBatch}`);

    return { inserted: actualInserted, skipped: skippedInBatch };
  } catch (error) {
    console.error(`Batch #${batchNum} FAILED:`, error);
    return { inserted: 0, skipped: 0 };
  }
}

async function importFromSQLite(options: {
  limit?: number;
  offset?: number;
}) {
  console.log('LRCLIB SQLite -> Neon Import (STREAMING)');
  console.log('=========================================');
  console.log(`SQLite DB: ${SQLITE_PATH}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  if (options.limit) {
    console.log(`Limit: ${options.limit} rows`);
  }
  if (options.offset) {
    console.log(`Offset: ${options.offset} rows`);
  }
  console.log();

  // Open SQLite database
  console.log('Opening SQLite database...');
  const db = new Database(SQLITE_PATH, { readonly: true } as any);

  try {
    // Skip COUNT query (too slow on 69GB database)
    // Total: ~19.1M tracks
    console.log('Total tracks in SQLite: ~19,111,246 (from dump metadata)');
    console.log();

    // Prepare query
    let selectQuery = `
      SELECT
        t.id as track_id,
        l.id as lyrics_id,
        t.name as track_name,
        t.name_lower as track_name_lower,
        t.artist_name,
        t.artist_name_lower,
        t.album_name,
        t.album_name_lower,
        t.duration,
        l.plain_lyrics,
        l.synced_lyrics,
        l.has_plain_lyrics,
        l.has_synced_lyrics,
        l.instrumental,
        l.source as lyrics_source,
        l.created_at as lyrics_created_at,
        l.updated_at as lyrics_updated_at
      FROM tracks t
      JOIN lyrics l ON t.last_lyrics_id = l.id
    `;

    if (options.limit || options.offset) {
      selectQuery += ` LIMIT ${options.limit || -1} OFFSET ${options.offset || 0}`;
    }

    console.log('Streaming from SQLite...');
    const stmt = db.query(selectQuery);
    console.log('Query prepared, starting iteration...');

    // Stream and process
    let imported = 0;
    let skipped = 0;
    let processed = 0;
    let batch: SQLiteTrack[] = [];
    let batchNum = 0;

    console.log('Entering row iterator loop...');
    // Stream rows and build batches
    for (const row of stmt.values() as IterableIterator<any[]>) {
      if (processed === 0) {
        console.log('First row received from SQLite!');
      }
      const track: SQLiteTrack = {
        track_id: row[0],
        lyrics_id: row[1],
        track_name: row[2],
        track_name_lower: row[3],
        artist_name: row[4],
        artist_name_lower: row[5],
        album_name: row[6],
        album_name_lower: row[7],
        duration: row[8],
        plain_lyrics: row[9],
        synced_lyrics: row[10],
        has_plain_lyrics: row[11],
        has_synced_lyrics: row[12],
        instrumental: row[13],
        lyrics_source: row[14],
        lyrics_created_at: row[15],
        lyrics_updated_at: row[16]
      };

      batch.push(track);
      processed++;

      // Insert when batch is full
      if (batch.length >= BATCH_SIZE) {
        batchNum++;
        const result = await insertBatch(batch, batchNum);
        imported += result.inserted;
        skipped += result.skipped;

        console.log(`Progress: ${processed.toLocaleString()} processed, ${imported.toLocaleString()} imported, ${skipped.toLocaleString()} skipped`);
        console.log();

        batch = [];
      }

      // Stop if limit reached
      if (options.limit && processed >= options.limit) {
        break;
      }
    }

    // Insert remaining rows
    if (batch.length > 0) {
      batchNum++;
      const result = await insertBatch(batch, batchNum);
      imported += result.inserted;
      skipped += result.skipped;
    }

    console.log('\nImport Complete!');
    console.log('==================');
    console.log(`Processed: ${processed.toLocaleString()} rows`);
    console.log(`Imported: ${imported.toLocaleString()} rows`);
    console.log(`Skipped: ${skipped.toLocaleString()} (duplicates)`);
    console.log();

    // Show stats
    const stats = await query('SELECT * FROM lrclib_corpus_stats');
    console.log('Final Stats:');
    console.table(stats);
  } finally {
    db.close();
    console.log('SQLite database closed');
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const options: { limit?: number; offset?: number } = {};

for (const arg of args) {
  if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--offset=')) {
    options.offset = parseInt(arg.split('=')[1], 10);
  }
}

// Run import
importFromSQLite(options).catch(console.error);
