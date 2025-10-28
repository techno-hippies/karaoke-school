# Quansic Enrichment Service

API service for enriching music metadata with Quansic as the **PRIMARY** data source, deployed on Akash Network.

## Features

- **Playwright Authentication**: Automated login to Quansic with session management
- **Account Pool Management**: Automatic account rotation and creation on auth failures
- **Auto-Recovery**: Creates new accounts automatically when authentication times out
- **ISNI Enrichment**: Fetch artist data including IPN, Luminate ID, Gracenote ID, etc.
- **ISRC Enrichment**: Fetch recording metadata, work ISWCs, composers, and platform IDs (PRIMARY)
- **ISWC Enrichment**: Fetch work metadata, composers with ISNIs/IPIs, and sample recordings
- **Entity Search**: Fallback search for secondary ISNIs
- **Session Caching**: Persistent session cookies to avoid re-authentication
- **Akash Deployment**: Runs on decentralized cloud infrastructure

## Data Strategy

**Quansic is the PRIMARY data source** - MusicBrainz is used as backup only:
- **ISRC → Recording enrichment**: Clean, focused data for filling missing metadata
- **ISWC → Work enrichment**: Comprehensive work data with composers and platform IDs
- **ISNI → Artist enrichment**: Platform IDs and industry identifiers

Quansic provides ~95%+ ISWC coverage vs MusicBrainz's ~36% coverage.

## API Endpoints

### `GET /health`
Health check with session status
```bash
curl https://your-akash-url/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "session_valid": true,
  "session_expires_in": 3456789,
  "service": "quansic-enrichment-service",
  "version": "1.0.0"
}
```

### `POST /auth`
Authenticate with Quansic credentials (optional - auto-authenticates on first request)
```bash
curl -X POST https://your-akash-url/auth \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

### `POST /enrich`
Enrich artist data by ISNI
```bash
curl -X POST https://your-akash-url/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "isni": "0000000121331720",
    "musicbrainz_mbid": "2437980f-513a-44fc-80f1-b90d9d7fcf8f"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "isni": "0000000121331720",
    "musicbrainz_mbid": "2437980f-513a-44fc-80f1-b90d9d7fcf8f",
    "ipn": "00000000124",
    "luminate_id": "123456",
    "gracenote_id": "78910",
    "amazon_id": null,
    "apple_music_id": "456789",
    "name_variants": [
      { "name": "Artist Name", "language": "en" }
    ],
    "raw_data": { ... }
  }
}
```

### `POST /search`
Search for artist by ISNI (entity search)
```bash
curl -X POST https://your-akash-url/search \
  -H "Content-Type: application/json" \
  -d '{"isni": "0000000121331720"}'
```

### `POST /enrich-recording` **(NEW - PRIMARY)**
Enrich recording by ISRC - Returns recording metadata, work ISWC, composers, and platform IDs
```bash
curl -X POST https://your-akash-url/enrich-recording \
  -H "Content-Type: application/json" \
  -d '{
    "isrc": "USUM71104634",
    "spotify_track_id": "1Dfr9xzgKmp4XcKylFgx4H",
    "recording_mbid": "1958cd43-42c2-454f-89cd-6ee42a2de1e8"
  }'
```

Response includes:
- Recording metadata (title, duration, release date)
- ISWC and work title
- Artists with ISNIs and full platform IDs (Spotify, Apple, MusicBrainz, etc.)
- Composers with ISNIs and IPIs
- Platform IDs (spotify, apple, musicbrainz, luminate, gracenote)
- Q2 quality score

### `POST /enrich-work` **(NEW)**
Enrich work by ISWC - Returns work metadata, composers, and sample recordings
```bash
curl -X POST https://your-akash-url/enrich-work \
  -H "Content-Type: application/json" \
  -d '{
    "iswc": "T9113870874",
    "work_mbid": "some-mbid-if-available"
  }'
