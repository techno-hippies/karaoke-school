#!/bin/bash
# Fast CSV export from SQLite (bypasses slow database opening)
# This exports in chunks to avoid memory issues

SQLITE_DB="/media/t42/me/lrclib/lrclib-db-dump-20251022T074101Z.sqlite3"
OUTPUT_DIR="/tmp/lrclib-export"
CHUNK_SIZE=1000000  # 1M rows per file

mkdir -p "$OUTPUT_DIR"

echo "🚀 Fast LRCLIB Export to CSV"
echo "=============================="
echo "SQLite DB: $SQLITE_DB"
echo "Output: $OUTPUT_DIR"
echo "Chunk size: $CHUNK_SIZE rows"
echo ""

# Get total count (this might be slow, but only once)
echo "📊 Counting total rows..."
TOTAL=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM tracks t JOIN lyrics l ON t.last_lyrics_id = l.id;")
echo "✅ Total rows: $TOTAL"
echo ""

# Calculate number of chunks
CHUNKS=$(( ($TOTAL + $CHUNK_SIZE - 1) / $CHUNK_SIZE ))
echo "📦 Will create $CHUNKS chunk files"
echo ""

# Export in chunks
for i in $(seq 0 $(($CHUNKS - 1))); do
  OFFSET=$(($i * $CHUNK_SIZE))
  OUTPUT_FILE="$OUTPUT_DIR/lrclib_chunk_${i}.csv"
  
  echo "📝 Chunk $((i+1))/$CHUNKS (offset: $OFFSET, limit: $CHUNK_SIZE)"
  echo "   Output: $OUTPUT_FILE"
  
  sqlite3 -csv "$SQLITE_DB" <<SQL > "$OUTPUT_FILE"
SELECT
  t.id,
  l.id,
  t.name,
  t.name_lower,
  t.artist_name,
  t.artist_name_lower,
  COALESCE(t.album_name, ''),
  COALESCE(t.album_name_lower, ''),
  COALESCE(t.duration, ''),
  COALESCE(l.plain_lyrics, ''),
  COALESCE(l.synced_lyrics, ''),
  l.has_plain_lyrics,
  l.has_synced_lyrics,
  l.instrumental,
  COALESCE(l.source, ''),
  COALESCE(l.created_at, ''),
  COALESCE(l.updated_at, '')
FROM tracks t
JOIN lyrics l ON t.last_lyrics_id = l.id
ORDER BY t.id
LIMIT $CHUNK_SIZE OFFSET $OFFSET;
SQL
  
  SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  LINES=$(wc -l < "$OUTPUT_FILE")
  echo "   ✅ Done: $LINES rows, $SIZE"
  echo ""
done

echo "✨ Export Complete!"
echo "==================="
echo "Files created: $CHUNKS"
echo "Location: $OUTPUT_DIR"
echo ""
echo "Next step: Run fast-import-csv.ts to import into Neon"
