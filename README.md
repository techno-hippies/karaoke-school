# Freyr Download Service

HTTP API for downloading Spotify tracks and extracting segments for karaoke production.

## Features

- ✅ Download Spotify tracks with freyr (320kbps m4a)
- ✅ Extract segments with ffmpeg (fast stream copy)
- ✅ File caching (avoids re-downloading)
- ✅ Base64 encoding for easy API integration

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "service": "freyr-download-service",
  "version": "1.0.0"
}
```

### `POST /download`
Download a Spotify track.

**Request:**
```json
{
  "spotify_track_id": "0EP3cDf6c0Q66bkt9lMy0Y"
}
```

**Response:**
```json
{
  "success": true,
  "cached": false,
  "spotify_track_id": "0EP3cDf6c0Q66bkt9lMy0Y",
  "audio_base64": "AAAAIGZ0eXBNNEEg...",
  "file_size": 5242880,
  "format": "m4a",
  "download_time_seconds": 12.5
}
```

### `POST /segment`
Extract a segment from downloaded track.

**Request:**
```json
{
  "spotify_track_id": "0EP3cDf6c0Q66bkt9lMy0Y",
  "start_ms": 45000,
  "end_ms": 235000
}
```

**Response:**
```json
{
  "success": true,
  "spotify_track_id": "0EP3cDf6c0Q66bkt9lMy0Y",
  "segment_base64": "AAAAIGZ0eXBNNEEg...",
  "segment_size": 3145728,
  "start_ms": 45000,
  "end_ms": 235000,
  "duration_ms": 190000
}
```

### `GET /cache-stats`
View cache statistics.

**Response:**
```json
{
  "cache_size": "125M",
  "cached_files": 25,
  "downloads_dir": "/tmp/freyr-downloads"
}
```

## Deployment

### Render
```bash
# Service auto-deployed via Dockerfile
```

### Local Development
```bash
bun install
bun run dev
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DOWNLOADS_DIR` - Download cache directory (default: /tmp/freyr-downloads)
- `SEGMENTS_DIR` - Segment output directory (default: /tmp/freyr-segments)

## Tech Stack

- **Runtime:** Bun
- **Audio Download:** freyr + yt-dlp
- **Segmentation:** ffmpeg
- **Format:** m4a (320kbps AAC)