```

Response includes:
- Work title and ISWC
- Contributors (composers) with ISNIs, IPIs, birthdates, nationalities
- Recording count for this work
- Q1 quality score
- Sample recordings (5 shown) with ISRCs and artist info

### `GET /session-status`
Check if session is valid
```bash
curl https://your-akash-url/session-status
```

### `GET /account-pool` **(NEW)**
View account pool status and rotation info
```bash
curl https://your-akash-url/account-pool
```

Response:
```json
{
  "current_index": 0,
  "total_accounts": 3,
  "accounts": [
    {
      "index": 0,
      "email": "primary@example.com",
      "status": "active",
      "failure_count": 0,
      "last_used": "2025-01-15T10:30:00.000Z",
      "is_current": true
    },
    {
      "index": 1,
      "email": "happytiger1234@tiffincrane.com",
      "status": "active",
      "failure_count": 0,
      "last_used": "never",
      "is_current": false
    }
  ]
}
```

## Local Development

```bash
# Install dependencies
bun install

# Set environment variables
export QUANSIC_EMAIL="your-email@example.com"
export QUANSIC_PASSWORD="your-password"

# Run locally
bun run dev
```

## Docker Build

```bash
# Build image
docker build -t t3333chn0000/quansic-service:v1.0 .

# Run locally with Docker
docker run -p 3000:3000 \
  -e QUANSIC_EMAIL="your-email@example.com" \
  -e QUANSIC_PASSWORD="your-password" \
  t3333chn0000/quansic-service:v1.0

# Push to Docker Hub
docker push t3333chn0000/quansic-service:v1.0
```

## Akash Deployment

### Prerequisites
- Akash CLI installed
- AKT tokens for deployment
- Docker image pushed to Docker Hub (`t3333chn0000/quansic-service:v1.1`)

### SDL Configuration

Yes, the `deploy-akash.yaml` is correct. **Add your credentials** where indicated:

```yaml
version: "2.2"

services:
  quansic:
    image: t3333chn0000/quansic-service:v1.1
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
        accept:
          - webdisplay
    env:
      - PORT=3000
      - NODE_ENV=production
      - QUANSIC_EMAIL=official863@tiffincrane.com     # ← Put your email here
      - QUANSIC_PASSWORD=Temporarypw710!              # ← Put your password here

profiles:
  compute:
    quansic:
      resources:
        cpu:
          units: 2
        memory:
          size: 4Gi
        storage:
          - size: 20Gi  # Ephemeral storage for browser cache

  placement:
    akash:
      pricing:
        quansic:
          denom: uakt
          amount: 10000  # Max bid per block (~$0.01-0.03/hour)

deployment:
  quansic:
    akash:
      profile: quansic
      count: 1
```

2. **Create certificate** (first time only):
```bash
akash tx cert generate client --from YOUR_WALLET
akash tx cert publish client --from YOUR_WALLET
```

3. **Create deployment**:
```bash
akash tx deployment create deploy-akash.yaml --from YOUR_WALLET
```

4. **View bids**:
```bash
akash query market bid list --owner YOUR_ADDRESS
```

5. **Create lease**:
```bash
akash tx market lease create \
  --dseq DEPLOYMENT_SEQ \
  --provider PROVIDER_ADDRESS \
  --from YOUR_WALLET
```

6. **Send manifest**:
```bash
akash provider send-manifest deploy-akash.yaml \
  --dseq DEPLOYMENT_SEQ \
  --provider PROVIDER_ADDRESS \
  --from YOUR_WALLET
```

7. **Get service URL**:
```bash
akash provider lease-status \
  --dseq DEPLOYMENT_SEQ \
  --provider PROVIDER_ADDRESS \
  --from YOUR_WALLET
```

### Update Deployment

```bash
# Build and push new image
docker build -t t3333chn0000/quansic-service:v1.1 .
docker push t3333chn0000/quansic-service:v1.1

# Update deploy-akash.yaml with new version tag

