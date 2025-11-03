#!/usr/bin/env bun
/**
 * OVERNIGHT IMPORT - FINAL VERSION
 *
 * Imports /tmp/lrclib_proper.csv into Neon PostgreSQL
 * Expected runtime: 60-90 minutes for 19M records
 * Run this AFTER export-csv-proper.sh completes
 */

import { spawnSync } from 'child_process';
import { writeFileSync, existsSync, statSync } from 'fs';

const CSV_FILE = '/tmp/lrclib_proper.csv';
const LOG_FILE = `./logs/lrclib/overnight_import_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  process.stdout.write(line);
  Bun.write(LOG_FILE, line, { append: true });
}

log('========================================');
log('LRCLIB OVERNIGHT IMPORT - FINAL');
log('========================================');

// Check CSV exists
if (!existsSync(CSV_FILE)) {
  log(`❌ ERROR: CSV file not found: ${CSV_FILE}`);
  log('Run export-csv-proper.sh first!');
  process.exit(1);
}

const csvStats = statSync(CSV_FILE);
const csvSizeGB = (csvStats.size / (1024 ** 3)).toFixed(2);
log(`CSV File: ${CSV_FILE}`);
log(`CSV Size: ${csvSizeGB} GB`);
log('');

// Parse DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  log('❌ ERROR: DATABASE_URL not found');
  process.exit(1);
}

const url = new URL(databaseUrl);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.slice(1);
const user = url.username;
const password = url.password;

log(`Database: ${user}@${host}:${port}/${database}`);
log('');

// Get current count
log('Checking current database state...');
const countResult = spawnSync('psql', [
  '-h', host, '-p', port, '-U', user, '-d', database,
  '-t', '-c', 'SELECT COUNT(*) FROM lrclib_corpus;'
], {
  env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' }
});

const currentCount = parseInt(countResult.stdout.toString().trim());
log(`Current records: ${currentCount.toLocaleString()}`);
log('');

// Confirm truncate
if (currentCount > 0) {
  log('⚠️  Database already contains data');
  log('Truncating table for clean import...');

  const truncateResult = spawnSync('psql', [
    '-h', host, '-p', port, '-U', user, '-d', database,
    '-c', 'TRUNCATE TABLE lrclib_corpus RESTART IDENTITY CASCADE;'
  ], {
    env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' }
  });

  if (truncateResult.status !== 0) {
    log('❌ ERROR: Failed to truncate table');
    log(truncateResult.stderr.toString());
    process.exit(1);
  }

  log('✅ Table truncated');
  log('');
}

// Create COPY SQL
const copySql = `\\timing on
\\pset pager off

-- Import using COPY
\\COPY lrclib_corpus (lrclib_track_id, lrclib_lyrics_id, track_name, track_name_lower, artist_name, artist_name_lower, album_name, album_name_lower, duration_seconds, plain_lyrics, synced_lyrics, has_plain_lyrics, has_synced_lyrics, instrumental, lyrics_source, lrclib_created_at, lrclib_updated_at) FROM '${CSV_FILE}' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL 'NULL');

-- Show final count
SELECT COUNT(*) as total_imported FROM lrclib_corpus;

-- Analyze table
ANALYZE lrclib_corpus;

-- Show stats
SELECT * FROM lrclib_corpus_stats;
`;

writeFileSync('/tmp/lrclib_copy_final.sql', copySql);

log('========================================');
log('Starting PostgreSQL COPY Import');
log('========================================');
log('Expected: 19,111,246 records');
log('Estimated time: 60-90 minutes');
log('');
log('This will run unattended. Output logged to:');
log(LOG_FILE);
log('');

const startTime = Date.now();

// Run COPY
const copyResult = spawnSync('psql', [
  '-h', host, '-p', port, '-U', user, '-d', database,
  '-f', '/tmp/lrclib_copy_final.sql'
], {
  env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' },
  stdio: 'inherit'
});

const endTime = Date.now();
const elapsedMin = ((endTime - startTime) / 1000 / 60).toFixed(1);

log('');
log('========================================');

if (copyResult.status === 0) {
  log('✅ IMPORT COMPLETED SUCCESSFULLY!');
  log(`Time elapsed: ${elapsedMin} minutes`);
  log('');

  // Get final count
  const finalResult = spawnSync('psql', [
    '-h', host, '-p', port, '-U', user, '-d', database,
    '-t', '-c', 'SELECT COUNT(*) FROM lrclib_corpus;'
  ], {
    env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' }
  });

  const finalCount = parseInt(finalResult.stdout.toString().trim());
  log(`Total records: ${finalCount.toLocaleString()}`);
  log('');
  log('Next steps:');
  log('  1. Generate embeddings: dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts');
  log('  2. Check stats: dotenvx run -f .env -- bun -e "import {query} from \'./src/db/neon\'; console.table(await query(\'SELECT * FROM lrclib_corpus_stats\'));"');
} else {
  log('❌ IMPORT FAILED');
  log(`Exit code: ${copyResult.status}`);
  process.exit(1);
}

log('');
log(`Full log: ${LOG_FILE}`);
log('========================================');
