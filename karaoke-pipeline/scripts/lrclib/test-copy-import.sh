#!/bin/bash
set -euo pipefail

# Quick test of COPY import with 1000 records

cd /media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline

echo "Testing COPY import with 1000 records..."
echo ""

# Load environment
export $(grep -v '^#' .env | grep DATABASE_URL | xargs)

# Parse DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\(.*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]\+\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "Test CSV: /tmp/lrclib_test_1000.csv"
echo ""

# Create test SQL
cat > /tmp/test_copy.sql <<'EOSQL'
\timing on

-- Show before count
SELECT COUNT(*) as before_count FROM lrclib_corpus;

-- Import test batch
\COPY lrclib_corpus (lrclib_track_id, lrclib_lyrics_id, track_name, track_name_lower, artist_name, artist_name_lower, album_name, album_name_lower, duration_seconds, plain_lyrics, synced_lyrics, has_plain_lyrics, has_synced_lyrics, instrumental, lyrics_source, lrclib_created_at, lrclib_updated_at) FROM '/tmp/lrclib_test_1000.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"', NULL 'NULL');

-- Show after count
SELECT COUNT(*) as after_count FROM lrclib_corpus;

-- Show sample
SELECT id, track_name, artist_name, duration_seconds FROM lrclib_corpus ORDER BY id DESC LIMIT 5;
EOSQL

echo "Running COPY test..."
export PGPASSWORD="$DB_PASS"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /tmp/test_copy.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ TEST SUCCESSFUL!"
    echo "COPY format is compatible. Ready for full overnight import."
else
    echo ""
    echo "❌ TEST FAILED"
    echo "Need to fix CSV format before full import"
    exit 1
fi
