# Demucs Local Service

GPU-accelerated vocal/instrumental separation running on your local RTX 3080.

This is a local alternative to the Modal deployment, providing the same API endpoints without cloud costs or rate limits.

## Setup

### 1. Create virtual environment with uv

```bash
cd demucs-local
uv venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows
```

### 2. Install dependencies

```bash
# Install all dependencies
uv pip install -r requirements.txt

# Install PyTorch with CUDA support (RTX 3080)
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 3. Pre-download Demucs model (one-time, ~2GB)

```bash
python -c 'from demucs.pretrained import get_model; get_model("mdx_extra")'
```

This downloads the MDX Extra model (best quality) to `~/.cache/torch/hub/checkpoints/`

## Running

### Start the local server

```bash
uvicorn demucs_local:app --host 0.0.0.0 --port 8001
```

Server will be available at `http://localhost:8001`

### Run in background (daemon mode)

```bash
nohup uvicorn demucs_local:app --host 0.0.0.0 --port 8001 > demucs.log 2>&1 &
```

### Check logs

```bash
tail -f demucs.log
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8001/health
```

### Synchronous Separation (base64 input)
```bash
curl -X POST http://localhost:8001/separate-sync \
  -H "Content-Type: application/json" \
  -d '{"audio_base64": "data:audio/mpeg;base64,...", "model": "mdx_extra"}'
```

### Asynchronous Separation (URL input with webhook)
```bash
curl -X POST http://localhost:8001/separate-async \
  -F "job_id=test-123" \
  -F "audio_url=https://grove.url/audio.mp3" \
  -F "webhook_url=https://yourworker.dev/webhooks/demucs-complete"
```

## Configuration

Add to your `.env`:

```bash
DEMUCS_MODE=local
DEMUCS_LOCAL_ENDPOINT=http://localhost:8001
```

## Performance

**RTX 3080 (16GB VRAM)**
- Model load: ~2-3s (first run)
- Separation: ~20-30s per 3-4 min song
- Memory usage: ~8-10GB VRAM

**vs Modal H200**
- Model load: ~5-10s (cold start)
- Separation: ~15-20s per song
- Cost: Rate limited / $$$$

## Troubleshooting

### CUDA not found
```bash
python -c "import torch; print(torch.cuda.is_available())"
```

Should return `True`. If not, reinstall PyTorch with CUDA:
```bash
uv pip uninstall torch torchaudio
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Out of memory
If you get CUDA OOM errors, try:
- Close other GPU applications
- Use a smaller model: `htdemucs` instead of `mdx_extra`
- Process one file at a time

### Model not found
Re-download the model:
```bash
python -c 'from demucs.pretrained import get_model; get_model("mdx_extra")'
```
