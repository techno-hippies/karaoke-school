# audio-download-service - AI Agent Context

## Purpose
Fire-and-forget audio download service for the karaoke pipeline with two-stage fallback strategy: yt-dlp (fast, ~50% success) → Soulseek P2P (slower, ~90% success).

**Formerly:** `slsk-service` (renamed to reflect multi-strategy approach)

## Architecture

### Core Functionality
- **Two-Stage Downloads**:
  1. **yt-dlp** (primary): Fast YouTube search and download (~50% success, 30-60s)
  2. **Soulseek P2P** (fallback): Decentralized network (~90% success, 60-120s)
- **Smart Search**: Multi-strategy query fallback (artist+title, title+artist, title-only)
- **Peer Scoring**: Ranks by free slots, speed, file size (Soulseek only)
- **Verification**: Optional AcoustID fingerprinting
- **Storage**: Uploads to Grove IPFS with metadata
- **Database**: Updates Neon PostgreSQL with full audit trail including download method

### Key Files
- `index.ts` (621 lines) - Main service with workflow orchestration
- `scripts/postinstall.cjs` - Bun compatibility patch for slsk-client
- `package.json` - Configuration with postinstall hook

## Bun Compatibility Patch

**Critical for deployment:** This service requires a runtime patch to work with Bun.

### The Problem
Bun's `net.createConnection()` callback differs from Node.js:
- **Node.js:** `callback(error, undefined)` or `callback()` on success
- **Bun:** `callback(socket, undefined)` on success (socket as first arg)

This causes slsk-client to misinterpret successful connections as errors.

### The Solution
`scripts/postinstall.cjs` patches `node_modules/slsk-client/lib/server.js` automatically after install:

```javascript
// Detects Socket object in error position (Bun behavior)
if (socketOrErr && socketOrErr.constructor?.name === 'Socket') {
  cb(); // Success
} else if (socketOrErr) {
  cb(socketOrErr); // Actual error
}
```

**Deployment:** Patch applies automatically in all environments (local, Docker, Akash) during `bun install`.

## API

### POST /download-and-store
Fire-and-forget download request. Returns immediately, processes asynchronously.

**Request:**
```json
{
  "spotify_track_id": "0vGsFFCP4Z1GNXpZmSMfhf",
  "expected_title": "All Falls Down",
  "expected_artist": "Kanye West",
  "acoustid_api_key": "I9UjOdbcJK",
  "neon_database_url": "postgresql://...",
  "chain_id": 37111
}
```

**Response:**
```json
{
  "status": "processing",
  "workflow_id": "0vGsFFCP4Z1GNXpZmSMfhf"
}
```

### GET /health
Health check endpoint.

## Database Integration

Updates `song_audio` table with comprehensive metadata:

```sql
song_audio (
  spotify_track_id TEXT PRIMARY KEY,
  grove_cid TEXT,                      -- IPFS content ID
  grove_url TEXT,                      -- Full Grove URL
  duration_ms INTEGER,                 -- Track length
  acoustid TEXT,                       -- Fingerprint ID
  acoustid_match_score NUMERIC,       -- 0-1 confidence
  acoustid_match_confidence NUMERIC,  -- 0-1 match quality
  verified BOOLEAN,                    -- AcoustID passed
  source TEXT,                         -- "soulseek-p2p"
  file_size_bytes BIGINT,
  download_source TEXT,                -- "slsk-service"
  download_speed_kbps NUMERIC,
  download_peer_username TEXT,         -- P2P peer
  downloaded_from_file_path TEXT,      -- Remote file path
  search_query_used TEXT,              -- Which query worked
  search_results_count INTEGER
)
```

## Workflow Steps

1. **Try yt-dlp first** (YouTube search and download):
   - Search query: `"ytsearch1:{artist} {title}"`
   - Extract audio as MP3 (highest quality)
   - Timeout: 60 seconds
   - Validates minimum 100KB file size
   - If succeeds: Continue to step 5
   - If fails: Proceed to step 2 (Soulseek fallback)

