# BMI Integration Architecture

## Overview

Integration of BMI Songview data into the karaoke-school-v1 pipeline to provide ISWC discovery and publisher/writer verification.

---

## Database Schema

### New Table: `bmi_works`

```sql
CREATE TABLE bmi_works (
  -- Primary Key: BMI's work identifier
  bmi_work_id TEXT PRIMARY KEY,

  -- Core identifiers
  iswc TEXT,                           -- International Standard Musical Work Code (indexed)
  ascap_work_id TEXT,                  -- ASCAP work ID (cross-PRO reference)
  title TEXT NOT NULL,

  -- Writer data (JSONB array)
  -- [{ name, affiliation, ipi }]
  writers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Publisher data (JSONB array)
  -- [{ name, affiliation, ipi, parent_publisher?, address?, phone?, email?, website? }]
  publishers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Performer data (JSONB array of strings)
  -- ["SABRINA CARPENTER", "KIDZ BOP KIDS", ...]
  performers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Ownership shares (JSONB object)
  -- { "BMI": "50.01%", "ASCAP": "50%", "Other": "23.75%" }
  shares JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Work status
  status TEXT,                         -- 'RECONCILED' | 'UNDER_REVIEW' | NULL
  status_description TEXT,

  -- Raw BMI response
  raw_data JSONB NOT NULL,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_bmi_works_iswc ON bmi_works(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_bmi_works_ascap_id ON bmi_works(ascap_work_id) WHERE ascap_work_id IS NOT NULL;
CREATE INDEX idx_bmi_works_title ON bmi_works(title);
CREATE INDEX idx_bmi_works_status ON bmi_works(status) WHERE status IS NOT NULL;

-- GIN indexes for JSONB search
CREATE INDEX idx_bmi_works_writers ON bmi_works USING gin(writers);
CREATE INDEX idx_bmi_works_publishers ON bmi_works USING gin(publishers);
CREATE INDEX idx_bmi_works_performers ON bmi_works USING gin(performers);
```

---

## Data Flow

### 1. Discovery Phase (ISWC Unknown)

```
Spotify Track
  ↓
MusicBrainz Recording (ISRC)
  ↓
MusicBrainz Work (title + artist)
  ↓
BMI Scraper (title + performer search)
  ↓
bmi_works table (ISWC discovered!)
```

### 2. Verification Phase (ISWC Known)

```
Quansic Work (ISWC)
  ↓
BMI Scraper (ISWC direct lookup)
  ↓
bmi_works table (publisher/writer verification)
  ↓
Compare with mlc_works (publisher share validation)
```

---

## Cloudflare Worker Routes

### File: `cloudflare-worker-scraper/src/routes/bmi.ts`

