#!/bin/bash
set -euo pipefail

# ========================================
# ROBUST OVERNIGHT IMPORT
# Run this and go to bed!
# ========================================

cd /media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline

echo "========================================="
echo "🌙 LRCLIB OVERNIGHT IMPORT - GO TO BED!"
echo "========================================="
echo ""
echo "This will:"
echo "  1. Export SQLite to CSV (~40 min)"
echo "  2. Import CSV to PostgreSQL (~60-90 min)"
echo ""
echo "Total time: ~2 hours"
echo "========================================="
echo ""

# Step 1: Export
echo "Step 1/2: Exporting CSV..."
bash scripts/lrclib/export-csv-robust.sh

if [ $? -ne 0 ]; then
    echo "❌ Export failed! Check logs."
    exit 1
fi

# Step 2: Import
echo ""
echo "Step 2/2: Importing to PostgreSQL..."
dotenvx run -f .env -- bun scripts/lrclib/overnight-import-robust.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ OVERNIGHT IMPORT COMPLETE!"
    echo "========================================="
    echo ""
    echo "Morning check:"
    echo "  dotenvx run -f .env -- bun -e \"import {query} from './src/db/neon'; console.table(await query('SELECT * FROM lrclib_corpus_stats'));\""
else
    echo ""
    echo "❌ Import failed! Check logs/lrclib/*.log"
    exit 1
fi
