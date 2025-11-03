#!/bin/bash
set -euo pipefail

# ROBUST CSV Export with all edge cases handled
# - Handles duration = 0 (converts to NULL)
# - Proper NULL handling (actual NULL, not string 'NULL')
# - Proper CSV escaping

SQLITE_DB="/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3"
CSV_OUTPUT="/tmp/lrclib_robust.csv"
TEMP_SQL="/tmp/export_lrclib_robust.sql"

echo "ROBUST LRCLIB CSV Export"
echo "========================="
echo "SQLite: $SQLITE_DB"
echo "Output: $CSV_OUTPUT"
echo ""

# Check disk space
AVAILABLE_GB=$(df -BG /tmp | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE_GB" -lt 60 ]; then
    echo "❌ ERROR: Not enough disk space in /tmp"
    echo "Available: ${AVAILABLE_GB}GB, Need: 60GB"
    exit 1
fi

echo "Disk space OK: ${AVAILABLE_GB}GB available"
echo ""

# Create export SQL with proper NULL handling and duration fix
cat > "$TEMP_SQL" <<'EOSQL'
.mode csv
.headers on
.output /tmp/lrclib_robust.csv

SELECT
  t.id as lrclib_track_id,
  l.id as lrclib_lyrics_id,
  t.name as track_name,
  t.name_lower as track_name_lower,
  t.artist_name,
  t.artist_name_lower,
  t.album_name,
  t.album_name_lower,
  CASE
    WHEN t.duration IS NULL THEN NULL
    WHEN t.duration <= 0 THEN NULL
    ELSE t.duration
  END as duration_seconds,
  l.plain_lyrics,
  l.synced_lyrics,
  CASE WHEN l.has_plain_lyrics = 1 THEN 't' ELSE 'f' END as has_plain_lyrics,
  CASE WHEN l.has_synced_lyrics = 1 THEN 't' ELSE 'f' END as has_synced_lyrics,
  CASE WHEN l.instrumental = 1 THEN 't' ELSE 'f' END as instrumental,
  l.source as lyrics_source,
  l.created_at as lrclib_created_at,
  l.updated_at as lrclib_updated_at
FROM tracks t
JOIN lyrics l ON t.last_lyrics_id = l.id
ORDER BY t.id;

.quit
EOSQL

echo "Starting export..."
echo "This will take 30-50 minutes for 19M rows"
echo "Progress: watch -n 5 'wc -l /tmp/lrclib_robust.csv'"
echo ""

START_TIME=$(date +%s)

sqlite3 "$SQLITE_DB" < "$TEMP_SQL"

EXIT_CODE=$?
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
ELAPSED_MIN=$((ELAPSED / 60))

if [ $EXIT_CODE -eq 0 ] && [ -f "$CSV_OUTPUT" ]; then
    CSV_SIZE=$(du -h "$CSV_OUTPUT" | cut -f1)
    LINE_COUNT=$(wc -l < "$CSV_OUTPUT")

    echo ""
    echo "✅ Export complete!"
    echo "Time: ${ELAPSED_MIN} minutes"
    echo "CSV Size: $CSV_SIZE"
    echo "Lines: $LINE_COUNT"

    # Verify line count
    if [ "$LINE_COUNT" -lt 19000000 ]; then
        echo "⚠️  WARNING: Only $LINE_COUNT lines (expected ~19M)"
    fi

    echo ""
    echo "Next: Run overnight-import-robust.ts"
else
    echo "❌ Export failed (exit code: $EXIT_CODE)"
    exit 1
fi

rm -f "$TEMP_SQL"