```typescript
import { Hono } from 'hono';
import { NeonDB } from '../neon';
import type { Env } from '../types';

const bmi = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich-bmi-by-title
 * Search BMI by title + performer (for ISWC discovery)
 *
 * Use case: When ISWC is unknown, search by song metadata
 * Query: SELECT tracks with no ISWC from MusicBrainz
 */
bmi.post('/enrich-bmi-by-title', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  // Find MusicBrainz works with no ISWC
  const unenrichedWorks = await db.sql`
    SELECT mw.work_mbid, mw.title, ma.name as artist_name
    FROM musicbrainz_works mw
    LEFT JOIN musicbrainz_artists ma ON mw.artist_mbid = ma.artist_mbid
    LEFT JOIN bmi_works bw ON mw.title = bw.title  -- Approximate match
    WHERE mw.iswc IS NULL
      AND bw.bmi_work_id IS NULL
      AND mw.title IS NOT NULL
    LIMIT ${limit}
  `;

  let enriched = 0;
  const results = [];

  for (const work of unenrichedWorks) {
    try {
      // Call BMI service (deployed on Akash)
      const response = await fetch(`${c.env.BMI_SERVICE_URL}/search/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: work.title,
          performer: work.artist_name
        })
      });

      if (!response.ok) {
        results.push({ work_mbid: work.work_mbid, status: 'not_found' });
        continue;
      }

      const bmiData = await response.json();

      // Store in bmi_works table
      await db.sql`
        INSERT INTO bmi_works (
          bmi_work_id, iswc, ascap_work_id, title,
          writers, publishers, performers, shares,
          status, status_description, raw_data
        ) VALUES (
          ${bmiData.data.bmi_work_id},
          ${bmiData.data.iswc},
          ${bmiData.data.ascap_work_id},
          ${bmiData.data.title},
          ${JSON.stringify(bmiData.data.writers)},
          ${JSON.stringify(bmiData.data.publishers)},
          ${JSON.stringify(bmiData.data.performers)},
          ${JSON.stringify(bmiData.data.shares)},
          ${bmiData.data.status},
          ${bmiData.data.status_description},
          ${JSON.stringify(bmiData.data)}
        )
        ON CONFLICT (bmi_work_id) DO UPDATE SET
          iswc = EXCLUDED.iswc,
          title = EXCLUDED.title,
          writers = EXCLUDED.writers,
          publishers = EXCLUDED.publishers,
          performers = EXCLUDED.performers,
          shares = EXCLUDED.shares,
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;

      // Update MusicBrainz work with discovered ISWC
      if (bmiData.data.iswc) {
        await db.sql`
          UPDATE musicbrainz_works
          SET iswc = ${bmiData.data.iswc}, updated_at = NOW()
          WHERE work_mbid = ${work.work_mbid}
        `;
      }

      enriched++;
      results.push({
        work_mbid: work.work_mbid,
        bmi_work_id: bmiData.data.bmi_work_id,
        iswc: bmiData.data.iswc,
        status: 'enriched'
      });
    } catch (error: any) {
      results.push({
        work_mbid: work.work_mbid,
        status: 'error',
        error: error.message
      });
    }
  }

  return c.json({
    enriched,
    total: unenrichedWorks.length,
    results
  });
});

/**
 * POST /enrich-bmi-by-iswc
 * Verify/enrich existing ISWCs with BMI publisher data
 *
 * Use case: ISWC known (from Quansic), validate publishers
 * Query: SELECT ISWCs from Quansic not yet in bmi_works
 */
bmi.post('/enrich-bmi-by-iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  // Find ISWCs from Quansic that haven't been verified with BMI
  const iswcsToVerify = await db.sql`
    SELECT qw.iswc, qw.title
    FROM quansic_works qw
    LEFT JOIN bmi_works bw ON qw.iswc = bw.iswc
    WHERE qw.iswc IS NOT NULL
      AND bw.bmi_work_id IS NULL
    LIMIT ${limit}
  `;

  let enriched = 0;
  const results = [];

  for (const work of iswcsToVerify) {
    try {
      // Call BMI service with ISWC
      const response = await fetch(`${c.env.BMI_SERVICE_URL}/search/iswc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iswc: work.iswc })
      });

      if (!response.ok) {
        results.push({ iswc: work.iswc, status: 'not_in_bmi' });
        continue;
      }

      const bmiData = await response.json();

      // Store BMI data
      await db.sql`
        INSERT INTO bmi_works (
          bmi_work_id, iswc, ascap_work_id, title,
          writers, publishers, performers, shares,
          status, status_description, raw_data
        ) VALUES (
          ${bmiData.data.bmi_work_id},
          ${bmiData.data.iswc},
          ${bmiData.data.ascap_work_id},
          ${bmiData.data.title},
          ${JSON.stringify(bmiData.data.writers)},
          ${JSON.stringify(bmiData.data.publishers)},
          ${JSON.stringify(bmiData.data.performers)},
          ${JSON.stringify(bmiData.data.shares)},
          ${bmiData.data.status},
          ${bmiData.data.status_description},
          ${JSON.stringify(bmiData.data)}
        )
        ON CONFLICT (bmi_work_id) DO UPDATE SET
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;

      enriched++;
      results.push({
        iswc: work.iswc,
        bmi_work_id: bmiData.data.bmi_work_id,
        status: 'verified',
        reconciled: bmiData.data.status === 'RECONCILED'
      });
    } catch (error: any) {
      results.push({
        iswc: work.iswc,
        status: 'error',
        error: error.message
      });
    }
  }

  return c.json({
    enriched,
    total: iswcsToVerify.length,
    results
  });
});

/**
 * GET /bmi/works/:bmi_work_id
 * Retrieve BMI work data by work ID
 */
bmi.get('/bmi/works/:bmi_work_id', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const bmiWorkId = c.req.param('bmi_work_id');

  const result = await db.sql`
    SELECT * FROM bmi_works
    WHERE bmi_work_id = ${bmiWorkId}
  `;

  if (result.length === 0) {
    return c.json({ error: 'BMI work not found' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /bmi/works/iswc/:iswc
 * Retrieve BMI work data by ISWC
 */
bmi.get('/bmi/works/iswc/:iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const iswc = c.req.param('iswc');

  const result = await db.sql`
    SELECT * FROM bmi_works
    WHERE iswc = ${iswc}
  `;

  if (result.length === 0) {
    return c.json({ error: 'ISWC not found in BMI database' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /bmi/compare-publishers?iswc=:iswc
 * Compare publisher data between BMI and MLC
 */
bmi.get('/bmi/compare-publishers', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const iswc = c.req.query('iswc');

  if (!iswc) {
    return c.json({ error: 'iswc query parameter required' }, 400);
  }

  const result = await db.sql`
    SELECT
      bw.bmi_work_id,
      bw.title as bmi_title,
      bw.publishers as bmi_publishers,
      bw.shares as bmi_shares,
      bw.status as bmi_status,
      mw.mlc_song_code,
      mw.title as mlc_title,
      mw.publishers as mlc_publishers,
      mw.total_publisher_share as mlc_share
    FROM bmi_works bw
    FULL OUTER JOIN mlc_works mw ON bw.iswc = mw.iswc
    WHERE bw.iswc = ${iswc} OR mw.iswc = ${iswc}
  `;

  if (result.length === 0) {
    return c.json({ error: 'ISWC not found in BMI or MLC' }, 404);
  }

  return c.json({
    iswc,
    comparison: result[0],
    has_bmi_data: !!result[0].bmi_work_id,
    has_mlc_data: !!result[0].mlc_song_code,
    reconciled: result[0].bmi_status === 'RECONCILED'
  });
});

export default bmi;
```

