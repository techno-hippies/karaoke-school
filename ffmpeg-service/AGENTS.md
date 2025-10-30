# FFmpeg Service - Agent Guide

## Core Commands

• **Development**: `bun run dev` (starts server on port 3000)
• **Build**: `docker build -t ffmpeg-service:v1.0 .`
• **Deploy**: `akash provider send-manifest deploy-akash.yaml`
• **Test**: `curl -X POST http://localhost:3000/crop-async -F "job_id=test123" -F "audio_url=https://example.com/audio.mp3" -F "start_ms=45000" -F "end_ms=235000" -F "webhook_url=https://example.com/webhook"`

## Service Architecture

**Purpose**: Simple audio cropping service using ffmpeg, designed for Akash deployment at ~$2/month

**Core Dependencies**:
- **Hono**: Lightweight web framework for Bun runtime
- **Bun**: Fast JavaScript runtime (replaces Node.js)
- **FFmpeg**: Audio processing and transcoding
- **Bun.$**: Process execution for shell commands

## Key Patterns

**Async Processing**:
```typescript
// Endpoint accepts job and returns immediately
app.post('/crop-async', async (c) => {
  const req = await parseFormData(c);
  // Start processing without waiting
  processCropJob(req).catch(console.error);
  return c.json({ status: 'processing' });
});

// Background processing with webhook callback
async function processCropJob(req: CropRequest) {
  // 1. Download audio from URL
  const audioBuffer = await fetch(req.audio_url);
  
  // 2. Crop with ffmpeg
  const cropped = await $`ffmpeg -y -ss ${startSec} -t ${durationSec} -i input.mp3 -c:a libmp3lame -b:a 192k output.mp3`;
  
  // 3. Send result to webhook
  await fetch(req.webhook_url, { 
    method: 'POST', 
    body: JSON.stringify({ status: 'completed', cropped_base64: ... }) 
  });
}
```

**URL Handling**:
```typescript
// Convert lens:// URIs to HTTP gateway URLs
let downloadUrl = req.audio_url;
if (req.audio_url.startsWith('lens://')) {
  const cid = req.audio_url.replace('lens://', '');
  downloadUrl = `https://api.grove.storage/${cid}`;
}
```

## Development Patterns

**Environment Setup**:
```bash
# Local development
bun run dev
# Server starts on http://localhost:3000

# Test with sample audio
curl -X POST http://localhost:3000/crop-async \
  -F "job_id=test123" \
  -F "audio_url=@test.mp3" \
  -F "start_ms=30000" \
  -F "end_ms=60000" \
  -F "webhook_url=http://localhost:3001/webhook"
```

**Testing Flow**:
1. Start service: `bun run dev`
2. Submit crop job: `POST /crop-async`
3. Check logs: Monitor console output
4. Verify webhook: Check receiving server

## Critical Files

**Main Service**: `src/index.ts` - Hono server with FFmpeg integration
**Dockerfile**: Container with FFmpeg pre-installed
**Akash Config**: `deploy-akash.yaml` - Deployment configuration

## API Endpoints

**POST /crop-async**:
```typescript
// Request (multipart/form-data)
{
  job_id: string;           // Unique job identifier
  audio_url: string;        // URL to audio file (supports lens:// URIs)
  start_ms: string;         // Start time in milliseconds
  end_ms: string;           // End time in milliseconds
  webhook_url: string;      // URL to receive result
  output_format?: string;   // mp3 (default) or wav
  mp3_bitrate?: string;     // 192 (default), 128, 256, 320
}

// Response
{
  job_id: "test123",
  status: "processing",
  message: "Crop job submitted"
}
```

**GET /health**:
```typescript
// Response
{
  status: "ok",
  service: "ffmpeg-service"
}
```

## FFmpeg Processing

**Parameters**:
- `-ss`: Start time (seconds)
- `-t`: Duration (seconds)
- `-c:a libmp3lame`: Audio codec (MP3)
- `-b:a`: Bitrate (192k default)

**Command Generation**:
```typescript
const startSec = (startMs / 1000).toFixed(3);  // 45.000
const durationSec = (durationMs / 1000).toFixed(3);  // 190.000

await $`ffmpeg -y -ss ${startSec} -t ${durationSec} -i input.mp3 -c:a libmp3lame -b:a 192k output.mp3`;
```

## Akash Deployment

**SDL Configuration**:
```yaml
version: "2.2"

services:
  ffmpeg:
    image: t3333chn0000/ffmpeg-service:v1.0
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
    env:
      - PORT=3000

profiles:
  compute:
    ffmpeg:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          - size: 5Gi

  placement:
    akash:
      pricing:
        ffmpeg:
          denom: uakt
          amount: 5000  # ~$0.01-0.02/hour
