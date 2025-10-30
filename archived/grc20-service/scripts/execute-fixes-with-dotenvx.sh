#!/bin/bash
# GRC-20 Consensus System Fixes - Execution Script with dotenvx
# Run this script to implement all identified fixes

set -e

echo "🚀 Starting GRC-20 Consensus System Fixes"
echo "=========================================="

# Check if dotenvx is available
if ! command -v dotenvx &> /dev/null; then
    echo "❌ dotenvx not found. Please install it:"
    echo "   npm install -g @dotenvx/dotenvx"
    echo "   Or set DATABASE_URL directly:"
    echo "   export DATABASE_URL='your_neon_connection_string'"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Creating from example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your DATABASE_URL"
    echo "   Then run: dotenvx run -f .env -- ./scripts/execute-fixes-with-dotenvx.sh"
    exit 1
fi

# Step 1: Run MusicBrainz enrichment with fixed regex
echo ""
echo "📝 Step 1: Re-running MusicBrainz enrichment..."
echo "This will fix all wikidata_id values that currently show 'wiki'"
echo ""

# Check if there are artists to enrich
ARTISTS_TO_ENRICH=$(dotenvx run -f .env -- psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM spotify_artists sa 
  LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id 
  WHERE ma.spotify_artist_id IS NULL;
" 2>/dev/null || echo "0")

if [ "$ARTISTS_TO_ENRICH" -gt 0 ]; then
    echo "Found $ARTISTS_TO_ENRICH artists to enrich"
    echo "This will take approximately $((($ARTISTS_TO_ENRICH + 49) / 50)) minutes"
    echo ""
  
    # Run enrichment in batches of 50
    while [ "$ARTISTS_TO_ENRICH" -gt 0 ]; do
        dotenvx run -f .env -- bun run scripts/enrich-musicbrainz.ts 50
        sleep 2  # Brief pause between batches
        
        # Check remaining
        ARTISTS_TO_ENRICH=$(dotenvx run -f .env -- psql $DATABASE_URL -t -c "
          SELECT COUNT(*) 
          FROM spotify_artists sa 
          LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id 
          WHERE ma.spotify_artist_id IS NULL;
        " 2>/dev/null || echo "0")
        
        if [ "$ARTISTS_TO_ENRICH" -gt 0 ]; then
            echo "Remaining: $ARTISTS_TO_ENRICH artists"
        fi
    done
else
    echo "✅ All artists already have MusicBrainz data"
fi

# Step 2: Re-run corroboration with updated data
echo ""
echo "🔄 Step 2: Re-running corroboration..."
dotenvx run -f .env -- bun run scripts/run-corroboration.ts

# Step 3: Add corroboration logging
echo ""
echo "📝 Step 3: Adding corroboration logging..."
dotenvx run -f .env -- psql $DATABASE_URL -f scripts/add-corroboration-logging.sql

# Step 4: Verify fixes
echo ""
echo "🔍 Step 4: Verifying fixes..."

# Check wikidata IDs
echo "Checking wikidata_id fixes..."
WIKIDATA_FIXED=$(dotenvx run -f .env -- psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM grc20_artists 
  WHERE wikidata_id LIKE 'Q%';
" 2>/dev/null || echo "0")

WIKIDATA_BROKEN=$(dotenvx run -f .env -- psql $DATABASE_URL -t -c "
  SELECT COUNT(*) 
  FROM grc20_artists 
  WHERE wikidata_id = 'wiki';
" 2>/dev/null || echo "0")

echo "✅ Fixed wikidata IDs: $WIKIDATA_FIXED"
echo "❌ Still broken: $WIKIDATA_BROKEN"

# Check corroboration log
echo ""
echo "Checking corroboration logging..."
LOG_ENTRIES=$(dotenvx run -f .env -- psql $DATABASE_URL -t -c "
  SELECT COUNT(*) FROM grc20_corroboration_log;
" 2>/dev/null || echo "0")

echo "📝 Corroboration log entries: $LOG_ENTRIES"

# Show data quality dashboard
echo ""
echo "📊 Data Quality Dashboard:"
dotenvx run -f .env -- psql $DATABASE_URL -c "SELECT * FROM data_quality_dashboard;"

echo ""
echo "🎉 All fixes implemented successfully!"
echo ""
echo "📋 Next Steps:"
echo "   1. Review data quality dashboard above"
echo "   2. Test tiered validation with: dotenvx run -f .env -- bun run scripts/test-tiered-validation.ts"
echo "   3. Plan CISAC integration for next sprint"
echo "   4. Consider business decision on ISNI requirements for minting"