---

## Integration Points

### 1. Mount Route in Main Worker

**File:** `cloudflare-worker-scraper/src/index.ts`

```typescript
import bmi from './routes/bmi';

app.route('/', bmi);
```

Update API info endpoint:
```typescript
'POST /enrich-bmi-by-title': 'Discover ISWCs via BMI (title + performer search)',
'POST /enrich-bmi-by-iswc': 'Verify ISWCs with BMI publisher data',
'GET /bmi/works/:bmi_work_id': 'Get BMI work by work ID',
'GET /bmi/works/iswc/:iswc': 'Get BMI work by ISWC',
'GET /bmi/compare-publishers?iswc=:iswc': 'Compare BMI vs MLC publisher data',
```

### 2. Environment Variables

**File:** `cloudflare-worker-scraper/wrangler.toml`

```toml
[vars]
BMI_SERVICE_URL = "http://your-akash-endpoint.com:80"  # Set to Akash deployment URL
```

### 3. Pipeline Integration

**Enrichment Cascade:**

```
1. Spotify Track → spotify_tracks
2. MusicBrainz Recording → musicbrainz_recordings
3. MusicBrainz Work → musicbrainz_works (may have ISWC)
4. BMI Title Search → bmi_works (discover ISWC if missing)
5. Quansic Work → quansic_works (enrich with composer data)
6. BMI ISWC Verify → bmi_works (validate publishers)
7. MLC ISWC Lookup → mlc_works (licensing data)
```

---

## Use Cases

### Use Case 1: ISWC Discovery

**Problem:** MusicBrainz doesn't have ISWC for a work
**Solution:** Search BMI by title + performer

```bash
# Cloudflare Worker automatically finds unenriched works
POST /enrich-bmi-by-title?limit=10

# Response:
{
  "enriched": 8,
  "total": 10,
  "results": [
    {
      "work_mbid": "abc123",
      "bmi_work_id": "67023628",
      "iswc": "T3247460062",
      "status": "enriched"
    }
  ]
}
```

### Use Case 2: Publisher Verification

**Problem:** Need to validate Quansic ISWC and get publisher data
**Solution:** Direct ISWC lookup in BMI

