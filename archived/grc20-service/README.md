# GRC-20 Integration for Karaoke School

**Blockchain-native music knowledge graph powered by The Graph GRC-20.**

---

## Overview

This integration replaces traditional smart contract storage with GRC-20's knowledge graph standard, reducing gas costs by **99%+** while maintaining decentralization and immutability.

### Architecture

```
Neon DB (Postgres)
  ↓ Validation & Enrichment
GRC-20 Knowledge Graph (IPFS + The Graph)
  ↓ GraphQL API
App Frontend (React + Lens SDK)
```

### Key Benefits

| Traditional Contracts | GRC-20 |
|----------------------|--------|
| 28k gas per song | 10k gas per 50 songs |
| Fixed schema | Flexible graph |
| 1000 songs = $500 | 1000 songs = $5 |
| Hard to extend | Easy to add relations |

---

## Data Model

### Entity Types

1. **Musical Work** (composition/song as written)
   - Properties: title, duration, ISWC (optional), Spotify ID
   - Relations: performed by Artist, has Recording

2. **Audio Recording** (specific recorded version)
   - Properties: ISRC, MusicBrainz recording MBID
   - Relations: recording of Work

3. **Karaoke Segment** (processed clip for practice)
   - Properties: start/end time, instrumental URI, alignment URI
   - Relations: segment of Recording

4. **Musical Artist** (performer/composer)
   - Properties: name, ISNI (optional), Lens account
   - Relations: performed Work

5. **Performance** (user karaoke attempt)
   - Properties: score, Lens post URI
   - Relations: performance of Segment, performed by Artist

### Identifier Strategy

- **Primary Key**: GRC-20 entity ID (blockchain-native)
- **Foreign Keys**: ISWC, ISRC, ISNI, MusicBrainz IDs (optional metadata)
- **Lookup Key**: Spotify Track ID (most common query)

---

## Setup

### 1. Install Dependencies

```bash
cd grc20-integration
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env

# Add encrypted secrets with dotenvx
dotenvx set PRIVATE_KEY "0x..." -f .env
dotenvx set DATABASE_URL "postgresql://..." -f .env

# Or edit .env manually and encrypt it:
# - PRIVATE_KEY: Wallet private key
# - DATABASE_URL: Neon connection string
# - GRC20_NETWORK: TESTNET or MAINNET

# IMPORTANT: Ensure DOTENV_PRIVATE_KEY is set in your environment
# (should be configured in .claude/settings.local.json)
```

### 3. Create GRC-20 Space

```bash
# All scripts use dotenvx for secure environment handling
bun run setup
```

This creates a new GRC-20 space called "Songverse" and saves the space ID to `.env`.

**Note**: Scripts automatically use `dotenvx run -f .env` - never pass secrets inline.

### 4. Define Music Types

```bash
bun run define-types
```

Creates all entity types (Work, Recording, Segment, Artist, Performance) and their properties. Saves type IDs to `type-ids.json`.

**Gas Cost**: ~10k gas (one-time)

### 5. Import Musical Works

```bash
bun run import-works
```

Reads validated tracks from Neon DB and creates GRC-20 entities. Batches 50 entities per transaction.

**Gas Cost per batch**: ~10k gas
**Example**: 1000 songs = 20 batches × 10k gas = ~$5-10

### 6. Import Karaoke Segments

```bash
bun run import-segments
```

Creates segment entities linked to parent works. Includes Grove URIs for instrumental and alignment data.

**Gas Cost**: Same as works (~10k per 50 segments)

---

## Querying Data

### From Frontend (TypeScript)

