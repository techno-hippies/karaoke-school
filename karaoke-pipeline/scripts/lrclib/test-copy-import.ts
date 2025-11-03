#!/usr/bin/env bun
/**
 * Test COPY import with 1000 records
 */

import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';

console.log('Testing COPY import with 1000 records...\n');

// Parse DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const url = new URL(databaseUrl);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.slice(1);
const user = url.username;
const password = url.password;

console.log(`Database: ${user}@${host}:${port}/${database}`);
console.log('Test CSV: /tmp/lrclib_test_1000.csv\n');

// Create test SQL
const testSql = `\\timing on

-- Show before count
SELECT COUNT(*) as before_count FROM lrclib_corpus;

-- Import test batch
\\COPY lrclib_corpus (lrclib_track_id, lrclib_lyrics_id, track_name, track_name_lower, artist_name, artist_name_lower, album_name, album_name_lower, duration_seconds, plain_lyrics, synced_lyrics, has_plain_lyrics, has_synced_lyrics, instrumental, lyrics_source, lrclib_created_at, lrclib_updated_at) FROM '/tmp/lrclib_test_1000.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"', NULL 'NULL');

-- Show after count
SELECT COUNT(*) as after_count FROM lrclib_corpus;

-- Show sample
SELECT id, track_name, artist_name, duration_seconds FROM lrclib_corpus ORDER BY id DESC LIMIT 5;
`;

writeFileSync('/tmp/test_copy.sql', testSql);

console.log('Running COPY test...\n');

const result = spawnSync('psql', [
  '-h', host,
  '-p', port,
  '-U', user,
  '-d', database,
  '-f', '/tmp/test_copy.sql'
], {
  env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' },
  stdio: 'inherit'
});

if (result.status === 0) {
  console.log('\n✅ TEST SUCCESSFUL!');
  console.log('COPY format is compatible. Ready for full overnight import.');
} else {
  console.log('\n❌ TEST FAILED');
  console.log('Need to fix CSV format before full import');
  process.exit(1);
}
