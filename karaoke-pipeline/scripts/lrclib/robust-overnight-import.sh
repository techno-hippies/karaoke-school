#!/bin/bash
set -euo pipefail

# Robust Overnight LRCLIB Import
# Uses PostgreSQL COPY for maximum speed (100x faster than INSERT)
# Handles duplicates, logs progress, runs unattended

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/lrclib"
LOG_FILE="$LOG_DIR/robust_import_$(date +%Y%m%d_%H%M%S).log"

# Configuration
CSV_FILE="${CSV_FILE:-/tmp/lrclib_export.csv}"
BATCH_SIZE=100000  # Progress updates every 100k rows

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

log_warn() {
    log "${YELLOW}[WARN]${NC} $1"
}

# Ensure log directory exists
mkdir -p "$LOG_DIR"

log_info "========================================="
log_info "LRCLIB Overnight Import - ROBUST Mode"
log_info "========================================="
log_info "CSV File: $CSV_FILE"
log_info "Log File: $LOG_FILE"
log_info ""

# Check CSV exists
if [ ! -f "$CSV_FILE" ]; then
    log_error "CSV file not found: $CSV_FILE"
    log_info "Run fast-import-csv.ts step 1 first to export SQLite to CSV"
    exit 1
fi

CSV_SIZE=$(du -h "$CSV_FILE" | cut -f1)
log_info "CSV Size: $CSV_SIZE"

# Load environment
cd "$PROJECT_ROOT"
if [ ! -f ".env" ]; then
    log_error ".env file not found"
    exit 1
fi

log_info "Loading database credentials from .env..."
export $(grep -v '^#' .env | grep DATABASE_URL | xargs)

if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL not found in .env"
    exit 1
fi

# Parse DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\(.*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]\+\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

log_info "Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
log_info ""

# Get current count
log_info "Checking current database state..."
CURRENT_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM lrclib_corpus;" 2>/dev/null | xargs)
log_info "Current records: $CURRENT_COUNT"

# Offer to clear existing data for clean import
if [ "$CURRENT_COUNT" -gt 0 ]; then
    log_warn "Database already contains $CURRENT_COUNT records"
    log_warn "For fastest import, recommend clearing and re-importing fresh"
    log_info ""
    log_info "Options:"
    log_info "  1) Clear existing data and import fresh (RECOMMENDED)"
    log_info "  2) Skip duplicates using ON CONFLICT (slower, but keeps existing)"
    log_info ""

    # Auto-select option 1 for overnight unattended run
    log_info "Auto-selecting Option 1 for unattended overnight import..."

    log_warn "Clearing existing lrclib_corpus data..."
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-EOSQL 2>&1 | tee -a "$LOG_FILE"
		TRUNCATE TABLE lrclib_corpus RESTART IDENTITY CASCADE;
	EOSQL

    log_success "Table cleared. Starting fresh import."
fi

log_info ""
log_info "========================================="
log_info "Starting PostgreSQL COPY Import"
log_info "========================================="
log_info "Expected: 19,111,246 records"
log_info "Estimated time: 30-90 minutes"
log_info ""

START_TIME=$(date +%s)

# Create temporary SQL file for COPY
COPY_SQL="/tmp/lrclib_robust_copy.sql"
cat > "$COPY_SQL" <<'EOSQL'
-- Robust COPY import with progress tracking
\timing on
\pset pager off

-- Import using COPY (handles escaping, quotes, nulls automatically)
\COPY lrclib_corpus (lrclib_track_id, lrclib_lyrics_id, track_name, track_name_lower, artist_name, artist_name_lower, album_name, album_name_lower, duration_seconds, plain_lyrics, synced_lyrics, has_plain_lyrics, has_synced_lyrics, instrumental, lyrics_source, lrclib_created_at, lrclib_updated_at) FROM '/tmp/lrclib_export.csv' WITH (FORMAT CSV, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"', NULL 'NULL');

-- Show final count
SELECT COUNT(*) as total_imported FROM lrclib_corpus;

-- Update statistics
ANALYZE lrclib_corpus;
EOSQL

log_info "Running COPY command..."
log_info "This will take 30-90 minutes. Progress logged to: $LOG_FILE"
log_info ""

# Run COPY with full output logging
export PGPASSWORD="$DB_PASS"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
     -f "$COPY_SQL" 2>&1 | tee -a "$LOG_FILE"

COPY_EXIT_CODE=${PIPESTATUS[0]}

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
ELAPSED_MIN=$((ELAPSED / 60))

log_info ""
log_info "========================================="

if [ $COPY_EXIT_CODE -eq 0 ]; then
    log_success "Import completed successfully!"

    # Get final count
    FINAL_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM lrclib_corpus;" | xargs)

    log_success "Total records imported: $FINAL_COUNT"
    log_info "Time elapsed: ${ELAPSED_MIN} minutes"
    log_info ""

    # Show stats
    log_info "Database statistics:"
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT * FROM lrclib_corpus_stats;" 2>&1 | tee -a "$LOG_FILE"

    log_info ""
    log_success "✅ OVERNIGHT IMPORT COMPLETE!"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Generate embeddings: dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts"
    log_info "  2. Check stats: dotenvx run -f .env -- bun -e \"import {query} from './src/db/neon'; console.table(await query('SELECT * FROM lrclib_corpus_stats'));\""
else
    log_error "Import failed with exit code $COPY_EXIT_CODE"
    log_error "Check log file: $LOG_FILE"
    exit 1
fi

# Cleanup
rm -f "$COPY_SQL"

log_info "Log saved to: $LOG_FILE"