```typescript
import { createClient, getPropertyValue } from '@karaoke-school/grc20-integration/queries';

const client = createClient();

// Get work by Spotify ID
const work = await client.getWorkBySpotifyId('043dDJ9u0PQ3ooAXMgcwOe');
console.log(work.name); // "TEXAS HOLD 'EM"

// Get ISWC (optional field)
const iswc = getPropertyValue(work, 'ISWC');
console.log(iswc); // "T-123.456.789-0" or null

// Get segments for karaoke practice
const segments = await client.getSegmentsByWork(work.id);
for (const segment of segments) {
  const instrumentalUri = getPropertyValue(segment, 'Instrumental Audio URI');
  const alignmentUri = getPropertyValue(segment, 'Word Alignment URI');

  // Play karaoke segment with word-level timing
  playKaraoke(instrumentalUri, alignmentUri);
}
```

### GraphQL Queries

```graphql
# Get work by Spotify ID
query GetWork($spotifyId: String!) {
  entities(
    where: {
      properties_some: {
        property_: { name: "Spotify ID" }
        value: $spotifyId
      }
    }
  ) {
    id
    name
    properties {
      property { name }
      value
    }
    relations {
      property { name }
      target { id, name }
    }
  }
}

# Get segments for a work
query GetSegments($workId: ID!) {
  entity(id: $workId) {
    relations(where: { property_: { name: "Has Segment" } }) {
      target {
        id
        name
        properties {
          property { name }
          value
        }
      }
    }
  }
}
```

---

## Data Flow

### Full Pipeline: TikTok → Neon → GRC-20 → App

```
1. TikTok Video
   ↓ Download (freyr-service)

2. Audio Processing
   ↓ Demucs separation (vocals + instrumental)
   ↓ Gemini segmentation (find ~190s karaoke-worthy clip)
   ↓ fal.ai enhancement (190s high-quality instrumental)
   ↓ FFmpeg cropping (50s TikTok clip)
   ↓ Grove upload (get CIDs)
   ↓ ElevenLabs alignment (word-level timing)

3. Neon DB Validation
   ↓ Check MusicBrainz for ISRC/ISWC/ISNI
   ↓ Verify Grove URLs accessible
   ↓ Mark as ready for minting

4. GRC-20 Minting (this integration)
   ↓ Batch 50 entities per edit
   ↓ Post IPFS CID on-chain (~10k gas)
   ↓ The Graph indexes entities

5. App Frontend
   ↓ Query via GraphQL
   ↓ Fetch Grove assets
   ↓ Display karaoke UI with word timing
   ↓ Record user performance

6. Performance Grading
   ↓ Submit to Lit Action (off-chain compute)
   ↓ Grade pronunciation/timing
   ↓ Post score on-chain (PerformanceGrader contract)
   ↓ Create Performance entity in GRC-20
```

---

## Integration with Existing Systems

### With Master-Pipeline (PKP/Lens Accounts)

```typescript
// After creating PKP + Lens account (master-pipeline/lib/pkp.ts)
import { Graph, Ipfs } from '@graphprotocol/grc-20';

// Create artist entity in GRC-20
const { id: artistId, ops } = Graph.createEntity({
  name: artistName,
  types: [types.musicalArtist],
  values: [
    { property: properties.lensAccount, value: lensAccountAddress },
    { property: properties.pkpAddress, value: pkpAddress },
    { property: properties.isni, value: isni || '' },
    { property: properties.mbid, value: artistMbid || '' },
  ],
});

// Link works to artist
const { ops: linkOps } = Graph.updateEntity(workId, {
  relations: {
    [properties.performedBy]: {
      toEntity: artistId,
    },
  },
});

// Publish to IPFS + on-chain
await publishEdit([...ops, ...linkOps], 'Create artist + link works');
```

### With Performance Grader (Lit Actions)

```typescript
// After Lit Action grades performance
import { Graph } from '@graphprotocol/grc-20';

// Create performance entity
const { ops } = Graph.createEntity({
  name: `Performance by ${username}`,
  types: [types.performance],
  values: [
    { property: properties.performanceScore, value: Graph.serializeNumber(score) },
    { property: properties.lensPostUri, value: lensPostId },
  ],
  relations: {
    [properties.hasPerformance]: { toEntity: segmentId },
    [properties.performedBy]: { toEntity: userAccountId },
  },
});

await publishEdit(ops, 'Record performance');
```