# Update deployment
akash provider send-manifest deploy-akash.yaml \
  --dseq DEPLOYMENT_SEQ \
  --provider PROVIDER_ADDRESS \
  --from YOUR_WALLET
```

## Architecture

```
┌─────────────────────────────────────────┐
│     Cloudflare Worker (Enrichment)      │
│                                          │
│  - Receives enrichment requests         │
│  - Calls Quansic Service API             │
│  - Stores results in Neon DB            │
└──────────────┬──────────────────────────┘
               │
               │ HTTP POST /enrich-recording (ISRC → PRIMARY)
               │ HTTP POST /enrich-work (ISWC)
               │ HTTP POST /enrich (ISNI)
               │
               ▼
┌─────────────────────────────────────────┐
│    Quansic Service (Akash Deployment)   │
│                                          │
│  - Playwright browser automation        │
│  - Session cookie management            │
│  - ISRC → recording + work enrichment   │
│  - ISWC → work + composers enrichment   │
│  - ISNI → artist enrichment             │
└──────────────┬──────────────────────────┘
               │
               │ Authenticated API calls
               │
               ▼
┌─────────────────────────────────────────┐
│         Quansic Explorer API            │
│                                          │
│  - /api/q/lookup/recording/isrc/...     │
│  - /api/q/lookup/work/iswc/...          │
│  - /api/q/lookup/party/isni/...         │
│  - /api/log/entitySearch                │
└─────────────────────────────────────────┘
```

## Database Integration

**Quansic as PRIMARY source** - The service enriches music metadata in Neon DB:

### Recording Enrichment (PRIMARY)
```sql
-- ISRC → Recording enrichment
-- Fills: ISWC, work metadata, composers, platform IDs
SELECT isrc, title, iswc, work_title, spotify_id, apple_id
FROM quansic_recordings
WHERE isrc = 'USUM71104634';
```

### Work Enrichment
```sql
-- ISWC → Work enrichment
-- Fills: Composers with ISNIs/IPIs, recording count
SELECT iswc, title, contributors, recording_count, q1_score
FROM quansic_works
WHERE iswc = 'T9113870874';
```

### Artist Enrichment
```sql
-- ISNI → Artist enrichment
-- Fills: Platform IDs, industry identifiers
SELECT isni, musicbrainz_mbid, ipn, luminate_id, gracenote_id
FROM quansic_artists
WHERE musicbrainz_mbid = 'some-mbid';
```

Foreign key relationships:
```
quansic_recordings.recording_mbid → musicbrainz_recordings.recording_mbid
quansic_works.work_mbid → musicbrainz_works.work_mbid
quansic_artists.musicbrainz_mbid → musicbrainz_artists.mbid
```

## Account Pool & Proactive Rotation

The service uses **multiple accounts with smart rotation** to avoid rate limits:

### Setup (3-5 Accounts Recommended)

1. **Manually create 3-5 Quansic accounts** at https://explorer.quansic.com/app-register
2. **Add them to your deployment config:**

```yaml
env:
  # Primary account
  - QUANSIC_EMAIL=account1@example.com
  - QUANSIC_PASSWORD=Password1!

  # Backup accounts
  - QUANSIC_EMAIL_2=account2@example.com
  - QUANSIC_PASSWORD_2=Password2!
  - QUANSIC_EMAIL_3=account3@example.com
  - QUANSIC_PASSWORD_3=Password3!

  # Optional: tune rotation behavior
  - REQUESTS_PER_ACCOUNT=50        # Rotate after 50 requests
  - ROTATION_INTERVAL_MS=1800000   # Or after 30 minutes
