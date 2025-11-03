#!/bin/bash
set -euo pipefail

# COMPLETE OVERNIGHT IMPORT
# Waits for CSV export to finish, then runs import
# Total time: ~2 hours (40min export + 60-90min import)

cd /media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline

echo "========================================="
echo "LRCLIB COMPLETE OVERNIGHT IMPORT"
echo "========================================="
echo "This script will:"
echo "  1. Wait for CSV export to complete (~40 min)"
echo "  2. Import CSV to Neon PostgreSQL (~60-90 min)"
echo ""
echo "Total time: ~2 hours"
echo "========================================="
echo ""

# Check if export is running
EXPORT_PID=$(pgrep -f "export-csv-proper.sh" || echo "")

if [ -n "$EXPORT_PID" ]; then
    echo "✓ CSV export already running (PID: $EXPORT_PID)"
    echo "  Waiting for export to complete..."
    echo ""

    # Wait for export to finish
    while kill -0 "$EXPORT_PID" 2>/dev/null; do
        sleep 30
        echo "  [$(date '+%H:%M:%S')] Still exporting... (PID $EXPORT_PID alive)"
    done

    echo ""
    echo "✓ Export process completed"
else
    # Check if CSV already exists
    if [ -f "/tmp/lrclib_proper.csv" ]; then
        CSV_SIZE=$(du -h /tmp/lrclib_proper.csv | cut -f1)
        echo "✓ CSV already exists: /tmp/lrclib_proper.csv ($CSV_SIZE)"
        echo ""
    else
        echo "Starting CSV export now..."
        bash scripts/lrclib/export-csv-proper.sh
    fi
fi

# Verify CSV exists and is complete
if [ ! -f "/tmp/lrclib_proper.csv" ]; then
    echo "❌ ERROR: CSV file not found after export"
    exit 1
fi

CSV_LINES=$(wc -l < /tmp/lrclib_proper.csv)
CSV_SIZE=$(du -h /tmp/lrclib_proper.csv | cut -f1)

echo "CSV ready:"
echo "  File: /tmp/lrclib_proper.csv"
echo "  Size: $CSV_SIZE"
echo "  Lines: $CSV_LINES"
echo ""

# Sanity check
if [ "$CSV_LINES" -lt 1000000 ]; then
    echo "⚠️  WARNING: CSV has only $CSV_LINES lines (expected ~19M)"
    echo "Export may have failed. Check logs/lrclib/csv_export_proper_*.log"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "========================================="
echo "Starting PostgreSQL Import"
echo "========================================="
echo ""

# Run import
dotenvx run -f .env -- bun scripts/lrclib/overnight-import-final.ts

echo ""
echo "========================================="
echo "✅ OVERNIGHT IMPORT COMPLETE!"
echo "========================================="