### With Sponsorship API (Wallet Scoring)

Query user's performance history via GRC-20:

```typescript
// Get user's performances
const user = await client.getEntityById(userAccountId);
const performances = getRelatedEntities(user, 'Has Performance');

// Calculate stats for sponsorship eligibility
const totalPerformances = performances.length;
const avgScore = performances.reduce((sum, p) => {
  return sum + parseInt(getPropertyValue(p, 'Performance Score') || '0');
}, 0) / totalPerformances;

// Sponsor if avgScore > 7000 (70%)
if (avgScore > 7000) {
  sponsorUser(userAddress);
}
```

---

## Comparison: Old vs New Architecture

### Old: Contract-Based

```solidity
// SongEvents.sol
event SongRegistered(
  uint32 geniusId,  // ❌ Locked into Genius namespace
  string metadataUri,
  address registeredBy
);

// Cost: 28k gas per song
// Flexibility: Low (fixed schema)
// Queries: Via subgraph (custom schema)
```

### New: GRC-20

```typescript
// Musical Work entity
Graph.createEntity({
  name: 'TEXAS HOLD \'EM',
  types: ['Musical Work'],
  values: [
    { property: 'Spotify ID', value: '...' },
    { property: 'ISWC', value: '...' },  // ✅ Optional
    { property: 'MBID', value: '...' },  // ✅ Optional
  ],
});

// Cost: 10k gas per 50 songs (99% cheaper)
// Flexibility: High (add properties/relations anytime)
// Queries: Via The Graph (standardized GRC-20 schema)
```

---

## Gas Cost Breakdown

### 1,000 Songs + 1,000 Segments

| Operation | Old (Contracts) | New (GRC-20) | Savings |
|-----------|----------------|--------------|---------|
| Song registration | 1000 × 28k = 28M gas | 20 batches × 10k = 200k gas | **99.3%** |
| Segment registration | 1000 × 30k = 30M gas | 20 batches × 10k = 200k gas | **99.3%** |
| Total | 58M gas (~$580) | 400k gas (~$4) | **99.3%** |

### 10,000 Songs Catalog

| Old | New | Savings |
|-----|-----|---------|
| ~$5,800 | ~$40 | **99.3%** |

---

## Troubleshooting

### "Space not found"

Run `bun run setup` to create a space first.

### "Type IDs not found"

Run `bun run define-types` before importing data.

### "Entity map not found"

Run `bun run import-works` before `import-segments`.

### "Transaction failed"

Check wallet has testnet ETH:
- Lens Testnet: https://faucet.lens.dev
- Check balance: `bun run scripts/check-balance.ts`

### "IPFS upload failed"

Ensure Irys gateway is accessible. Check network:
```bash
curl -I https://gateway.irys.xyz
```

---

---

## Data Pipeline & Current Status

### Overview

Before minting to GRC-20, we run a **data corroboration pipeline** that merges artist data from multiple sources to create verified "golden records." This ensures blockchain data is high-quality and complete.

### Current Status (2025-10-28)

**Data Quality Metrics:**
- **Total Artists**: 235
- **Ready to Mint**: 133 (56.6%)
- **Avg Completeness**: 0.89 (89% of key fields filled)
- **Has MusicBrainz ID**: 135 (57.4%)
- **Has ISNI**: 117 (49.8%)
- **Has Spotify ID**: 224 (95.3%)
- **Has Images**: 235 (100%)
- **Has 2+ Social Links**: 183 (77.9%)

**What's Been Completed:**
1. ✅ Base tables populated from Cloudflare Worker scrapers (Genius, Spotify)
2. ✅ Bulk MusicBrainz enrichment (666 artists processed, 92% success rate)
3. ✅ Corroboration schema with consensus tracking
4. ✅ ETL pipeline merging all sources into `grc20_artists`
5. ✅ Quality gates and ready-to-mint flags