```

### How It Works

1. **Proactive Rotation** - Rotates BEFORE hitting limits:
   - After N requests (default: 50)
   - After time interval (default: 30 minutes)
   - When account fails

2. **Round-Robin** - Cycles through all accounts evenly

3. **Failure Handling** - Marks failed accounts, auto-resets after cooldown

4. **Monitoring**: `GET /account-pool` shows:
   - Current account
   - Request counts per account
   - Requests until rotation
   - Account status

## Troubleshooting

### Session expired errors
The service auto-re-authenticates when sessions expire. If you see persistent errors:
```bash
# Force re-authentication
curl -X POST https://your-akash-url/enrich \
  -H "Content-Type: application/json" \
  -d '{"isni": "...", "force_reauth": true}'
```

### View account pool status
```bash
curl https://your-akash-url/account-pool
```

### Playwright browser crashes
Check Akash logs:
```bash
akash provider lease-logs \
  --dseq DEPLOYMENT_SEQ \
  --provider PROVIDER_ADDRESS \
  --from YOUR_WALLET
```

Increase memory in `deploy-akash.yaml` if needed:
```yaml
memory:
  size: 6Gi  # Increase from 4Gi
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `QUANSIC_EMAIL` | Yes | Quansic account email |
| `QUANSIC_PASSWORD` | Yes | Quansic account password |
| `NODE_ENV` | No | Environment (production/development) |

## Security Notes

- Credentials are passed as environment variables (encrypted by Akash)
- Session cookies stored in memory only (not persisted)
- HTTPS required for production use
- Consider using Akash secrets for credentials

## Performance

- **First request**: ~5-10s (includes Playwright auth)
- **Subsequent requests**: ~200-500ms (cached session)
- **Session lifetime**: 1 hour
- **Rate limiting**: 200ms between requests (handled by client)

---

## Cloudflare Worker Integration

### Enrichment Pipeline Flow

The Cloudflare Worker (`cloudflare-worker-scraper`) enriches music metadata through a **cascade**:

```
TikTok Videos (scraped)
    ↓ automatic
Spotify Tracks
    ↓ POST /enrich-artists
Spotify Artists
    ↓ POST /enrich-genius
Genius Songs
    ↓ POST /enrich-musicbrainz?type=artists
MusicBrainz Artists (ISNI)
    ↓ POST /enrich-musicbrainz?type=recordings
MusicBrainz Recordings (ISRC)
    ↓ automatic if relation exists
MusicBrainz Works (ISWC) - 36% coverage ❌
    ↓ POST /enrich-quansic-recordings (NEW)
Quansic Recordings (ISRC → ISWC) - 95% coverage ✅
    ↓ POST /enrich-quansic-works
Quansic Works (ISWC → Composers)
    ↓ POST /enrich-quansic
Quansic Artists (ISNI → Platform IDs)
```

### What Triggers What?

**Automatic:**
- `GET /scrape/:handle` → Auto-enriches Spotify Tracks in background
- MusicBrainz Recording enrichment → Auto-fetches associated Works if relation exists

**Manual (POST endpoints):**
| Endpoint | What it does | Queries |
|----------|-------------|---------|
| `POST /enrich` | Enrich Spotify tracks | Tracks with `spotify_track_id` but no metadata |
| `POST /enrich-artists` | Enrich Spotify artists | Artists with `spotify_artist_id` but no metadata |
| `POST /enrich-genius` | Enrich Genius songs | Tracks with metadata but no Genius song |
| `POST /enrich-musicbrainz?type=artists` | MB artist lookup | Spotify artists → Search by name → Get ISNI |
| `POST /enrich-musicbrainz?type=recordings` | MB recording lookup | Tracks with ISRC → Get recording + works |
| **`POST /enrich-quansic-recordings`** | **ISRC → ISWC** (PRIMARY) | Recordings with ISRC but no ISWC |
| **`POST /enrich-quansic-works`** | **ISWC → Composers** | Works with ISWC, get full composer data |
| `POST /enrich-quansic` | ISNI → Platform IDs | MB artists with ISNI → Get IPN, Luminate, etc. |

### Monitoring Progress

