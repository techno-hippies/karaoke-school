# Quansic Service - Agent Guide

## Core Commands

• **Development**: `bun run dev` (starts server on port 3000)
• **Build**: `docker build -t t3333chn0000/quansic-service:v1.1 .`
• **Deploy**: `akash provider send-manifest deploy-akash.yaml`
• **Test**: `curl -X POST https://your-akash-url/enrich-recording -H "Content-Type: application/json" -d '{"isrc": "USUM71104634"}'`

## Service Architecture

**Purpose**: Enriches music metadata using Quansic as PRIMARY data source (95%+ ISWC coverage vs MusicBrainz's 36%)

**Core Dependencies**:
- **Playwright**: Browser automation for Quansic Explorer
- **Express**: HTTP server framework
- **Account Pool**: Multiple accounts with smart rotation

## Key Patterns

**Account Pool Management**:
```typescript
interface AccountPool {
  current_index: number;
  accounts: Account[];
  rotateOnLimit: (requests: number, interval: number) => void;
}

interface Account {
  email: string;
  status: 'active' | 'failed' | 'cooldown';
  failure_count: number;
  last_used: Date;
}
```

**Enrichment Cascade** (PRIMARY source strategy):
1. **ISRC → Recording**: Get work ISWC, composers, platform IDs (95% coverage)
2. **ISWC → Work**: Get contributors, recording count, sample recordings
3. **ISNI → Artist**: Get IPN, Luminate ID, Gracenote ID, platform IDs

**API Patterns**:
```typescript
// PRIMARY: ISRC enrichment
POST /enrich-recording
{
  "isrc": "USUM71104634",
  "spotify_track_id": "1Dfr9xzgKmp4XcKylFgx4H"
}

// ISWC enrichment
POST /enrich-work
{
  "iswc": "T9113870874"
}

// Artist enrichment
POST /enrich
{
  "isni": "0000000121331720",
  "musicbrainz_mbid": "2437980f-513a-44fc-80f1-b90d9d7fcf8f"
}
```

## Development Patterns

**Environment Setup**:
```bash
# Local development
export QUANSIC_EMAIL="your-email@example.com"
export QUANSIC_PASSWORD="your-password"
bun run dev

# Multiple accounts for Akash
export QUANSIC_EMAIL="primary@example.com"
export QUANSIC_PASSWORD="password1!"
export QUANSIC_EMAIL_2="backup@example.com"
export QUANSIC_PASSWORD_2="password2!"
```

**Testing Flow**:
1. Check session: `GET /session-status`
2. View account pool: `GET /account-pool`
3. Test enrichment: `POST /enrich-recording`
4. Force re-auth: `POST /enrich` with `{"force_reauth": true}`

## Critical Files

**Main Service**: `index.ts` - Express server with Playwright automation
**Account Management**: Account pool with proactive rotation
**Session Management**: Persistent cookies to avoid re-authentication
**Data Storage**: Integrates with Neon PostgreSQL tables

## Session Management

**Session Lifecycle**:
- **Creation**: Playwright automation logs into Quansic
- **Persistence**: Cookies stored in memory (not persisted)
- **Expiration**: ~1 hour lifetime, auto-reauth on timeout
- **Rotation**: Proactive rotation before hitting limits

**Error Recovery**:
```typescript
const handleSessionError = async (error: Error) => {
  // Mark current account as failed
  accountPool.markFailed(currentAccount);
  
  // Rotate to next account
  const nextAccount = accountPool.getNext();
  
  // Re-authenticate
  await authenticate(nextAccount);
  
  // Retry original request
  return await retryEnrichment(request);
};
```

## Account Pool Strategy

**Setup (3-5 accounts recommended)**:
```yaml
env:
  - QUANSIC_EMAIL=account1@example.com
  - QUANSIC_PASSWORD=Password1!
  - QUANSIC_EMAIL_2=account2@example.com
  - QUANSIC_PASSWORD_2=Password2!
  - QUANSIC_EMAIL_3=account3@example.com
  - QUANSIC_PASSWORD_3=Password3!
  - REQUESTS_PER_ACCOUNT=50
  - ROTATION_INTERVAL_MS=1800000
```

**Rotation Triggers**:
- **Request count**: After N requests (default: 50)
- **Time interval**: After 30 minutes
- **Authentication failure**: Immediate rotation
- **Rate limit detection**: Smart backoff

## Database Integration

**PRIMARY Data Strategy** (Quansic over MusicBrainz):

### Recording Enrichment
```sql
-- ISRC → Recording with work ISWC (PRIMARY over MusicBrainz)
CREATE TABLE quansic_recordings (
  isrc TEXT PRIMARY KEY,
  recording_mbid TEXT,
  spotify_track_id TEXT,
  title TEXT NOT NULL,
  iswc TEXT,                    -- 95% coverage vs 36% in MB
  work_title TEXT,
  artists JSONB NOT NULL DEFAULT '[]',
  composers JSONB NOT NULL DEFAULT '[]',
  platform_ids JSONB,
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Work Enrichment
```sql
-- ISWC → Work with composers
CREATE TABLE quansic_works (
  iswc TEXT PRIMARY KEY,
  work_mbid TEXT,
  title TEXT NOT NULL,
  contributors JSONB NOT NULL DEFAULT '[]',  -- Composers with ISNIs/IPIs
  recording_count INTEGER,
  q1_score INTEGER,
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Artist Enrichment
```sql
-- ISNI → Artist with platform IDs
CREATE TABLE quansic_artists (
  isni TEXT PRIMARY KEY,
  musicbrainz_mbid TEXT,
  ipn TEXT,                     -- International Performers Number
  luminate_id TEXT,
  gracenote_id TEXT,
  name_variants JSONB NOT NULL DEFAULT '[]',
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Akash Deployment

**SDL Configuration**:
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
    env:
      - PORT=3000
      - QUANSIC_EMAIL=official863@tiffincrane.com
      - QUANSIC_PASSWORD=Temporarypw710!
      - REQUESTS_PER_ACCOUNT=50
      - ROTATION_INTERVAL_MS=1800000

profiles:
  compute:
    quansic:
      resources:
        cpu:
          units: 2
        memory:
          size: 4Gi
        storage:
          - size: 20Gi  # Browser cache

  placement:
    akash:
      pricing:
        quansic:
          denom: uakt
          amount: 10000  # ~$0.01-0.03/hour
```

**Deployment Flow**:
```bash
# 1. Build and push
docker build -t t3333chn0000/quansic-service:v1.1 .
docker push t3333chn0000/quansic-service:v1.1

# 2. Create deployment
akash tx deployment create deploy-akash.yaml --from YOUR_WALLET

# 3. Create lease and send manifest
akash tx market lease create --dseq DEPLOYMENT_SEQ --provider PROVIDER --from YOUR_WALLET
akash provider send-manifest deploy-akash.yaml --dseq DEPLOYMENT_SEQ --provider PROVIDER --from YOUR_WALLET

# 4. Get URL
akash provider lease-status --dseq DEPLOYMENT_SEQ --provider PROVIDER --from YOUR_WALLET
```

## Performance Metrics

**Response Times**:
- **First request**: ~5-10s (Playwright auth)
- **Subsequent**: ~200-500ms (cached session)
- **Session lifetime**: 1 hour
- **Rate limiting**: 200ms between requests

**Cost Optimization**:
- **Auto-scale to zero**: No idle costs
- **Account rotation**: Distributes load across accounts
- **Session persistence**: Avoids re-authentication overhead

## Gotchas

**Playwright Requirements**:
- Needs 4-6GB RAM for browser automation
- Linux dependencies: `apt-get install -y libgtk-3-0 libnss3 libxss1 libasound2`
- Browser cache: 20GB ephemeral storage in Akash

**Quansic Rate Limits**:
- No official rate limits, but account suspension possible
- Proactive rotation prevents triggering limits
- Monitor `GET /account-pool` for health status

**Data Quality**:
- 95%+ ISWC coverage vs MusicBrainz's 36%
- Returns clean, focused data (not all 23 recordings for a work)
- Composers include ISNIs/IPIs plus nationality/birthdate

**Session Persistence**:
- Cookies stored in memory (lost on container restart)
- Auto-reauth on session expiry
- Use `force_reauth: true` to force new authentication

## Integration with Cloudflare Worker

**Enrichment Pipeline** (called from `cloudflare-worker-scraper`):
```typescript
// Add to src/routes/enrichment.ts
enrichment.post('/enrich-quansic-recordings', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const quansicUrl = c.env.QUANSIC_SERVICE_URL;
  
  // Get recordings with ISRC but no ISWC
  const unenriched = await db.sql`
    SELECT r.isrc, r.spotify_track_id 
    FROM musicbrainz_recordings r
    WHERE r.isrc IS NOT NULL AND r.iswc IS NULL
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

## Troubleshooting

**Session expired errors**:
```bash
# Force re-authentication
curl -X POST https://your-akash-url/enrich -H "Content-Type: application/json" -d '{"isni": "...", "force_reauth": true}'
```

**Account pool issues**:
```bash
# Check account status
curl https://your-akash-url/account-pool

# Monitor failure counts and rotation
```

**Browser crashes**:
- Increase memory in Akash deployment (6Gi+)
- Check Playwright version compatibility
- Monitor container logs: `akash provider lease-logs`