**Next Steps:**
1. Test mint 5-10 ready artists to testnet
2. Validate GRC-20 entity structure
3. Scale to full catalog (133 ready artists)

### Data Architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ genius_artists  │  │spotify_artists  │  │musicbrainz_     │
│  (233 artists)  │  │  (692 artists)  │  │    artists      │
│                 │  │                 │  │  (666 artists)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   CORROBORATION ETL   │
                    │  (SQL-based merge)    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   grc20_artists      │
                    │  (235 golden records)│
                    │  (133 ready to mint) │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   GRC-20 Blockchain  │
                    │  (not yet minted)    │
                    └──────────────────────┘
```

### Resolution Rules

When multiple sources have the same data, we apply these priority rules:

1. **Names**: MusicBrainz canonical > Genius name
2. **External IDs**: Prefer non-null, track consensus
3. **Social Media**: MusicBrainz handles > Genius handles
4. **Images**: Fal generated > Spotify > Genius (any image acceptable)
5. **Biography**: MusicBrainz is authoritative
6. **Genres/Popularity**: Spotify only

### Database Schemas

#### Source Tables

##### `genius_artists`
Primary source with highest coverage (233 artists).

```sql
CREATE TABLE genius_artists (
    genius_artist_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,                    -- e.g., "https://genius.com/artists/Tame-impala"
    image_url TEXT,
    header_image_url TEXT,
    alternate_names TEXT[],
    instagram_name TEXT,
    twitter_name TEXT,
    facebook_name TEXT,
    description JSONB,
    fetched_at TIMESTAMP DEFAULT NOW()
);
```

##### `spotify_artists`
Streaming platform data (692 artists).

```sql
CREATE TABLE spotify_artists (
    spotify_artist_id TEXT PRIMARY KEY,   -- e.g., "5INjqkS1o8h1imAzPqGZBb"
    name TEXT NOT NULL,
    genres TEXT[],                        -- e.g., ["neo-psychedelic", "modern rock"]
    popularity INTEGER,                   -- 0-100 score
    followers INTEGER,
    images JSONB,                         -- Array: [{url, height, width}, ...]
    external_urls JSONB,
    fetched_at TIMESTAMP DEFAULT NOW()
);
```

##### `musicbrainz_artists`
Authoritative music metadata (666 enriched via bulk script).

```sql
CREATE TABLE musicbrainz_artists (
    mbid TEXT PRIMARY KEY,                -- e.g., "63aa26c3-d59b-4da4-84ac-716b54f1ef4d"
    name TEXT NOT NULL,
    sort_name TEXT,
    type TEXT,                            -- 'person' | 'group' | 'orchestra'
    disambiguation TEXT,                  -- e.g., "Australian psychedelic rock band"
    country CHAR(2),                      -- ISO code: "AU"
    gender TEXT,
    birth_date DATE,
    death_date DATE,

    -- Industry identifiers
    isnis TEXT[],                         -- International Standard Name Identifier (array)
    ipi TEXT,                             -- Interested Party Information

    -- Links to other tables
    spotify_artist_id TEXT REFERENCES spotify_artists(spotify_artist_id),
    wikidata_id TEXT,                     -- e.g., "Q683544"
    discogs_id TEXT,
    genius_slug TEXT,                     -- e.g., "Tame-impala"

    -- Social media handles (extracted from URL relations)
    instagram_handle TEXT,
    twitter_handle TEXT,
    facebook_handle TEXT,
    youtube_channel TEXT,
    soundcloud_handle TEXT,
    tiktok_handle TEXT,

    raw_data JSONB NOT NULL,              -- Full MusicBrainz API response
    fetched_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Note**: MusicBrainz enrichment is done via `scripts/enrich-musicbrainz.ts` which:
1. Queries `spotify_artists` LEFT JOIN `musicbrainz_artists` to find missing records
2. Searches MusicBrainz API by name (1 req/sec rate limit)
3. Extracts social handles from URL relations in the API response
4. Links via `spotify_artist_id` for later corroboration

##### `artist_images`
Fal AI-generated artist images stored on Grove/Irys.

```sql
CREATE TABLE artist_images (
    id SERIAL PRIMARY KEY,
    spotify_artist_id TEXT REFERENCES spotify_artists(spotify_artist_id),
    generated_image_url TEXT,             -- Grove CID URL
    status TEXT,                          -- 'completed' | 'pending' | 'failed'
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Corroboration Tables

##### `grc20_artists`
**The main output table** - consensus-based golden records ready for GRC-20 minting.

```sql
CREATE TABLE grc20_artists (
    id SERIAL PRIMARY KEY,

    -- ===== CORE FIELDS =====
    name TEXT NOT NULL,                   -- Prefer MusicBrainz > Genius
    alternate_names TEXT[],               -- Combined from all sources
    sort_name TEXT,                       -- From MusicBrainz

    -- ===== EXTERNAL IDS =====
    genius_artist_id INTEGER UNIQUE,
    mbid TEXT,
    spotify_artist_id TEXT,
    wikidata_id TEXT,
    discogs_id TEXT,
    isni TEXT,                            -- International Standard Name Identifier
    ipi TEXT,                             -- Interested Party Information

    -- ===== SOCIAL MEDIA =====
    instagram_handle TEXT,                -- Prefer MusicBrainz > Genius
    tiktok_handle TEXT,
    twitter_handle TEXT,
    facebook_handle TEXT,
    youtube_channel TEXT,
    soundcloud_handle TEXT,

    -- ===== URLS =====
    spotify_url TEXT,                     -- Constructed from spotify_artist_id
    genius_url TEXT,                      -- From genius_artists

    -- ===== IMAGES =====
    image_url TEXT,                       -- Prefer Fal > Spotify > Genius
    image_source TEXT,                    -- 'fal' | 'spotify' | 'genius'
    header_image_url TEXT,

    -- ===== BIOGRAPHICAL =====
    artist_type TEXT,                     -- From MusicBrainz
    country CHAR(2),
    gender TEXT,
    birth_date DATE,
    death_date DATE,
    disambiguation TEXT,

    -- ===== GENRES/POPULARITY =====
    genres TEXT[],                        -- From Spotify
    spotify_followers INTEGER,
    spotify_popularity INTEGER,

    -- ===== PROVENANCE & CONSENSUS =====
    source_flags JSONB DEFAULT '{}',      -- {"genius": true, "musicbrainz": true, ...}
    field_consensus JSONB DEFAULT '{}',   -- Tracks which sources agree on each field

    -- ===== QUALITY METRICS =====
    completeness_score NUMERIC(3,2) DEFAULT 0.00,  -- 0.00 to 1.00
    consensus_score NUMERIC(3,2) DEFAULT 0.00,
    external_id_count INTEGER DEFAULT 0,
    social_link_count INTEGER DEFAULT 0,
    source_count INTEGER DEFAULT 0,

    -- ===== MINTING STATUS =====
    ready_to_mint BOOLEAN DEFAULT FALSE,
    mint_blocking_reasons TEXT[],         -- e.g., ["missing_isni", "low_completeness"]
    minted_at TIMESTAMP,
    grc20_entity_id UUID,                 -- Set after successful mint

    -- ===== TIMESTAMPS =====
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Quality Gate Rules** (from `sql/02-corroborate-artists.sql`):
```sql
ready_to_mint = (
    image_url IS NOT NULL AND           -- Any image source acceptable
    completeness_score >= 0.70 AND       -- At least 70% of key fields filled
    social_link_count >= 2 AND           -- At least 2 social media links
    external_id_count >= 3               -- At least 3 external IDs
);
```

**Completeness Score** (5 key requirements):
1. Name (always present)
2. Genius ID (always present)
3. Image URL (any source)
4. At least 2 social links
5. At least 3 external IDs

**JOIN Logic** (from `sql/02-corroborate-artists.sql`):
```sql
FROM genius_artists ga
LEFT JOIN musicbrainz_artists ma ON
    LOWER(ma.genius_slug) = LOWER(REGEXP_REPLACE(ga.url, 'https://genius.com/artists/', ''))
LEFT JOIN spotify_artists sa ON
    sa.spotify_artist_id = ma.spotify_artist_id
    OR (ma.spotify_artist_id IS NULL AND LOWER(sa.name) = LOWER(ga.name))
LEFT JOIN artist_images ai ON
    ai.spotify_artist_id = sa.spotify_artist_id AND ai.status = 'completed'
```

**Key Design Decision**: The primary JOIN is via `genius_slug`, with a fallback name-based JOIN for Spotify when MusicBrainz is missing. This ensures 95.3% Spotify coverage (224/235 artists).

##### `grc20_works`
Musical works table (schema created, not yet populated).

```sql
CREATE TABLE grc20_works (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,

    -- External IDs
    genius_song_id INTEGER UNIQUE,
    spotify_track_id TEXT,
    isrc TEXT,                            -- International Standard Recording Code
    iswc TEXT,                            -- International Standard Musical Work Code

    -- Relationships
    primary_artist_id INTEGER REFERENCES grc20_artists(id),

    -- Metadata
    language CHAR(2),
    release_date DATE,
    duration_ms INTEGER,

    -- Quality & Status
    completeness_score NUMERIC(3,2) DEFAULT 0.00,
    ready_to_mint BOOLEAN DEFAULT FALSE,
    minted_at TIMESTAMP,
    grc20_entity_id UUID,

    created_at TIMESTAMP DEFAULT NOW()
);
```

##### `grc20_corroboration_log`
Audit trail for data resolution decisions (schema created, not yet populated).

```sql
CREATE TABLE grc20_corroboration_log (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('artist', 'work')),
    entity_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    source TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    resolution_reason TEXT,
    consensus_count INTEGER,
    conflict_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Useful Views

#### `mintable_artists_summary`
Artists ready to mint with quality breakdown.

```sql
CREATE VIEW mintable_artists_summary AS
SELECT
    id, name, ready_to_mint,
    completeness_score, consensus_score,
    source_count, external_id_count, social_link_count,
    mint_blocking_reasons,
    CASE
        WHEN image_source = 'fal' THEN '✅ Fal (Grove)'
        WHEN image_source = 'spotify' THEN '✅ Spotify'
        WHEN image_source = 'genius' THEN '✅ Genius'
        ELSE '❌ No image'
    END as image_status
FROM grc20_artists
ORDER BY ready_to_mint DESC, consensus_score DESC;
```

#### `data_quality_dashboard`
High-level quality metrics.

```sql
CREATE VIEW data_quality_dashboard AS
SELECT
    'Artists' as entity_type,
    COUNT(*) as total_entities,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(consensus_score), 2) as avg_consensus,
    COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
    COUNT(*) FILTER (WHERE mbid IS NOT NULL) as has_mbid,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image
FROM grc20_artists;
```

### Scripts

#### `scripts/enrich-musicbrainz.ts`
Bulk MusicBrainz enrichment for artists missing MBID/ISNI/IPI.

**Usage:**
```bash
bun run enrich-mb [BATCH_SIZE]  # Default: 50 artists
```

**What it does:**
1. Queries `spotify_artists` LEFT JOIN `musicbrainz_artists` for missing records
2. Searches MusicBrainz API by artist name (1 req/sec rate limit)
3. Fetches full details including URL relations
4. Extracts social handles from URL relations
5. Inserts into `musicbrainz_artists` with `spotify_artist_id` link

**Success Rate:** ~92% (666 enriched out of 724 attempted)

**Example output:**
```
[1/50] Searching: Tame Impala
   → Match: Tame Impala (63aa26c3-d59b-4da4-84ac-716b54f1ef4d), score: 100
   ✅ Enriched: MBID=63aa26c3..., ISNI=0000000107600568, IPI=none

📊 Summary:
   ✅ Enriched: 46
   ⚠️  Not found: 4
   ❌ Failed: 0
   📈 Success rate: 92%
```

#### `scripts/run-corroboration.ts`
Executes ETL pipeline to merge all sources into `grc20_artists`.

**Usage:**
```bash
bun run corroborate
```

**What it does:**
1. Drops and recreates `grc20_artists` table
2. Runs `sql/01-create-corroboration-schema.sql` (creates schema)
3. Runs `sql/02-corroborate-artists.sql` (merges data + calculates quality scores)
4. Prints summary stats

**Example output:**
```
📊 Summary:
   Total Artists: 235
   Ready to Mint: 133
   Avg Completeness: 0.89
   Has MBID: 135
   Has ISNI: 117
```

#### `scripts/03-import-artists.ts`
**TODO**: Update to read from `grc20_artists WHERE ready_to_mint = TRUE` instead of live JOINs.

### Running the Pipeline

#### Fresh Start
```bash
# 1. Enrich MusicBrainz data (run until complete)
bun run enrich-mb 100

# 2. Run corroboration
bun run corroborate

# 3. Check results
psql $DATABASE_URL -c "SELECT * FROM data_quality_dashboard;"
```

#### Check Remaining Work
```bash
# Artists still needing MusicBrainz enrichment
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM spotify_artists sa
  LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
  WHERE ma.spotify_artist_id IS NULL;
"
```

### Known Issues

#### 11 Artists Missing Spotify IDs (95.3% coverage)
**Root Cause:** Name mismatches between Genius and Spotify

**Examples:**
- Language suffixes: "Crush (크러쉬)", "Jessi (제시)", "米津玄師 (Kenshi Yonezu)"
- Country codes: "Andromeda (BRA)", "Kim (FRA)"
- Unicode whitespace: "​vyrval", "​normal the kid" (invisible zero-width chars)
- Collaborations: "Wayne Jones & Amy Hayashi-Jones"

**Solution:** Implement better name normalization (strip parentheses/Unicode) or manual mapping table.

#### 63 Artists Not Found in MusicBrainz
**Root Cause:** MusicBrainz doesn't have records for:
- Obscure DJ/producer names (e.g., "DJ DCZ6", "BoominBeats")
- Non-English artists without romanized names
- Very new/emerging artists

**Impact:** These artists can still be minted without MBID/ISNI, but will have lower consensus scores.

#### MusicBrainz Only Has 185 Genius Slugs (39% coverage)
**Root Cause:** MusicBrainz URL relations rarely include Genius links.

**Solution:** PRIMARY JOIN via `genius_slug`, FALLBACK via `spotify_artist_id`, TERTIARY via name match. This is already implemented in the corroboration SQL.

---

## Roadmap

- [x] Artist data corroboration pipeline
- [x] MusicBrainz bulk enrichment
- [x] Quality gates and ready-to-mint flags
- [ ] Test mint 5-10 artists to GRC-20 testnet
- [ ] Artist entity import (133 ready artists)
- [ ] Performance entity creation (after Lit Action grading)
- [ ] Translation entities (line-level + word timing)
- [ ] Work entity import with ISRC/ISWC
- [ ] Batch MusicBrainz ID updates (as data improves)
- [ ] ISWC acquisition flow (for indie artists)
- [ ] Royalty distribution (ISRC → payment address)

---

## Resources

- **The Graph GRC-20**: https://github.com/graphprotocol/grc-20
- **Geo Genesis Browser**: https://www.geobrowser.io
- **GRC-20 Spec**: https://thegraph.com/blog/grc-20-knowledge-graph-standard
- **MusicBrainz API**: https://musicbrainz.org/doc/MusicBrainz_API

---

## Support

Questions? Open an issue or ask in The Graph Discord.

**Built with ❤️ for karaoke learners worldwide**
