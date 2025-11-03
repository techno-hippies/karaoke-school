#!/bin/bash
# Import LRCLIB SQLite dump to Neon using pgloader

set -e

echo "LRCLIB SQLite -> Neon Import (pgloader)"
echo "========================================"
echo ""

# Load env vars
if [ ! -f .env ]; then
  echo "Error: .env file not found"
  exit 1
fi

# Get DATABASE_URL from env using dotenvx
echo "Loading DATABASE_URL..."
DATABASE_URL=$(dotenvx run -f .env -- bun -e "console.log(process.env.DATABASE_URL)")

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in .env"
  exit 1
fi

# Remove ANSI color codes from dotenvx output
DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/\x1B\[[0-9;]*[JKmsu]//g' | tail -1)

echo "Database URL: ${DATABASE_URL:0:30}..."
echo ""

# SQLite path
SQLITE_PATH="/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3"

if [ ! -f "$SQLITE_PATH" ]; then
  echo "Error: SQLite file not found at $SQLITE_PATH"
  exit 1
fi

echo "SQLite DB: $SQLITE_PATH"
echo "Size: $(du -h $SQLITE_PATH | cut -f1)"
echo ""

# Create pgloader load file
cat > /tmp/lrclib_pgloader.load <<EOF
LOAD DATABASE
    FROM sqlite://$SQLITE_PATH
    INTO $DATABASE_URL

WITH
    include drop,
    create tables,
    create indexes,
    reset sequences,
    downcase identifiers,
    batch rows = 100000,
    batch size = 20MB,
    prefetch rows = 100000,
    encoding 'utf-8'

SET
    work_mem to '128MB',
    maintenance_work_mem to '512MB'

CAST
    column tracks.id to integer,
    column lyrics.id to integer,
    column tracks.duration to numeric,
    column lyrics.has_plain_lyrics to boolean,
    column lyrics.has_synced_lyrics to boolean,
    column lyrics.instrumental to boolean,
    column lyrics.created_at to timestamp,
    column lyrics.updated_at to timestamp

BEFORE LOAD DO
    \$\$ DROP TABLE IF EXISTS lrclib_corpus CASCADE; \$\$

AFTER LOAD DO
    \$\$ CREATE INDEX IF NOT EXISTS idx_lrclib_track_name ON lrclib_corpus(track_name_lower); \$\$,
    \$\$ CREATE INDEX IF NOT EXISTS idx_lrclib_artist_name ON lrclib_corpus(artist_name_lower); \$\$,
    \$\$ CREATE INDEX IF NOT EXISTS idx_lrclib_has_synced ON lrclib_corpus(has_synced_lyrics) WHERE has_synced_lyrics = true; \$\$;
EOF

echo "Created pgloader config: /tmp/lrclib_pgloader.load"
echo ""

# Pull Docker image
echo "Pulling pgloader Docker image..."
docker pull dimitri/pgloader:latest

echo ""
echo "Starting pgloader import..."
echo "This will take 1-4 hours for 19M rows"
echo ""

# Run pgloader with Docker
docker run --rm \
  -v /media/t42/me/lrclib:/data \
  -v /tmp/lrclib_pgloader.load:/pgloader.load \
  dimitri/pgloader:latest \
  pgloader --verbose /pgloader.load

echo ""
echo "Import complete!"
echo ""

# Verify count
echo "Verifying import..."
COUNT=$(dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const result = await query('SELECT COUNT(*) as count FROM lrclib_corpus');
  console.log(result[0].count);
")

# Remove ANSI codes
COUNT=$(echo "$COUNT" | sed 's/\x1B\[[0-9;]*[JKmsu]//g' | tail -1)

echo "Total rows imported: $COUNT"
