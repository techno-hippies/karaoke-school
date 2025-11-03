#!/bin/bash
# Import LRCLIB via CSV export + PostgreSQL COPY
# Most reliable for existing schema

set -e

SQLITE_PATH="/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3"
CSV_PATH="/tmp/lrclib_export.csv"
LOG_DIR="logs/lrclib"

mkdir -p "$LOG_DIR"

echo "LRCLIB SQLite -> Neon Import (CSV + COPY)"
echo "=========================================="
echo ""
echo "Step 1: Export SQLite to CSV"
echo "SQLite: $SQLITE_PATH ($(du -h $SQLITE_PATH | cut -f1))"
echo "CSV Output: $CSV_PATH"
echo ""

# Export to CSV with proper escaping
echo "Exporting 19M rows to CSV (this may take 10-30 minutes)..."
time sqlite3 "$SQLITE_PATH" <<EOF
.mode csv
.headers on
.output $CSV_PATH
SELECT
    t.id as lrclib_track_id,
    l.id as lrclib_lyrics_id,
    t.name as track_name,
    t.name_lower as track_name_lower,
    t.artist_name,
    t.artist_name_lower,
    t.album_name,
    t.album_name_lower,
    t.duration as duration_seconds,
    l.plain_lyrics,
    l.synced_lyrics,
    CASE WHEN l.has_plain_lyrics = 1 THEN 'true' ELSE 'false' END as has_plain_lyrics,
    CASE WHEN l.has_synced_lyrics = 1 THEN 'true' ELSE 'false' END as has_synced_lyrics,
    CASE WHEN l.instrumental = 1 THEN 'true' ELSE 'false' END as instrumental,
    l.source as lyrics_source,
    l.created_at as lrclib_created_at,
    l.updated_at as lrclib_updated_at
FROM tracks t
JOIN lyrics l ON t.last_lyrics_id = l.id;
EOF

echo ""
echo "CSV export complete!"
echo "Size: $(du -h $CSV_PATH | cut -f1)"
echo ""

echo "Step 2: Import CSV to Neon via COPY"
echo ""

# Create import SQL script
cat > /tmp/lrclib_copy.sql <<'EOSQL'
-- Disable triggers for faster import
SET session_replication_role = 'replica';

-- Copy from CSV
\copy lrclib_corpus(lrclib_track_id, lrclib_lyrics_id, track_name, track_name_lower, artist_name, artist_name_lower, album_name, album_name_lower, duration_seconds, plain_lyrics, synced_lyrics, has_plain_lyrics, has_synced_lyrics, instrumental, lyrics_source, lrclib_created_at, lrclib_updated_at) FROM '/tmp/lrclib_export.csv' WITH (FORMAT csv, HEADER true, NULL '', QUOTE '"', ESCAPE '"');

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Show final count
SELECT COUNT(*) as total_imported FROM lrclib_corpus;
EOSQL

echo "Running PostgreSQL COPY command..."
dotenvx run -f .env -- bun -e "
import { readFileSync } from 'fs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

// Parse connection details
const url = new URL(databaseUrl);
const host = url.hostname;
const port = url.port || 5432;
const database = url.pathname.slice(1);
const user = url.username;
const password = url.password;

console.log('Connection: ' + user + '@' + host + ':' + port + '/' + database);
console.log('');
console.log('Using psql to run COPY command...');
console.log('This will take 30-60 minutes for 19M rows');
console.log('');

// Build psql command
const psqlEnv = {
  PGPASSWORD: password,
  PGSSLMODE: 'require'
};

const { spawnSync } = require('child_process');
const result = spawnSync('psql', [
  '-h', host,
  '-p', port,
  '-U', user,
  '-d', database,
  '-f', '/tmp/lrclib_copy.sql'
], {
  env: { ...process.env, ...psqlEnv },
  stdio: 'inherit'
});

if (result.error) {
  console.error('psql command failed:', result.error);
  process.exit(1);
}

process.exit(result.status || 0);
"

echo ""
echo "Import complete!"
