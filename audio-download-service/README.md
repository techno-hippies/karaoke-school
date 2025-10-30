# Soulseek Download Service

Fire-and-forget Soulseek download service for the karaoke pipeline. Handles P2P downloads, AcoustID verification, and database integration.

## Features

- P2P download via Soulseek network using `slsk-client`
- Smart search with fallback queries
- Peer quality scoring (speed, free slots, file size)
- AcoustID verification (optional, can skip for P2P sources)
- Grove IPFS upload for verified tracks
- Database integration with Neon PostgreSQL
- Fire-and-forget API for async processing

## Bun Compatibility Patch

**Important:** This service uses a patched version of `slsk-client` to work with Bun runtime.

### The Issue
Bun's `net.createConnection()` callback behavior differs from Node.js:
- **Node.js:** Calls callback with `(error, undefined)` or just `()` on success
- **Bun:** Calls callback with `(socket, undefined)` on success, passing the socket as first arg

This causes `slsk-client` to treat successful connections as errors when running on Bun.

### The Solution
The postinstall script (`scripts/postinstall.cjs`) automatically patches `node_modules/slsk-client/lib/server.js` after installation.

The patch adds Bun detection logic:
```javascript
// Detects if first arg is Socket object (Bun behavior)
if (socketOrErr && socketOrErr.constructor?.name === 'Socket') {
  cb(); // Success
} else if (socketOrErr) {
  cb(socketOrErr); // Actual error
} else {
  cb(); // Normal Node.js success
}
```

### Deployment
The patch is automatically applied during:
- `bun install`
- `npm install`
- Docker builds (`RUN bun install` applies the patch)

**Docker Example:**
```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
COPY scripts/ ./scripts/
RUN bun install  # Patch applied here
COPY . .
CMD ["bun", "run", "index.ts"]
```

**Akash Deployment:**
The patch is part of the committed codebase (`scripts/postinstall.cjs`), so it works transparently in any deployment environment that runs `bun install` or `npm install`.

### Verification
Check if patch is applied:
```bash
bun run scripts/postinstall.cjs
# Output: "✅ Patch already applied" or "✅ Successfully patched"
```

## Installation

```bash
bun install
```

The Bun compatibility patch will be applied automatically.

## Usage

### Start the service
```bash
bun start
# or
SOULSEEK_ACCOUNT=username SOULSEEK_PASSWORD=pass bun run index.ts
```

### Fire-and-forget download request
```bash
curl -X POST http://localhost:3001/download-and-store \
  -H "Content-Type: application/json" \
  -d '{
    "spotify_track_id": "0vGsFFCP4Z1GNXpZmSMfhf",
    "expected_title": "All Falls Down",
    "expected_artist": "Kanye West",
    "acoustid_api_key": "I9UjOdbcJK",
    "neon_database_url": "postgresql://...",
    "chain_id": 37111
  }'
```

Response:
```json
{
  "status": "processing",
  "workflow_id": "0vGsFFCP4Z1GNXpZmSMfhf"
}
```

The service processes downloads asynchronously. Check logs for progress:
```bash
tail -f /tmp/slsk-service.log
```

## Configuration

### Environment Variables
- `SOULSEEK_ACCOUNT` - Soulseek username
- `SOULSEEK_PASSWORD` - Soulseek password
- `PORT` - Service port (default: 3001)

### Request Parameters
- `spotify_track_id` - Track ID for database lookup
- `expected_title` - Song title for search
- `expected_artist` - Artist name for search
- `acoustid_api_key` - AcoustID application key (for verification)
- `neon_database_url` - PostgreSQL connection string
- `chain_id` - Blockchain chain ID (for Grove)

## Architecture

```
1. Receive fire-and-forget request
2. Start async workflow:
   - Connect to Soulseek P2P network
   - Search with smart fallback queries
   - Score peers (speed, slots, file size)
   - Download from best peer
   - Verify with AcoustID (optional, skips for P2P)
   - Upload to Grove IPFS
   - Update database with all metadata
3. Return immediately with processing status
```

## Endpoints

### `POST /download-and-store`
Fire-and-forget download request. Returns immediately while processing in background.

### `GET /health`
Health check endpoint.

## Database Schema

Updates `song_audio` table:
```sql
song_audio (
  spotify_track_id TEXT PRIMARY KEY,
  grove_cid TEXT,
  grove_url TEXT,
  duration_ms INTEGER,
  acoustid TEXT,
  acoustid_match_score NUMERIC,
  acoustid_match_confidence NUMERIC,
  verified BOOLEAN,
  source TEXT,
  file_size_bytes BIGINT,
  download_source TEXT,
  download_speed_kbps NUMERIC,
  download_peer_username TEXT,
  downloaded_from_file_path TEXT,
  search_query_used TEXT,
  search_results_count INTEGER
)
```

## Search Strategy

1. Try exact: `"{artist} {title}"`
2. Try reversed: `"{title} {artist}"`
3. Try title only: `"{title}"`

Uses first query with results >0. Timeout: 4000ms per query.

## Peer Scoring

Ranks peers by:
1. Free upload slots (highest priority)
2. Connection speed (kbps)
3. File size (prefers larger = higher quality)

## Error Handling

- **No results:** Logs error, does not update database
- **Download failure:** Retries are NOT implemented (use fresh request)
- **AcoustID failure:** Skips verification for P2P sources (logs warning)
- **Grove upload failure:** Aborts before database update
- **Database error:** Logs detailed error with SQL context

## Logs

All workflow progress logged to `/tmp/slsk-service.log` with emojis:
```
🔄 Starting workflow for: test-track
[1/5] Downloading via Soulseek...
  🔍 Searching: "Kanye West All Falls Down"
     Found 3481 results
  🎯 Top candidates:
     1. username - 4.4MB, 20997518kb/s, FREE
  ✅ Downloaded: test-track.mp3
[2/5] Verifying with AcoustID...
  ⚠️  Verification failed but continuing (P2P source)
[3/5] Getting file metadata...
[4/5] Uploading to Grove IPFS...
  ✅ Uploaded: eb0a841cd...
[5/5] Updating database...
✅ Workflow complete
```

## Testing

```bash
# Test Bun compatibility
bun run test-slsk-connection.ts

# Test full workflow
bun run test-workflow.ts
```

## Notes

- **Timeout paradox:** Longer search timeouts (>5s) sometimes return 0 results. Current optimal: 4000ms
- **AcoustID for P2P:** Verification often fails for P2P downloads (mashups, edits, different masters). Service continues anyway.
- **Fire-and-forget:** No retry logic. If workflow fails, submit new request.
- **Concurrency:** Currently processes one workflow at a time. For parallel processing, run multiple service instances.