```bash
# Verify ISWCs from Quansic
POST /enrich-bmi-by-iswc?limit=10

# Compare with MLC data
GET /bmi/compare-publishers?iswc=T3247460062

# Response:
{
  "iswc": "T3247460062",
  "has_bmi_data": true,
  "has_mlc_data": true,
  "reconciled": true,
  "comparison": {
    "bmi_publishers": [...],
    "bmi_shares": {"BMI": "50.01%", "ASCAP": "50%"},
    "mlc_publishers": [...],
    "mlc_share": 98.5
  }
}
```

### Use Case 3: Cross-PRO Reconciliation

**Problem:** Validate that BMI + ASCAP + MLC data matches
**Solution:** Compare status and shares

```sql
-- Find works with conflicting publisher data
SELECT
  bw.iswc,
  bw.bmi_work_id,
  bw.status as bmi_status,
  bw.shares as bmi_shares,
  mw.mlc_song_code,
  mw.total_publisher_share as mlc_share,
  mw.publishers as mlc_publishers
FROM bmi_works bw
JOIN mlc_works mw ON bw.iswc = mw.iswc
WHERE bw.status = 'RECONCILED'
  AND mw.total_publisher_share >= 98
  AND jsonb_array_length(bw.publishers) != jsonb_array_length(mw.publishers);
```

---

## Deployment Checklist

- [ ] Create `bmi_works` table in Neon PostgreSQL
- [ ] Deploy `bmi-service` to Akash (Docker image ready)
- [ ] Add `routes/bmi.ts` to cloudflare-worker-scraper
- [ ] Set `BMI_SERVICE_URL` in wrangler.toml
- [ ] Test enrichment endpoints
- [ ] Run initial ISWC discovery batch
- [ ] Monitor for publisher conflicts

---

## Monitoring Queries

### Check Enrichment Coverage

```sql
-- How many works have BMI data?
SELECT
  COUNT(*) FILTER (WHERE bw.bmi_work_id IS NOT NULL) as with_bmi,
  COUNT(*) FILTER (WHERE bw.bmi_work_id IS NULL) as without_bmi,
  COUNT(*) as total
FROM musicbrainz_works mw
LEFT JOIN bmi_works bw ON mw.iswc = bw.iswc;
```

### Find High-Confidence Works

```sql
-- Works with RECONCILED status and ≥98% MLC share
SELECT
  bw.iswc,
  bw.title,
  bw.status,
  mw.total_publisher_share
FROM bmi_works bw
JOIN mlc_works mw ON bw.iswc = mw.iswc
WHERE bw.status = 'RECONCILED'
  AND mw.total_publisher_share >= 98
ORDER BY mw.total_publisher_share DESC;
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Data Sources                               │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│   Spotify    │  MusicBrainz │   Quansic    │      BMI        │
│   (ISRC)     │  (ISWC?)     │   (ISWC)     │  (ISWC+Pubs)    │
└──────────────┴──────────────┴──────────────┴─────────────────┘
       ↓              ↓              ↓               ↓
┌──────────────────────────────────────────────────────────────┐
│            Cloudflare Worker (Hono Routes)                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  /enrich-bmi-by-title  →  Discover ISWCs               │ │
│  │  /enrich-bmi-by-iswc   →  Verify publishers            │ │
│  │  /bmi/compare-publishers → Cross-PRO validation        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
       ↓              ↓              ↓               ↓
┌──────────────────────────────────────────────────────────────┐
│                 Neon PostgreSQL                               │
│  ┌──────────────┬──────────────┬──────────────┬───────────┐  │
│  │spotify_tracks│musicbrainz   │quansic_works │bmi_works  │  │
│  │              │   _works     │              │           │  │
│  └──────────────┴──────────────┴──────────────┴───────────┘  │
└──────────────────────────────────────────────────────────────┘
                              ↓
                    ┌──────────────────┐
                    │   BMI Service    │
                    │  (Akash/Docker)  │
                    │  Playwright      │
                    └──────────────────┘
```

---

## Summary

**What This Adds:**
- ISWC discovery for works missing ISWCs
- Publisher/writer verification from BMI
- Cross-PRO reconciliation (BMI ↔ MLC ↔ ASCAP)
- Writer IPI numbers for copyright compliance

**Why It's Valuable:**
- Fills ISWC gaps in MusicBrainz data
- Validates licensing data for Story Protocol
- Provides multiple sources for publisher verification
- Enables cross-PRO conflict detection
