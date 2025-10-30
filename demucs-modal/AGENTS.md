# Demucs Modal - Agent Guide

## Core Commands

• **Deploy**: `modal deploy demucs_api.py`
• **Local Development**: `modal serve demucs_api.py` (live reload)
• **Test**: `modal run demucs_api.py song.mp3 --two_stems vocals`
• **Logs**: `modal app logs demucs-v4-b200`

## Service Architecture

**Purpose**: Fast serverless vocal/instrumental separation using Demucs v4 htdemucs model on NVIDIA B200 GPUs

**Core Dependencies**:
- **Modal**: Serverless GPU computing platform
- **PyTorch 2.8.0+**: CUDA 12.8 required for B200 GPUs
- **htdemucs**: Pre-cached model for separation
- **FastAPI**: HTTP server for API endpoints

## Key Patterns

**GPU Configuration**:
```python
@app.cls(
    gpu="B200",                    # NVIDIA B200 ($0.001736/sec)
    scaledown_window=60,           # Idle time before scale-down (seconds)
    timeout=600,                   # Max request time (seconds)
    # keep_warm=1,                # Always-warm (adds idle cost)
)
```

**Audio Processing**:
```python
@app.remote_function()
async def separate_stems(audio_file: UploadFile, two_stems: str = "vocals"):
    # 1. Download audio file
    # 2. Run Demucs v4 htdemucs separation
    # 3. Return stems as MP3 @ 192kbps
    return stems_zip
```

**API Endpoint**:
```python
@app.post("/separate")
async def separate_endpoint(
    audio_file: UploadFile = File(...),
    two_stems: str = Form("vocals"),
    shifts: int = Form(1),
    overlap: float = Form(0.25),
    mp3: bool = Form(True),
    mp3_bitrate: int = Form(192)
):
    # Process audio separation
    # Return ZIP file with stems
```

## Performance Metrics

**B200 vs A100 Comparison**:
- **2x faster processing** than A100
- **42% cheaper** ($0.001736/sec vs $0.003/sec)
- **Processing time**: 18.6s for 3:36 song vs 35s on A100

**Cost Efficiency**:
| Song Length | Processing Time | Cost | Output Size |
|-------------|----------------|------|-------------|
| 25 seconds | 4.3s | ~$0.007 | 1.1MB @ 192kbps |
| 3:36 (216s) | 18.6s | ~$0.032 | 9.8MB @ 192kbps |

## Development Patterns

**Setup**:
```bash
# Install Modal CLI
pip install modal
modal token new

# Deploy with live reload
modal serve demucs_api.py

# Test locally
modal run demucs_api.py song.mp3 --two_stems vocals
```

**Testing Flow**:
1. Deploy locally: `modal serve demucs_api.py`
2. Test API: `curl -X POST -F "audio_file=@song.mp3" -F "two_stems=vocals" http://localhost:8000/separate -o stems.zip`
3. Verify output: `unzip -l stems.zip`

## Critical Files

**Main Service**: `demucs_api.py` - Modal deployment with FastAPI
**Dependencies**: Requirements baked into Modal image
**Model Cache**: htdemucs model pre-cached in container

## API Usage

**Two-Stems Separation**:
```bash
curl -X POST \
  -F "audio_file=@song.mp3" \
  -F "two_stems=vocals" \
  https://your-username--demucs-v4-b200-fastapi-app.modal.run/separate \
  -o stems.zip

# Returns: vocals.mp3 + no_vocals.mp3
```

**All-Stems Separation**:
```bash
# Omit two_stems parameter for all stems
curl -X POST \
  -F "audio_file=@song.mp3" \
  https://your-username--demucs-v4-b200-fastapi-app.modal.run/separate \
  -o all_stems.zip

# Returns: vocals.mp3, drums.mp3, bass.mp3, other.mp3
```

**Parameters**:
- `audio_file` (required): MP3, WAV, FLAC, etc.
- `two_stems` (optional): "vocals", "drums", "bass", or "other"
- `shifts` (int, default=1): Quality (1=fast, 5+=slower but better)
- `overlap` (float, default=0.25): Overlap between windows
- `mp3` (bool, default=true): Output MP3 (true) or WAV (false)
- `mp3_bitrate` (int, default=192): MP3 bitrate (128-320 kbps)

## Modal Configuration

**Image Setup**:
```python
from modal import Image

image = Image.debian_slim().pip_install(
    "torch==2.8.0",
    "torchaudio==2.8.0", 
    "transformers==4.30.0",
    "fastapi==0.100.0",
    "uvicorn==0.22.0"
)
```

**Model Caching**:
```python
# htdemucs model downloaded during container build
# No runtime download required
# Cached in Modal's layer system
```