```

**Deployment Flow**:
```bash
# 1. Build and push
docker build -t t3333chn0000/ffmpeg-service:v1.0 .
docker push t3333chn0000/ffmpeg-service:v1.0

# 2. Deploy to Akash
akash tx deployment create deploy-akash.yaml --from YOUR_WALLET
akash provider send-manifest deploy-akash.yaml --dseq DEPLOYMENT_SEQ --provider PROVIDER --from YOUR_WALLET

# 3. Get service URL
akash provider lease-status --dseq DEPLOYMENT_SEQ --provider PROVIDER --from YOUR_WALLET
```

## Cost Optimization

**Low-Cost Design**:
- **1 CPU, 1GB RAM**: Sufficient for audio processing
- **5GB storage**: Temporary files only
- **~5uakt/second**: ~$0.01-0.02/hour
- **Async processing**: No resource blocking

**Performance**:
- **Cold start**: <2s (Bun runtime)
- **Processing speed**: ~1-2x real-time for MP3
- **Memory usage**: ~50-100MB per job

## Integration Patterns

**Webhook Callback**:
```typescript
// Success response
{
  job_id: "test123",
  status: "completed",
  cropped_base64: "base64-encoded-mp3",
  cropped_size: 2048576,
  start_ms: 45000,
  end_ms: 235000,
  duration_ms: 190000
}

// Error response
{
  job_id: "test123",
  status: "failed",
  error: "Download failed: 404"
}
```

**URL Support**:
- **HTTP/HTTPS**: Direct file URLs
- **lens://**: IPFS URIs (auto-converted to gateway)
- **Upload**: multipart/form-data file uploads

## Security Considerations

**Input Validation**:
```typescript
const startMs = parseInt(req.start_ms);
const endMs = parseInt(req.end_ms);
if (startMs >= endMs) throw new Error('Invalid time range');
if (endMs - startMs > 300000) throw new Error('Duration too long'); // 5min max
```

**Resource Limits**:
- **Duration limit**: 5 minutes maximum
- **File size**: Limited by memory (1GB RAM)
- **Concurrent jobs**: Limited by CPU (1 core)

**Temporary Files**:
- **Cleanup**: Automatic cleanup in finally block
- **Isolation**: Job-specific subdirectories
- **Security**: No persistent storage

## Troubleshooting

**FFmpeg errors**:
```bash
# Check ffmpeg version
ffmpeg -version

# Test audio format support
ffmpeg -i input.mp3 -f null -

# Debug command execution
console.log(`Running: ffmpeg -y -ss ${startSec} -t ${durationSec} -i input.mp3`);
```

**Download issues**:
```typescript
// Debug URL conversion
console.log(`Original URL: ${req.audio_url}`);
console.log(`Download URL: ${downloadUrl}`);

// Check HTTP response
const response = await fetch(downloadUrl);
console.log(`Download status: ${response.status}`);
```

**Webhook failures**:
```typescript
try {
  await fetch(req.webhook_url, {...});
} catch (webhookError) {
  console.error(`Webhook failed:`, webhookError);
  // Error logged but job continues
}
```

## Use Cases

**Audio Cropping for Karaoke**:
```typescript
// Extract instrumental segment
const job = {
  job_id: "karaoke-45s-235s",
  audio_url: "https://spotify.com/track.mp3",
  start_ms: "45000",  // 45 seconds
  end_ms: "235000",   // 3:55
  webhook_url: "https://grove.storage/webhook"
};
```

**TikTok Clip Processing**:
```typescript
// Crop 50-second segment
const job = {
  job_id: "tiktok-60s-110s",
  audio_url: "lens://abc123...",  // IPFS URI
  start_ms: "60000",   // 1:00
  end_ms: "110000",    // 1:50
  webhook_url: "https://pipeline-service.com/ffmpeg-callback"
};
```

## Gotchas

**Bun Runtime**:
- **Process execution**: Use `Bun.$` instead of Node.js `child_process`
- **File I/O**: Use `Bun.file()` for async file operations
- **Base64 encoding**: `Buffer.from(data).toString('base64')`

**FFmpeg Requirements**:
- **Input formats**: Must be ffmpeg-compatible (MP3, WAV, AAC)
- **Memory usage**: Large files may exceed 1GB limit
- **Duration limits**: Very long files may timeout

**Akash Deployment**:
- **Ephemeral storage**: Files not persisted between restarts
- **Network access**: Must allow outbound HTTP/HTTPS
- **Cold starts**: Container startup adds ~2s latency

**Webhook Patterns**:
- **Async by design**: Job completes in background
- **Idempotent**: Same job_id won't cause conflicts
- **Error handling**: Failed webhooks don't cancel processing
