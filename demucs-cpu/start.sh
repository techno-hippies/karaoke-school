#!/bin/bash
# Start Demucs CPU local service

cd "$(dirname "$0")"

# Activate venv
source .venv/bin/activate

# Configuration - can be overridden via environment variable
PORT=${PORT:-8002}

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port $PORT already in use"
    echo "Run: lsof -i :$PORT to see what's using it"
    echo "Or set a different port: PORT=8003 ./start.sh"
    exit 1
fi

# Start server
echo "🚀 Starting Demucs CPU local service on port $PORT..."
echo "   Model: mdx_q (MDX Quantized - CPU Optimized)"
echo "   Hardware: CPU-only (no GPU required)"
echo ""
echo "   Health check: curl http://localhost:$PORT/health"
echo "   API docs: http://localhost:$PORT/docs"
echo "   Logs: tail -f demucs.log"
echo ""
echo "   Note: CPU processing is slower than GPU (2-5 minutes per track)"
echo "   Press Ctrl+C to stop"
echo ""

uv run uvicorn demucs_local:app --host 0.0.0.0 --port $PORT
