# Demucs Setup Guide

Two-mode Demucs separation: use your local RTX 3080 or fall back to Modal cloud GPU.

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Cloudflare Worker (Cron Job)            │
│                                                  │
│  DemucsService checks mode & availability:      │
│    • Mode = 'local' → Try local first           │
│    • Mode = 'modal' → Use Modal directly        │
│    • Local unavailable → Fallback to Modal      │
└──────────────┬──────────────────┬────────────────┘
               │                  │
               ↓                  ↓
    ┌──────────────────┐   ┌─────────────────┐
    │ Local FastAPI    │   │  Modal H200     │
    │ (RTX 3080 16GB)  │   │  (Cloud GPU)    │
    │ Port 8000        │   │  Rate Limited   │
    └──────────────────┘   └─────────────────┘
```

## Mode 1: Local GPU (Recommended)

### Benefits
- ✅ **No rate limits** - Process unlimited tracks
- ✅ **No costs** - Use your RTX 3080
- ✅ **Faster startup** - No cold starts
- ✅ **Privacy** - Audio stays local

### Setup

#### 1. Install local service

```bash
cd demucs-local

# Create virtual environment
uv venv
source .venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt

# Install PyTorch with CUDA
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Download model (~2GB, one-time)
python -c 'from demucs.pretrained import get_model; get_model("mdx_extra")'
```

#### 2. Start local server

```bash
# Foreground (for testing)
uvicorn demucs_local:app --host 0.0.0.0 --port 8001

# Background (production)
nohup uvicorn demucs_local:app --host 0.0.0.0 --port 8001 > demucs.log 2>&1 &
```

#### 3. Configure Cloudflare Worker

Add to `cloudflare-worker-scraper/.dev.vars`:

```bash
DEMUCS_MODE=local
DEMUCS_LOCAL_ENDPOINT=http://localhost:8001
WORKER_URL=https://your-worker.workers.dev
```

#### 4. Test

```bash
# Health check
curl http://localhost:8001/health

# Should return:
# {"status":"healthy","model":"mdx_extra","gpu":"CUDA","cuda_available":true,"device":"NVIDIA GeForce RTX 3080 Laptop GPU"}
```

## Mode 2: Modal GPU (Fallback)

### Benefits
- ✅ **No local setup** - Cloud-based
- ✅ **Powerful GPU** - H200 80GB
- ❌ **Rate limited** - You hit this limit
- ❌ **Costs money** - Modal pricing

### Setup

```bash
cd demucs-modal
modal deploy demucs_api.py
```

Configure:
```bash
DEMUCS_MODE=modal
MODAL_DEMUCS_ENDPOINT=https://your-username--demucs-karaoke-fastapi-app.modal.run
```

## Hybrid Mode (Best of Both)

Use local with automatic Modal fallback:

```bash
# .dev.vars
DEMUCS_MODE=local
DEMUCS_LOCAL_ENDPOINT=http://localhost:8000
MODAL_DEMUCS_ENDPOINT=https://...modal.run  # Fallback

# If local is unavailable, automatically falls back to Modal
```

## Performance Comparison

| Metric | Local (RTX 3080) | Modal (H200) |
|--------|------------------|--------------|
| **Cold Start** | ~2s | ~10s |
| **Separation Time** | ~20-30s | ~15-20s |
| **Cost per Track** | Free | ~$0.05-0.10 |
| **Rate Limit** | Unlimited | ~1000/month |
| **VRAM** | 16GB | 80GB |
| **Best For** | Continuous processing | Bursts/scale |

## Running the Pipeline

### Start local service (if using local mode)

```bash
cd demucs-local
source .venv/bin/activate
uvicorn demucs_local:app --host 0.0.0.0 --port 8000
```

### Deploy worker

```bash
cd cloudflare-worker-scraper
wrangler deploy
```

### Monitor logs

```bash
# Local service logs
tail -f demucs-local/demucs.log

# Worker logs
wrangler tail
```

## Troubleshooting

### Local service won't start

```bash
# Check CUDA
python -c "import torch; print(torch.cuda.is_available())"

# Should be True. If False, reinstall PyTorch with CUDA
```

### Worker can't reach local service

If running worker locally with `wrangler dev`:
- Local service must be at `http://localhost:8000`
- Firewall must allow port 8000

If worker is deployed to Cloudflare:
- Local endpoint must be publicly accessible (use ngrok or expose your server)
- Or use `DEMUCS_MODE=modal` for deployed workers

### Out of memory

```bash
# Check GPU usage
nvidia-smi

# Free up VRAM by closing other applications
# Or switch to Modal: DEMUCS_MODE=modal
```

## Production Recommendations

**Local Development:**
```bash
DEMUCS_MODE=local
DEMUCS_LOCAL_ENDPOINT=http://localhost:8001
```

**Local Production (server always running):**
```bash
DEMUCS_MODE=local
DEMUCS_LOCAL_ENDPOINT=http://your-server-ip:8001
MODAL_DEMUCS_ENDPOINT=...  # Fallback if server goes down
```

**Cloud Production (no local hardware):**
```bash
DEMUCS_MODE=modal
MODAL_DEMUCS_ENDPOINT=https://...modal.run
```

## Next Steps

1. ✅ Start local service: `uvicorn demucs_local:app --port 8001`
2. ✅ Test health: `curl http://localhost:8001/health`
3. ✅ Configure worker: Add env vars to `.dev.vars`
4. ✅ Deploy worker: `wrangler deploy`
5. ✅ Monitor: `wrangler tail` and check logs for "Using local GPU (RTX 3080)"

Your RTX 3080 is now handling Demucs separation! 🎵
