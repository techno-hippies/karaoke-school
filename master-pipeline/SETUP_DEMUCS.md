# Demucs Setup Guide

This guide shows how to install Demucs v4 for vocal/instrumental separation using uv in the same virtual environment as the TikTok scraper.

## Installation

Install Demucs and its dependencies using uv:

```bash
cd master-pipeline

# Install Demucs with PyTorch (CPU version - ~3GB download)
uv pip install "numpy<2" "demucs==4.0.1" soundfile

# This will install:
# - demucs (4.0.1)
# - torch (~800MB)
# - torchaudio
# - All CUDA libraries (even for CPU, they're dependencies)
# - soundfile (for audio I/O)
```

**Note**: The installation is large (~3GB) because it includes CUDA libraries even when using CPU. This is normal.

## Installation Time

- **First install**: 5-10 minutes (large PyTorch download)
- **Subsequent runs**: Instant (cached in `.venv`)

## Verify Installation

```bash
.venv/bin/python3 -m demucs --help
```

You should see Demucs help output.

## Download Models

Models are downloaded automatically on first use, but you can pre-download:

```bash
# Download mdx_extra model (recommended, best quality)
.venv/bin/python3 -c "from demucs.pretrained import get_model; get_model('mdx_extra')"

# Or use the service:
bun run -e 'import {DemucsService} from "./services/index.js"; const d = new DemucsService({model: "mdx_extra"}); await d.downloadModel()'
```

## GPU Acceleration (Optional)

If you have an NVIDIA GPU with CUDA:

```bash
# Check if CUDA is available
.venv/bin/python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"

# If True, update DemucsService config to use GPU:
const demucs = new DemucsService({
  model: 'mdx_extra',
  device: 'cuda',  // Use GPU instead of CPU
});
```

GPU acceleration makes separation ~10x faster.

## Test Demucs

Run the audio processing test:

```bash
cd master-pipeline

# Full test (with Demucs)
bun test-audio-processing.ts \
  --song "/path/to/song.flac" \
  --start 0 \
  --end 60.56 \
  --output-dir /tmp/karaoke-test

# Skip Demucs (just test cropping)
bun test-audio-processing.ts \
  --song "/path/to/song.flac" \
  --start 0 \
  --end 60.56 \
  --output-dir /tmp/karaoke-test \
  --skip-demucs
```

## Models

Available models (quality vs speed):

| Model | Quality | Speed | Size |
|-------|---------|-------|------|
| `mdx_extra` | ⭐⭐⭐⭐⭐ (best) | 🐌 slow | 800MB |
| `htdemucs` | ⭐⭐⭐⭐ | 🏃 fast | 500MB |
| `htdemucs_ft` | ⭐⭐⭐⭐ | 🏃 fast | 500MB |

**Recommendation**: Use `mdx_extra` for best quality (default in our service).

## Troubleshooting

### "No module named demucs"

Make sure you're using the venv python:

```bash
.venv/bin/python3 -m demucs --help  # ✓ Correct
python3 -m demucs --help            # ✗ Wrong (system python)
```

The DemucsService automatically uses `.venv/bin/python3` if it exists.

### "CUDA out of memory"

If using GPU and running out of memory, switch to CPU:

```typescript
const demucs = new DemucsService({ device: 'cpu' });
```

### Large download size

PyTorch + CUDA libraries are ~3GB. This is normal. The download happens once and is cached.
