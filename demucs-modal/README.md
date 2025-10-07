# Demucs v4 API on Modal.com

Fast serverless vocal/instrumental separation using Demucs v4 htdemucs model on NVIDIA B200 GPUs.

## Quick Start

```bash
# Install Modal CLI
pip install modal
modal token new

# Deploy
modal deploy demucs_api.py

# Test
curl -X POST \
  -F "audio_file=@song.mp3" \
  -F "two_stems=vocals" \
  https://your-username--demucs-v4-b200-fastapi-app.modal.run/separate \
  -o stems.zip
```

## Performance (B200 GPU)

| Song Length | Processing Time | Cost | Output Size |
|-------------|----------------|------|-------------|
| 25 seconds | 4.3s | ~$0.007 | 1.1MB @ 192kbps |
| 3:36 (216s) | 18.6s | ~$0.032 | 9.8MB @ 192kbps |

**B200 vs A100:**
- 2x faster processing
- 42% cheaper ($0.001736/sec vs $0.003/sec)
- Requires PyTorch 2.8.0+ with CUDA 12.8

## API

### POST /separate

**Parameters:**
- `audio_file` (file, required): Audio file (MP3, WAV, FLAC, etc.)
- `two_stems` (string, optional): "vocals", "drums", "bass", or "other"
- `shifts` (int, default=1): Quality (1=fast, 5+=slower but better)
- `overlap` (float, default=0.25): Overlap between windows
- `mp3` (bool, default=true): Output MP3 (true) or WAV (false)
- `mp3_bitrate` (int, default=192): MP3 bitrate (128-320 kbps)

**Response:** ZIP file containing separated stems
- Two-stems mode: `vocals.mp3` + `no_vocals.mp3`
- All-stems mode: `vocals.mp3`, `drums.mp3`, `bass.mp3`, `other.mp3`

### GET /

Health check endpoint.

## Configuration

Edit `demucs_api.py`:

```python
@app.cls(
    gpu="B200",              # GPU type
    scaledown_window=60,     # Idle time before scale-down (seconds)
    timeout=600,             # Max request time (seconds)
    # keep_warm=1,           # Always-warm (adds idle cost)
)
```

## Development

```bash
# Deploy with live reload
modal serve demucs_api.py

# View logs
modal app logs demucs-v4-b200

# Test locally
modal run demucs_api.py song.mp3 --two-stems vocals
```

## Architecture

- **Image**: Debian Slim + Python 3.10
- **GPU**: NVIDIA B200 ($0.001736/sec)
- **PyTorch**: 2.8.0 with CUDA 12.8 (required for B200)
- **Model**: htdemucs (pre-cached in container)
- **Package Manager**: uv (10-100x faster than pip)
- **Output**: MP3 @ 192kbps (85% smaller than WAV)

## Notes

- B200 requires PyTorch 2.8.0+ (earlier versions lack sm_100 kernels)
- Auto-scales to zero when idle (no idle costs by default)
- Cold start: ~8s (model pre-cached in image)
- Processing scales well: longer audio = more efficient GPU utilization