2. **Fallback to Soulseek** (P2P network):
   - Connect to Soulseek (credentials from env)
   - Search with fallback queries:
     * `"{artist} {title}"`
     * `"{title} {artist}"`
     * `"{title}"`
     * Timeout: 4000ms per query (sweet spot)
   - Score peers:
     * Free upload slots (highest priority)
     * Connection speed
     * File size (larger = higher quality)
   - Download from best peer

3. **Verify with AcoustID** (optional):
   - Fingerprint audio file
   - Match against AcoustID database
   - Continues regardless of verification result (marks verified = TRUE/FALSE)

4. **Get file metadata** (duration, file size via ffprobe)

5. **Upload to Grove IPFS** (permanent decentralized storage)

6. **Update database** with all metrics:
   - Grove CID and URL
   - Download method ('yt-dlp' or 'soulseek')
   - Verification result and confidence
   - File size and duration
   - Search metadata (for Soulseek: peer username, download speed, query used)

## Search Strategy Notes

### Query Optimization
- **Exact artist+title:** Works for well-tagged files
- **Reversed title+artist:** Catches alternate tagging conventions
- **Title-only:** Last resort, finds mashups/covers/edits

### Timeout Paradox
Counter-intuitively, **longer timeouts return fewer results**:
- 10000ms (10s) → 0 results
- 4000ms (4s) → 3481 results

Current optimal: **4000ms**

### AcoustID Verification
- Often fails for P2P downloads (mashups, different masters, edits)
- Service **continues anyway** and marks `verified = FALSE`
- Not a blocker for P2P sources

## Performance Characteristics

### Latency
- API response: <50ms (fire-and-forget)
- Full workflow timing:
  - **yt-dlp success**: 30-60s (search + download + verify + Grove upload)
  - **Soulseek fallback**: 90-180s (60s yt-dlp timeout + P2P workflow)
  - Average: ~45s (weighted by yt-dlp success rate)

### Concurrency
- Currently processes one workflow at a time
- For parallel processing: Run multiple service instances

### Success Rate (Two-Stage Strategy)
- **Combined success**: ~95% (50% yt-dlp + 45% Soulseek fallback)
- **yt-dlp alone**: ~50% success for popular tracks
- **Soulseek alone**: ~90% success (depends on peer availability)
- **AcoustID verification**:
  - ~96-99% for yt-dlp downloads
  - ~30% for P2P downloads (mashups/edits common, not required)

## Common Issues

### No Search Results
- **Cause:** Misspelled artist/title, very rare track
- **Solution:** Try alternative spellings, check Spotify metadata

### Download Failure
- **Cause:** Peer disconnected, network timeout
- **Solution:** Submit new request (no retry logic)

### AcoustID Mismatch
- **Cause:** P2P file is mashup/edit/different master
- **Solution:** Normal behavior, continues with `verified = FALSE`

### Grove Upload Failure
- **Cause:** Network issue, file corruption
- **Solution:** Workflow aborts before database update, safe to retry

## Development

### Local Setup
```bash
cd audio-download-service
bun install  # Patch applied automatically
```

### Environment Variables
```bash
SOULSEEK_ACCOUNT=
SOULSEEK_PASSWORD=
PORT=3001  # optional
```

### Prerequisites
- **Bun runtime** (tested with Bun 1.0+)
- **yt-dlp** (installed globally or in PATH)
  ```bash
  # Install via pip
  pip install yt-dlp
  # Or via your package manager
  # apt install yt-dlp / brew install yt-dlp
  ```
- **ffprobe** (from FFmpeg, for audio metadata)
- **fpcalc** (from Chromaprint, for AcoustID fingerprinting)

### Start Service
```bash
bun start
# or with env
SOULSEEK_ACCOUNT=user SOULSEEK_PASSWORD=pass bun run index.ts
```

### Test Search

**Local Development:**
```bash
curl -X POST http://localhost:3001/download-and-store \
  -H "Content-Type: application/json" \
  -d '{
    "spotify_track_id": "test-track-id",
    "expected_title": "Song Title",
    "expected_artist": "Artist Name",
    "acoustid_api_key": "I9UjOdbcJK",
    "neon_database_url": "postgresql://...",
    "chain_id": 37111
  }'
```

