# FFmpeg Service

Simple Hono + Bun + ffmpeg server for audio cropping on Akash (~$2/month).

## Features

- Async audio cropping via `/crop-async` endpoint
- Fast seeking with ffmpeg `-ss` and `-t` flags
- Webhook-based result delivery
- Base64-encoded output for easy transmission
- Health check endpoint

## Deployment

### Build and Push Docker Image

```bash
docker build -t t3333chn0000/ffmpeg-service:v1.0.0 .
docker push t3333chn0000/ffmpeg-service:v1.0.0
```

### Deploy to Akash

```bash
akash tx deployment create deploy-akash.yaml --from mykey
```

## API

### POST /crop-async

Crop audio segment asynchronously.

**Form Data:**
- `job_id` - Unique job identifier
- `audio_url` - Public URL to audio file (Grove, etc.)
- `start_ms` - Start time in milliseconds
- `end_ms` - End time in milliseconds
- `webhook_url` - URL to POST results when complete
- `output_format` - (optional) Output format, default: mp3
- `mp3_bitrate` - (optional) MP3 bitrate, default: 192

**Response:**
```json
{
  "job_id": "...",
  "status": "processing",
  "message": "Crop job submitted"
}
```

**Webhook Payload (on completion):**
```json
{
  "job_id": "...",
  "status": "completed",
  "cropped_base64": "...",
  "cropped_size": 1234567,
  "start_ms": 0,
  "end_ms": 190000,
  "duration_ms": 190000
}
```

### GET /health

Health check endpoint.

## Local Development

```bash
bun install
bun run dev
```

## Cost

~$2-4/month on Akash with 1 vCPU, 2GB RAM, 10GB storage.
