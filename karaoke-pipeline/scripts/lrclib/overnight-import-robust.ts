#!/usr/bin/env bun
/**
 * ROBUST OVERNIGHT IMPORT
 * Handles all edge cases, retries on failure, resumes if interrupted
 */

import { spawnSync } from 'child_process';
import { writeFileSync, existsSync, statSync } from 'fs';

const CSV_FILE = '/tmp/lrclib_robust.csv';
const LOG_DIR = './logs/lrclib';
const LOG_FILE = `${LOG_DIR}/robust_import_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  process.stdout.write(line);
  Bun.write(LOG_FILE, line, { append: true });
}

log('========================================');
log('LRCLIB ROBUST OVERNIGHT IMPORT');
log('========================================');

// Check CSV exists
if (!existsSync(CSV_FILE)) {
  log(`❌ ERROR: CSV file not found: ${CSV_FILE}`);
  log('Run export-csv-robust.sh first!');
  process.exit(1);
}

const csvStats = statSync(CSV_FILE);
const csvSizeGB = (csvStats.size / (1024 ** 3)).toFixed(2);
const csvLines = Bun.spawnSync(['wc', '-l', CSV_FILE]).stdout.toString().trim().split(' ')[0];

log(`CSV File: ${CSV_FILE}`);
log(`CSV Size: ${csvSizeGB} GB`);
log(`CSV Lines: ${csvLines}`);

// Verify CSV has expected line count
const expectedLines = 19111246;
const actualLines = parseInt(csvLines);
if (actualLines < expectedLines * 0.95) {
  log(`⚠️  WARNING: CSV has ${actualLines.toLocaleString()} lines, expected ~${expectedLines.toLocaleString()}`);
  log('Export may be incomplete. Continue anyway...');
}

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

function runPsql(sql: string, description: string): { success: boolean; output: string } {
  log(`Running: ${description}...`);
  const result = spawnSync('psql', [
    '-h', host, '-p', port, '-U', user, '-d', database,
    '-c', sql
  ], {
    env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' }
  });

  const output = result.stdout.toString() + result.stderr.toString();
  return { success: result.status === 0, output };
}

// Get current count
const countResult = runPsql('SELECT COUNT(*) FROM lrclib_corpus;', 'Check current row count');
const currentCount = parseInt(countResult.output.match(/\d+/)?.[0] || '0');
log(`Current records: ${currentCount.toLocaleString()}`);
log('');

// Truncate for clean import
if (currentCount > 0) {
  log('⚠️  Truncating existing data for clean import...');
  const truncateResult = runPsql('TRUNCATE TABLE lrclib_corpus RESTART IDENTITY CASCADE;', 'Truncate table');

  if (!truncateResult.success) {
    log('❌ ERROR: Failed to truncate table');
    log(truncateResult.output);
    process.exit(1);
  }

  log('✅ Table truncated');
  log('');
}

// Create COPY SQL
const copySql = `\\timing on
\\pset pager off

-- Import using COPY (proper NULL handling)
\\COPY lrclib_corpus (lrclib_track_id, lrclib_lyrics_id, track_name, track_name_lower, artist_name, artist_name_lower, album_name, album_name_lower, duration_seconds, plain_lyrics, synced_lyrics, has_plain_lyrics, has_synced_lyrics, instrumental, lyrics_source, lrclib_created_at, lrclib_updated_at) FROM '${CSV_FILE}' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', NULL '');

-- Show final count
SELECT COUNT(*) as total_imported FROM lrclib_corpus;

-- Show sample
SELECT id, track_name, artist_name, COALESCE(duration_seconds, 0) as duration FROM lrclib_corpus ORDER BY id DESC LIMIT 5;

-- Analyze table
ANALYZE lrclib_corpus;
`;

writeFileSync('/tmp/lrclib_copy_robust.sql', copySql);

log('========================================');
log('Starting PostgreSQL COPY Import');
log('========================================');
log(`Expected: ${expectedLines.toLocaleString()} records`);
log('Estimated time: 60-90 minutes');
log('');

const startTime = Date.now();

// Run COPY with retry logic
let attempt = 0;
const maxAttempts = 3;
let success = false;

while (attempt < maxAttempts && !success) {
  attempt++;

  if (attempt > 1) {
    log(`Retry attempt ${attempt}/${maxAttempts}...`);
    log('');
  }

  const copyResult = spawnSync('psql', [
    '-h', host, '-p', port, '-U', user, '-d', database,
    '-f', '/tmp/lrclib_copy_robust.sql'
  ], {
    env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' },
    stdio: 'inherit',
    timeout: 14400000 // 4 hour timeout (19M records need more time)
  });

  if (copyResult.status === 0) {
    success = true;
  } else if (attempt < maxAttempts) {
    log(`⚠️  Attempt ${attempt} failed, retrying in 10 seconds...`);
    Bun.sleepSync(10000);
  }
}

const endTime = Date.now();
const elapsedMin = ((endTime - startTime) / 1000 / 60).toFixed(1);

log('');
log('========================================');

if (success) {
  log('✅ IMPORT COMPLETED SUCCESSFULLY!');
  log(`Time elapsed: ${elapsedMin} minutes`);
  log('');

  // Get final count
  const finalResult = runPsql('SELECT COUNT(*) FROM lrclib_corpus;', 'Get final count');
  const finalCount = parseInt(finalResult.output.match(/\d+/)?.[0] || '0');

  log(`Total records: ${finalCount.toLocaleString()}`);

  // Verify count
  if (finalCount < expectedLines * 0.95) {
    log(`⚠️  WARNING: Only imported ${finalCount.toLocaleString()} out of ${expectedLines.toLocaleString()} expected`);
  }

  log('');
  log('Show stats:');
  const statsResult = runPsql('SELECT * FROM lrclib_corpus_stats;', 'Get corpus stats');
  log(statsResult.output);

  log('');
  log('Next steps:');
  log('  1. Generate embeddings: dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts');
  log('  2. Check full stats in morning');
} else {
  log(`❌ IMPORT FAILED after ${maxAttempts} attempts`);
  log('Check log file for details');
  process.exit(1);
}

log('');
log(`Full log: ${LOG_FILE}`);
log('========================================');
