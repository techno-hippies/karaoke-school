#!/bin/bash
# Direct Karafun CSV Import via psql COPY
# This is the RIGHT way to bulk import CSV data

set -e

CONNECTION_STRING="postgresql://neondb_owner:npg_zSPoW2j6RZIb@ep-withered-bush-a1lyp178-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
CSV_PATH="/media/t42/th42/Code/karaoke-school-v1/karafuncatalog.csv"

echo "🎤 Karafun Direct CSV Import"
echo ""

# Create table
echo "1. Creating karafun_songs table..."
psql "$CONNECTION_STRING" -f sql/003-simple-karafun-table.sql

# Import CSV directly using COPY
echo ""
echo "2. Importing CSV via COPY command..."
echo "   CSV: $CSV_PATH"

# Create temp SQL for COPY command
cat > /tmp/karafun-copy.sql <<EOF
\COPY karafun_songs (karafun_id, title, artist, year, is_duo, is_explicit, date_added, styles, languages) FROM '$CSV_PATH' WITH (FORMAT csv, DELIMITER ';', HEADER true);
EOF

psql "$CONNECTION_STRING" -f /tmp/karafun-copy.sql

# Verify
echo ""
echo "3. Verifying import..."
psql "$CONNECTION_STRING" -c "
SELECT COUNT(*) as total_songs,
       COUNT(*) FILTER (WHERE 'English' = ANY(languages)) as english_songs
FROM karafun_songs;
"

echo ""
echo "✅ Import complete!"