**GET /enrichment-queue** - Shows what's pending at each stage:
```json
{
  "spotify_tracks": { "count": 150 },
  "genius_tracks": { "count": 120 },
  "musicbrainz_recordings": { "count": 130 },
  "quansic_artists": { "count": 25 }
}
```

**GET /cascade-status?handle=theweeknd** - Shows completion % per creator:
```json
{
  "cascade": [
    { "stage": "Spotify Tracks", "total": 150, "enriched": 150, "pct": 100.0 },
    { "stage": "MusicBrainz Recordings", "total": 150, "enriched": 130, "pct": 86.7 },
    { "stage": "MusicBrainz Works", "total": 130, "enriched": 47, "pct": 36.2 }
  ]
}
```

### Why Quansic is PRIMARY

**MusicBrainz Problem:**
- Only 36% of works have ISWCs in your DB (4/11 songs)
- ISWC lookup returns messy data (work + all 23 recordings)

**Quansic Solution:**
- 95%+ ISWC coverage
- ISRC lookup returns clean, focused data (recording + work ISWC + composers)
- ISWC lookup returns composer ISNIs/IPIs + nationality + birthdate

### Adding Quansic ISRC/ISWC Enrichment

1. **Deploy this service to Akash** (see above)

2. **Add Akash URL to Cloudflare Worker:**
```bash
cd cloudflare-worker-scraper
wrangler secret put QUANSIC_SERVICE_URL
# Enter: https://your-akash-deployment-url
```

3. **Create Neon DB tables:**
```sql
CREATE TABLE quansic_recordings (
  isrc TEXT PRIMARY KEY,
  recording_mbid TEXT,
  spotify_track_id TEXT,
  title TEXT NOT NULL,
  iswc TEXT,
  work_title TEXT,
  artists JSONB NOT NULL DEFAULT '[]',
  composers JSONB NOT NULL DEFAULT '[]',
  platform_ids JSONB,
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (recording_mbid) REFERENCES musicbrainz_recordings(recording_mbid)
);

CREATE TABLE quansic_works (
  iswc TEXT PRIMARY KEY,
  work_mbid TEXT,
  title TEXT NOT NULL,
  contributors JSONB NOT NULL DEFAULT '[]',
  recording_count INTEGER,
  q1_score INTEGER,
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (work_mbid) REFERENCES musicbrainz_works(work_mbid)
);
```

4. **Add endpoints to `cloudflare-worker-scraper/src/routes/enrichment.ts`:**
```typescript
enrichment.post('/enrich-quansic-recordings', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const quansicUrl = c.env.QUANSIC_SERVICE_URL;
  const limit = parseInt(c.req.query('limit') || '10');

  // Get recordings with ISRC but no ISWC
  const unenriched = await db.sql`
    SELECT r.isrc, r.spotify_track_id, r.recording_mbid
    FROM musicbrainz_recordings r
    LEFT JOIN work_recording_links wrl ON r.recording_mbid = wrl.recording_mbid
    WHERE r.isrc IS NOT NULL AND wrl.work_mbid IS NULL
    LIMIT ${limit}
  `;

  for (const rec of unenriched) {
    const response = await fetch(`${quansicUrl}/enrich-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isrc: rec.isrc, spotify_track_id: rec.spotify_track_id })
    });

    if (response.ok) {
      const { data } = await response.json();
      await db.sql`INSERT INTO quansic_recordings (...) VALUES (...)`;
    }
  }
});
```

### Recommended Enrichment Order

Run in this order after scraping TikTok:
1. `POST /enrich-artists`
2. `POST /enrich-genius`
3. `POST /enrich-musicbrainz?type=artists`
4. `POST /enrich-musicbrainz?type=recordings`
5. **`POST /enrich-quansic-recordings`** ← PRIMARY ISWC enrichment
6. **`POST /enrich-quansic-works`** ← Composer enrichment
7. `POST /enrich-quansic` ← Artist platform IDs

## License

MIT
