#!/bin/bash
# Quick start script for overnight LRCLIB import

echo "< LRCLIB Overnight Import Setup"
echo "=================================="
echo ""
echo "This will import 19M+ tracks from LRCLIB into Neon."
echo "Estimated time: 8-12 hours"
echo ""

# Create log directory
mkdir -p logs/lrclib

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/lrclib/import_${TIMESTAMP}.log"

echo "=Ý Log file: $LOG_FILE"
echo ""

# Ask for confirmation
read -p "Start import now? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "L Import cancelled"
    exit 1
fi

echo ""
echo "=€ Starting import in background..."
echo "   Monitor with: tail -f $LOG_FILE"
echo ""

# Run import in background with nohup
nohup dotenvx run -f .env -- bun scripts/lrclib/fast-import-csv.ts > "$LOG_FILE" 2>&1 &

PID=$!
echo " Import started!"
echo "   Process ID: $PID"
echo "   Log file: $LOG_FILE"
echo ""
echo "=Ê Monitor progress:"
echo "   tail -f $LOG_FILE"
echo ""
echo "=Ñ Stop import:"
echo "   kill $PID"
echo ""
echo "=¤ Sleep well! Check progress in the morning."
