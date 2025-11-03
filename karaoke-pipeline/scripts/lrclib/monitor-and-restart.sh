#!/bin/bash
# Self-monitoring import script - keeps processes alive
# Run this before bed, it handles everything

cd /media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline

LOG_FILE="logs/lrclib/monitor_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "LRCLIB Overnight Monitor - Starting"
log "========================================="
log ""

# Start import
log "Starting import process..."
bash scripts/lrclib/GO-TO-BED.sh > logs/lrclib/overnight.log 2>&1 &
IMPORT_PID=$!
log "Import PID: $IMPORT_PID"

# Wait 10 seconds for export to start
sleep 10

# Start embeddings (runs in parallel)
log "Starting embeddings process..."
dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts > logs/lrclib/embeddings_overnight.log 2>&1 &
EMBED_PID=$!
log "Embeddings PID: $EMBED_PID"

log ""
log "Both processes started. Monitoring every 5 minutes..."
log "Logs:"
log "  - Import: logs/lrclib/overnight.log"
log "  - Embeddings: logs/lrclib/embeddings_overnight.log"
log "  - Monitor: $LOG_FILE"
log ""

# Monitor loop
while true; do
    # Check import process
    if kill -0 $IMPORT_PID 2>/dev/null; then
        IMPORT_STATUS="✓ Running"
    else
        IMPORT_STATUS="✗ Stopped"

        # Check if completed successfully
        if tail -5 logs/lrclib/overnight.log | grep -q "OVERNIGHT IMPORT COMPLETE"; then
            IMPORT_STATUS="✓ Completed"
        else
            log "⚠️  Import died! Restarting..."
            bash scripts/lrclib/GO-TO-BED.sh > logs/lrclib/overnight_restart.log 2>&1 &
            IMPORT_PID=$!
            log "Restarted import, new PID: $IMPORT_PID"
        fi
    fi

    # Check embeddings process
    if kill -0 $EMBED_PID 2>/dev/null; then
        EMBED_STATUS="✓ Running"
    else
        EMBED_STATUS="✗ Stopped"

        # Check if completed
        if tail -5 logs/lrclib/embeddings_overnight.log | grep -q "No pending embeddings"; then
            EMBED_STATUS="✓ Completed"
        else
            log "⚠️  Embeddings died! Restarting..."
            dotenvx run -f .env -- bun scripts/lrclib/generate-embeddings.ts > logs/lrclib/embeddings_restart.log 2>&1 &
            EMBED_PID=$!
            log "Restarted embeddings, new PID: $EMBED_PID"
        fi
    fi

    log "Status: Import=$IMPORT_STATUS | Embeddings=$EMBED_STATUS"

    # If both completed, exit
    if [[ "$IMPORT_STATUS" == "✓ Completed" && "$EMBED_STATUS" == "✓ Completed" ]]; then
        log ""
        log "========================================="
        log "✅ ALL PROCESSES COMPLETED!"
        log "========================================="
        exit 0
    fi

    # Wait 5 minutes
    sleep 300
done
