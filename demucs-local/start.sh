#!/bin/bash
# Start Demucs local service

cd "$(dirname "$0")"

# Activate venv
source .venv/bin/activate

# Check if port 8001 is in use
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8001 already in use"
    echo "Run: lsof -i :8001 to see what's using it"
    exit 1
fi

# Check CUDA
if ! python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
    echo "⚠️  CUDA not available! Install PyTorch with CUDA:"
    echo "  uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118"
    exit 1
fi

# Start server
echo "🚀 Starting Demucs local service on port 8001..."
echo "   GPU: $(python -c 'import torch; print(torch.cuda.get_device_name(0))')"
echo ""
echo "   Health check: curl http://localhost:8001/health"
echo "   Logs: tail -f demucs.log"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

uvicorn demucs_local:app --host 0.0.0.0 --port 8001
