#!/bin/bash
# Start Demucs local service

cd "$(dirname "$0")"

# Activate venv
source .venv/bin/activate

# Configuration - can be overridden via environment variable
PORT=${PORT:-8000}

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port $PORT already in use"
    echo "Run: lsof -i :$PORT to see what's using it"
    echo "Or set a different port: PORT=8001 ./start.sh"
    exit 1
fi

# Check CUDA
if ! uv run python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
    echo "⚠️  CUDA not available! Reinstall PyTorch with CUDA:"
    echo "  uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128"
    exit 1
fi

# Start server
echo "🚀 Starting Demucs local service on port $PORT..."
echo "   GPU: $(uv run python -c 'import torch; print(torch.cuda.get_device_name(0))')"
echo ""
echo "   Health check: curl http://localhost:$PORT/health"
echo "   API docs: http://localhost:$PORT/docs"
echo "   Logs: tail -f demucs.log"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

uv run uvicorn demucs_local:app --host 0.0.0.0 --port $PORT