**Production (Akash):**
```bash
curl -X POST https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com/download-and-store \
  -H "Content-Type: application/json" \
  -d '{
    "spotify_track_id": "test-track-id",
    "expected_title": "Song Title",
    "expected_artist": "Artist Name",
    "acoustid_api_key": "I9UjOdbcJK",
    "neon_database_url": "postgresql://...",
    "chain_id": 37111
  }'
```

### Monitor Logs
```bash
tail -f /tmp/slsk-service.log
```

## Docker Deployment

### Build
```bash
docker build -t slsk-service .
```

### Run
```bash
docker run -d \
  -p 3001:3001 \
  -e SOULSEEK_ACCOUNT=username \
  -e SOULSEEK_PASSWORD=password \
  --name slsk-service \
  slsk-service
```

## Integration with Pipeline

### Karaoke Pipeline Usage
The karaoke pipeline's `06-download-audio.ts` processor calls this service:

```typescript
// Configure endpoint (from environment variable)
const AUDIO_DOWNLOAD_SERVICE_URL = process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001';
// Production: https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com

// Fire request to audio-download-service
const response = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/download-and-store`, {
  method: 'POST',
  body: JSON.stringify({
    spotify_track_id: track.spotify_track_id,
    expected_title: track.title,
    expected_artist: track.artist,
    acoustid_api_key: config.ACOUSTID_API_KEY,
    neon_database_url: config.DATABASE_URL,
    chain_id: config.CHAIN_ID
  })
});

// Returns immediately, processing happens async
console.log(await response.json());
// { "status": "processing", "workflow_id": "..." }
```

### Pipeline Integration Points
1. **Input:** Tracks from `song_pipeline` table with Spotify metadata
2. **Process:** slsk-service handles download + upload + verification
3. **Output:** Updates `song_audio` table with Grove URLs + metadata
4. **Next Step:** Lyrics discovery and alignment (steps 5+)

## AI Agent Guidelines

### When to Use This Service
- Track has Spotify metadata but no audio file
- Need P2P download as alternative to freyr/yt-dlp
- Want automatic Grove IPFS upload
- Need comprehensive download audit trail

### When NOT to Use
- Track already has Grove URL in `song_audio`
- Need batch processing (use pipeline's batch processor instead)
- Need synchronous response (this is fire-and-forget)

### Common Agent Tasks
1. **Add new track to pipeline:**
   - Ensure `song_pipeline` has Spotify metadata
   - Call slsk-service for audio download
   - Monitor logs for completion
   - Verify `song_audio` table updated

2. **Retry failed download:**
   - Check logs for failure reason
   - Verify Spotify metadata is correct
   - Submit new request (no automatic retry)

3. **Debug search issues:**
   - Check if track exists on Soulseek network
   - Try alternative search queries manually
   - Consider using freyr-service as fallback

### Debugging Checklist
- [ ] Service is running (check health endpoint)
- [ ] Soulseek credentials are valid
- [ ] Spotify metadata is accurate (title/artist)
- [ ] Network allows P2P connections (not blocked)
- [ ] Grove IPFS endpoint is reachable
- [ ] Database connection is valid
- [ ] Check `/tmp/slsk-service.log` for detailed workflow

## Maintenance

### Monitoring
- Check logs for failed workflows
- Monitor search success rate
- Track Grove upload failures
- Review AcoustID verification rate

### Updates
- Keep `slsk-client` dependency current
- Re-verify Bun compatibility patch if library updates
- Monitor Soulseek network health

### Scaling
- Run multiple instances for parallel processing
- Use load balancer for request distribution
- Share Soulseek account across instances (supports multiple connections)

## Related Services
- **yt-dlp:** Primary audio download method (direct CLI, fast, ~50% success)
- **Soulseek P2P:** Fallback download method (slower, ~90% success)
- **karaoke-pipeline:** Orchestrates full processing workflow
- **Grove IPFS:** Decentralized storage for audio files
- **Neon PostgreSQL:** Metadata and audit trail storage

**Note:** This service replaced the previous freyr-service approach. The user reported "freyr was bad, yt-dlp worked ok" so we now use yt-dlp directly as the primary method with Soulseek as a robust fallback.