## Deployment

**Production Deployment**:
```bash
# Deploy to Modal cloud
modal deploy demucs_api.py

# Get deployment URL
modal app list
# URL: https://username--demucs-v4-b200.modal.run

# Test deployed version
curl -X POST -F "audio_file=@test.mp3" https://username--demucs-v4-b200.modal.run/separate
```

**Cold Start**:
- **~8 seconds** (model pre-cached in image)
- **No download overhead** (htdemucs pre-loaded)
- **Auto-scale to zero** when idle (no idle costs)

## Integration with Karaoke Pipeline

**Audio Processing Flow**:
```python
# In karaoke-pipeline
async function processTikTokAudio(videoUrl: string) {
  // 1. Download TikTok audio
  const audioBlob = await downloadAudio(videoUrl);
  
  // 2. Separate vocals/instrumental via Demucs
  const formData = new FormData();
  formData.append('audio_file', audioBlob);
  formData.append('two_stems', 'vocals');
  
  const separationResult = await fetch('https://username--demucs-v4-b200.modal.run/separate', {
    method: 'POST',
    body: formData
  });
  
  // 3. Upload instrumental to Grove
  const instrumental = await extractFromZip(separationResult);
  const groveUri = await uploadToGrove(instrumental);
  
  return groveUri;
}
```

## Environment Requirements

**B200 GPU Requirements**:
- **PyTorch 2.8.0+**: Earlier versions lack sm_100 kernels
- **CUDA 12.8**: Required for B200 architecture
- **Container**: Debian Slim + Python 3.10

**Package Management**:
- **uv**: 10-100x faster than pip
- **Pre-compiled wheels**: For CUDA compatibility
- **Minimal base**: Debian Slim for faster cold starts

## Output Format

**File Structure**:
```
stems.zip
├── vocals.mp3           # Vocals track (if two_stems=vocals)
├── no_vocals.mp3        # Instrumental track
└── stems.json           # Metadata (optional)
```

**Audio Quality**:
- **MP3**: 192kbps by default (85% smaller than WAV)
- **WAV**: Available with `mp3=false` parameter
- **Bitrate control**: 128-320 kbps via `mp3_bitrate`

## Cost Optimization

**Auto-Scaling**:
- **Scale to zero**: No idle costs when no requests
- **Warm containers**: Optional (adds idle cost)
- **GPU billing**: Per-second billing, accurate to 0.001s

**Performance Tuning**:
- **shifts=1**: Fast processing, good quality
- **shifts=5+**: Slower but better separation quality
- **overlap=0.25**: Good balance of speed and quality

## Gotchas

**B200 Specific**:
- **PyTorch version critical**: 2.8.0+ required (sm_100 kernels)
- **CUDA compatibility**: 12.8 required, earlier versions fail
- **Model compatibility**: htdemucs must support B200 architecture

**Modal Platform**:
- **Cold starts**: ~8s for first request after inactivity
- **File size limits**: Audio files under 100MB
- **Timeout limits**: 600s max per request

**Output Quality**:
- **MP3 compression**: Lossy but 85% size reduction
- **WAV option**: Uncompressed but much larger files
- **Quality vs Speed**: More shifts = better quality, longer processing

## Troubleshooting

**B200 kernel errors**:
```bash
# Check PyTorch version
python -c "import torch; print(torch.__version__)"

# Verify CUDA availability
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name())"
```

**Modal deployment issues**:
```bash
# Check deployment status
modal app list

# View logs
modal app logs demucs-v4-b200

# Redeploy with verbose output
modal deploy demucs_api.py --verbose
```

**Audio processing errors**:
```python
# Check input format support
# Supported: MP3, WAV, FLAC, M4A
# Unsupported: OGG, WMA

# Debug file processing
@app.post("/debug")
async def debug_endpoint(audio_file: UploadFile):
    return {
        "filename": audio_file.filename,
        "content_type": audio_file.content_type,
        "size": len(await audio_file.read())
    }
```

## Integration Examples

**Karaoke Enhancement**:
```typescript
// Step 1: Download TikTok audio
const audioBuffer = await downloadTikTokAudio(videoUrl);

// Step 2: Separate via Demucs
const formData = new FormData();
formData.append('audio_file', new File([audioBuffer], 'audio.mp3'));
formData.append('two_stems', 'vocals');

const separation = await fetch(DEMUCS_URL, {
  method: 'POST',
  body: formData
});

// Step 3: Upload instrumental to Grove
const instrumental = await extractInstrumental(separation);
const groveUri = await uploadToGrove(instrumental);

// Step 4: Store in database
await storeKaraokeSegment({
  spotifyTrackId,
  instrumentalUri: groveUri,
  // ... other metadata
});
```
