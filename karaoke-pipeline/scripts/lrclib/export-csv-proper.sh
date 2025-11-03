#!/bin/bash
set -euo pipefail

# Export SQLite to CSV with PROPER escaping
# Uses SQLite's native .mode csv which handles all edge cases

SQLITE_DB="/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3"
CSV_OUTPUT="/tmp/lrclib_proper.csv"
TEMP_SQL="/tmp/export_lrclib.sql"

echo "Exporting LRCLIB SQLite to CSV (PROPER escaping)"
echo "================================================"
echo "SQLite: $SQLITE_DB"
echo "Output: $CSV_OUTPUT"
echo ""

# Create SQL export script
cat > "$TEMP_SQL" <<'EOSQL'
.mode csv
.headers on
.output /tmp/lrclib_proper.csv

SELECT
  t.id as lrclib_track_id,
  l.id as lrclib_lyrics_id,
  t.name as track_name,
  t.name_lower as track_name_lower,
  t.artist_name,
  t.artist_name_lower,
  COALESCE(t.album_name, 'NULL') as album_name,
  COALESCE(t.album_name_lower, 'NULL') as album_name_lower,
  COALESCE(t.duration, 'NULL') as duration_seconds,
  COALESCE(l.plain_lyrics, 'NULL') as plain_lyrics,
  COALESCE(l.synced_lyrics, 'NULL') as synced_lyrics,
  CASE WHEN l.has_plain_lyrics THEN 'TRUE' ELSE 'FALSE' END as has_plain_lyrics,
  CASE WHEN l.has_synced_lyrics THEN 'TRUE' ELSE 'FALSE' END as has_synced_lyrics,
  CASE WHEN l.instrumental THEN 'TRUE' ELSE 'FALSE' END as instrumental,
  COALESCE(l.source, 'NULL') as lyrics_source,
  COALESCE(l.created_at, 'NULL') as lrclib_created_at,
  COALESCE(l.updated_at, 'NULL') as lrclib_updated_at
FROM tracks t
JOIN lyrics l ON t.last_lyrics_id = l.id
ORDER BY t.id;

.quit
EOSQL

echo "Running SQLite export..."
echo "This will take 20-40 minutes for 19M rows"
echo ""

time sqlite3 "$SQLITE_DB" < "$TEMP_SQL"

if [ -f "$CSV_OUTPUT" ]; then
    CSV_SIZE=$(du -h "$CSV_OUTPUT" | cut -f1)
    LINE_COUNT=$(wc -l < "$CSV_OUTPUT")
    echo ""
    echo "✅ Export complete!"
    echo "CSV Size: $CSV_SIZE"
    echo "Lines: $LINE_COUNT"
    echo ""
    echo "Next: Run robust-overnight-import-v2.sh to import"
else
    echo "❌ Export failed - CSV not created"
    exit 1
fi

rm -f "$TEMP_SQL"
