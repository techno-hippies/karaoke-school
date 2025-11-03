#!/usr/bin/env bun
/**
 * Import LRCLib Database to Neon
 *
 * Transfers lyrics from the LRCLib SQLite database to Neon PostgreSQL.
 * Embeddings will be computed in a separate step (02-compute-embeddings.ts).
 *
 * Usage:
 *   bun scripts/lrclib/01-import-lrclib.ts \
 *     --sqlite=/path/to/lrclib.sqlite3 \
 *     --batch-size=1000 \
 *     --skip-existing
 *
 * Estimated time: 2-4 hours for millions of tracks
 */

import { parseArgs } from 'util';
import { query } from '../../src/db/neon';
import Database from 'bun:sqlite';
import path from 'path';

interface LRCLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental?: boolean;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      sqlite: { type: 'string' },
      'batch-size': { type: 'string', default: '1000' },
      'skip-existing': { type: 'boolean', default: true },
      'min-lyrics-length': { type: 'string', default: '50' },
      limit: { type: 'string' },  // For testing
    },
  });

  const sqlitePath = values.sqlite;
  const batchSize = parseInt(values['batch-size'] || '1000');
  const minLyricsLength = parseInt(values['min-lyrics-length'] || '50');
  const limit = values.limit ? parseInt(values.limit) : null;
  const skipExisting = values['skip-existing'] !== false;

  if (!sqlitePath) {
    console.error('❌ Error: --sqlite path required');
    console.error('\nUsage:');
    console.error('  bun scripts/lrclib/01-import-lrclib.ts --sqlite=/path/to/lrclib.sqlite3');
    process.exit(1);
  }

  console.log('\n📚 LRCLib Database Import\n');
  console.log(`SQLite: ${sqlitePath}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Min lyrics length: ${minLyricsLength}`);
  console.log(`Skip existing: ${skipExisting}`);
  if (limit) console.log(`Limit (testing): ${limit}`);
  console.log();

  // Open SQLite database
  const db = new Database(sqlitePath, { readonly: true });

  // First, inspect the schema
  console.log('🔍 Inspecting SQLite schema...\n');
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map((t: any) => t.name).join(', '));

  // Get schema of main table (assuming it's named 'tracks' or similar)
  const mainTable = tables.find((t: any) =>
    t.name.toLowerCase().includes('track') ||
    t.name.toLowerCase().includes('lyric') ||
    t.name.toLowerCase().includes('song')
  ) || tables[0];

  console.log(`\nUsing table: ${(mainTable as any).name}\n`);
  const schema = db.query(`PRAGMA table_info(${(mainTable as any).name})`).all();
  console.log('Columns:');
  schema.forEach((col: any) => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  console.log();

  // Count total records
  const totalQuery = limit
    ? `SELECT COUNT(*) as count FROM ${(mainTable as any).name} LIMIT ${limit}`
    : `SELECT COUNT(*) as count FROM ${(mainTable as any).name}`;
  const totalResult = db.query(totalQuery).get() as { count: number };
  const totalRecords = totalResult.count;

  console.log(`📊 Total records in SQLite: ${totalRecords.toLocaleString()}\n`);

  if (skipExisting) {
    const existingResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM lrclib_lyrics`);
    const existingCount = parseInt(existingResult[0].count);
    console.log(`📊 Existing records in Neon: ${existingCount.toLocaleString()}`);
    console.log(`📊 Records to import: ${(totalRecords - existingCount).toLocaleString()}\n`);
  }

  // Start import
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  const startTime = Date.now();

  while (offset < totalRecords) {
    const limitClause = limit ? Math.min(batchSize, limit - offset) : batchSize;

    // Fetch batch from SQLite
    const batch = db.query(`
      SELECT * FROM ${(mainTable as any).name}
      LIMIT ${limitClause} OFFSET ${offset}
    `).all() as any[];

    if (batch.length === 0) break;

    // Process batch
    for (const row of batch) {
      try {
        // Map SQLite columns to our schema (adjust based on actual schema)
        const lrclib_id = String(row.id || row.lrclib_id || `${row.trackName}-${row.artistName}`.replace(/\W+/g, '-'));
        const track_name = row.trackName || row.track_name || row.title;
        const artist_name = row.artistName || row.artist_name || row.artist;
        const album_name = row.albumName || row.album_name || row.album;
        const duration = row.duration || row.duration_seconds;
        const plain_lyrics = row.plainLyrics || row.plain_lyrics || row.lyrics;
        const synced_lyrics = row.syncedLyrics || row.synced_lyrics;
        const instrumental = row.instrumental || false;

        // Skip if no lyrics or too short
        if (!plain_lyrics || plain_lyrics.length < minLyricsLength) {
          skipped++;
          continue;
        }

        // Skip if no track/artist name
        if (!track_name || !artist_name) {
          skipped++;
          continue;
        }

        // Insert into Neon
        await query(`
          INSERT INTO lrclib_lyrics (
            lrclib_id,
            track_name,
            artist_name,
            album_name,
            duration_seconds,
            plain_lyrics,
            synced_lyrics,
            instrumental,
            has_synced
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (lrclib_id) DO NOTHING
        `, [
          lrclib_id,
          track_name,
          artist_name,
          album_name,
          duration,
          plain_lyrics,
          synced_lyrics,
          instrumental,
          synced_lyrics ? true : false
        ]);

        imported++;
      } catch (error: any) {
        errors++;
        console.error(`   ❌ Error importing row: ${error.message}`);
      }
    }

    offset += batch.length;

    // Progress report
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = imported / elapsed;
    const remaining = totalRecords - offset;
    const eta = remaining / rate;

    console.log(`✅ Progress: ${offset.toLocaleString()}/${totalRecords.toLocaleString()} ` +
      `(${((offset / totalRecords) * 100).toFixed(1)}%) | ` +
      `Imported: ${imported.toLocaleString()} | ` +
      `Skipped: ${skipped.toLocaleString()} | ` +
      `Errors: ${errors} | ` +
      `Rate: ${rate.toFixed(0)}/s | ` +
      `ETA: ${(eta / 60).toFixed(0)}m`);

    if (limit && offset >= limit) break;
  }

  db.close();

  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n🎉 Import complete!\n');
  console.log(`Imported: ${imported.toLocaleString()}`);
  console.log(`Skipped: ${skipped.toLocaleString()}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total time: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`Average rate: ${(imported / totalTime).toFixed(0)} records/second\n`);

  // Compute statistics
  console.log('📊 Computing corpus statistics...');
  await query('SELECT compute_lrclib_stats()');

  const stats = await query<{
    total_tracks: number;
    tracks_with_embeddings: number;
    tracks_with_synced: number;
    avg_lyrics_length: number;
  }>(`
    SELECT * FROM lrclib_corpus_stats
    ORDER BY computed_at DESC
    LIMIT 1
  `);

  if (stats.length > 0) {
    console.log(`\nCorpus statistics:`);
    console.log(`  Total tracks: ${stats[0].total_tracks.toLocaleString()}`);
    console.log(`  With embeddings: ${stats[0].tracks_with_embeddings.toLocaleString()}`);
    console.log(`  With synced lyrics: ${stats[0].tracks_with_synced.toLocaleString()}`);
    console.log(`  Avg lyrics length: ${stats[0].avg_lyrics_length} chars`);
  }

  console.log('\n✅ Next step: Run 02-compute-embeddings.ts to generate vector embeddings\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
