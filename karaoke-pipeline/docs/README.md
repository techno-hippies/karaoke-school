# Karaoke Pipeline Documentation

**12-step content processing from TikTok to blockchain**

## 🚀 Quick Start

```bash
cd karaoke-pipeline
bun install
./supervisor.sh
```

**Access**: http://localhost:8787

## 📁 Pipeline Structure

```
src/processors/
├── 11-upload-grove-videos.ts      # Upload to Grove/IPFS
├── 12-emit-segment-events.ts      # Emit blockchain events
├── 13-mint-story-derivatives.ts   # Story Protocol IP Assets
└── orchestestrator.ts             # Master coordinator

schema/migrations/
├── 052-add-story-protocol-lens-tracking.sql
├── 054-create-karaoke-lines-table.sql
└── 056-add-structured-segments.sql
```

## 🔄 12-Step Processing Flow

```
1. TikTok Scraping     → 8,196 videos
2. Spotify Resolution  → Track metadata
3. ISWC Discovery      → Industry codes
4. Artist Matching     → GRC-20 entities
5. Audio Download      → Original tracks
6. Demucs Separation   → Vocals + Instrumental
7. fal.ai Enhancement  → High-quality audio
8. Full-Song Segments  → 0-190s (simplified!)
9. ElevenLabs Timing   → Word-level alignment
10. Gemini Translation → Multi-language
11. Grove Upload       → IPFS storage
12. Event Emission     → Blockchain events
```

**Note**: Step 8 was simplified from AI-selected "optimal segments" to full-song segments (0-190s max). This eliminates broken line breaks and provides better learning context.

## 🏗️ Line-Level FSRS Database

### karaoke_lines Table
**Purpose**: Store individual lyric lines for progressive learning

```sql
CREATE TABLE karaoke_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_index INTEGER NOT NULL,
  spotify_track_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_texts JSONB,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  segment_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_track_line_index UNIQUE (spotify_track_id, line_index)
);
```

### Key Statistics
- **Total Lines**: 2,766 across 53 tracks
- **Average per Track**: ~52 lines
- **With Segments**: 1,511 lines (54.6%)
- **UUID Stable IDs**: Enable consistent referencing

## 🎯 Core Processors

### Upload to Grove (Step 11)
```typescript
// Upload processed segments to IPFS
async function uploadToGrove(segment: ProcessedSegment) {
  const metadata = {
    segmentHash: generateHash(segment.spotify_track_id),
    grc20WorkId: segment.grc20_work_id,
    spotifyTrackId: segment.spotify_track_id,
    timing: {
      fal_segment_start_ms: segment.fal_segment_start_ms,
      fal_segment_end_ms: segment.fal_segment_end_ms,
      duration_ms: segment.fal_segment_duration_ms
    },
    assets: {
      instrumental: segment.fal_segment_grove_url,
      alignment: segment.alignment_data,
      translations: segment.translations
    }
  };
  
  const cid = await grove.upload(JSON.stringify(metadata));
  return `grove://${cid}`;
}
```

### Emit Segment Events (Step 12)
```typescript
// Emit blockchain events for The Graph indexing
async function emitSegmentEvents(segments: Segment[]) {
  for (const segment of segments) {
    // 1. Register segment
    await segmentEvents.emitSegmentRegistered(
      segment.segmentHash,
      segment.grc20WorkId,
      segment.spotifyTrackId,
      segment.metadataUri
    );
    
    // 2. Process with assets
    await segmentEvents.emitSegmentProcessed(
      segment.segmentHash,
      segment.instrumentalUri,
      segment.alignmentUri,
      segment.translationCount,
      segment.metadataUri
    );
    
    // 3. Emit translations
    for (const translation of segment.translations) {
      await translationEvents.emitTranslationAdded(
        segment.segmentHash,
        translation.languageCode,
        translation.translationUri,
        "gemini-flash-2.5",
        translation.confidenceScore
      );
    }
  }
}
```

### Line-Level FSRS Emission
```typescript
// Emit line-specific events for FSRS
async function emitLineEvents(lines: KaraokeLine[]) {
  for (const line of lines) {
    await lineEvents.emitLineRegistered(
      line.line_id,              // UUID
      line.segment_hash,         // Links to segment
      line.line_index,           // Position within segment
      line.spotify_track_id,
      line.original_text,
      line.start_ms,
      line.end_ms,
      line.metadataUri
    );
  }
}
```

## 🔗 GRC-20 Integration

### Mint Artists/Works
```typescript
// Import to GRC-20 public metadata layer
async function mintToGRC20() {
  // 1. Mint artists (52/52 complete)
  const artistResults = await mintArtists();
  
  // 2. Mint works (36/39 complete)
  const workResults = await mintWorks();
  
  // 3. Mint recordings (39/39 complete) 
  const recordingResults = await mintRecordings();
  
  return {
    artists: artistResults.length,
    works: workResults.length,
    recordings: recordingResults.length
  };
}
```

### Track Mints in Database
```sql
-- Store minting results for tracking
CREATE TABLE grc20_artist_mints (
  spotify_artist_id TEXT PRIMARY KEY,
  grc20_entity_id UUID,
  minted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE grc20_work_mints (
  iswc TEXT PRIMARY KEY,
  grc20_entity_id UUID,
  minted_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📊 TikTok Data Processing

### Creator PKP Creation
```typescript
// Create PKPs for 51 TikTok creators
async function createCreatorPKPs() {
  const creators = await getTikTokCreators();
  
  for (const creator of creators) {
    // 1. Create PKP via Lit Protocol
    const pkp = await lit.createPKP();
    
    // 2. Create Lens account
    const lensAccount = await lens.createAccount(pkp.publicKey);
    
    // 3. Store in database
    await storeCreatorAccounts(creator, pkp, lensAccount);
  }
}
```

### Story Protocol IP Assets
```typescript
// Register 5,653 copyrighted TikTok videos
async function mintStoryIPAssets() {
  const videos = await getCopyrightedVideos();
  
  for (const video of videos) {
    // 1. Register as IP Asset
    const ipAsset = await story.register({
      nftContract: TIKTOK_VIDEO_NFT,
      tokenId: video.video_id,
      ipMetadata: {
        ipType: 'derivative',
        attributes: [
          { key: 'grc20_work_id', value: video.grc20_work_id },
          { key: 'creator_pkp', value: video.creator_pkp },
          { key: 'video_uri', value: video.grove_uri }
        ]
      }
    });
    
    // 2. Set revenue split (82% original, 18% creator)
    await story.setRevenueSplit(ipAsset.id, 82, 18);
    
    // 3. Emit event
    await tiktokEvents.emitVideoMinted(
      video.video_id,
      video.segment_hash,
      video.grc20_work_id,
      video.creator_handle,
      video.creator_pkp,
      video.lens_account,
      "copyrighted",
      ipAsset.id,
      18,
      video.grove_uri
    );
  }
}
```

## 🛠️ API Endpoints

### Health Check
```bash
GET /health
# Response: {"status": "ok", "pipeline": "running"}
```

### Trigger Processing
```bash
POST /trigger?step=12&limit=5
# Body: {"spotify_track_ids": ["..."]}
# Response: {"started": true, "job_id": "..."}
```

### Pipeline Status
```bash
GET /status
# Response: {
#   "database": "connected",
#   "grove": "operational", 
#   "contracts": "deployed",
#   "grc20": "92.3% complete"
# }
```

## 🔧 Environment Configuration

```bash
# Database
NEON_DATABASE_URL=postgresql://...
NEON_PROJECT_ID=frosty-smoke-70266868

# Grove Storage
GROVE_API_KEY=...
GROVE_CHAIN_ID=...

# Blockchain
RPC_URL=https://rpc.testnet.lens.xyz
PRIVATE_KEY=0x...

# GRC-20
GEO_SPACE_ID=78e6adba-6d19-49e8-8b12-9d1e72ecfd25
```

## 🧪 Testing

### Unit Tests
```bash
bun test
```

### Integration Tests
```bash
# Test complete pipeline flow
bun test integration/pipeline-flow.ts

# Test line-level FSRS
bun test integration/line-fsrs.ts

# Test GRC-20 integration
bun test integration/grc20-minting.ts
```

### Manual Testing
```bash
# Process single segment
curl -X POST 'http://localhost:8787/trigger?step=12&limit=1' \
  -H 'Content-Type: application/json' \
  -d '{"spotify_track_ids": ["43bCmCI0nSgcT7QdMXY6LV"]}'

# Check database
psql $NEON_DATABASE_URL -c "
  SELECT COUNT(*) FROM karaoke_lines WHERE segment_hash IS NOT NULL;
"
```

## 📊 Monitoring

### Database Queries
```sql
-- Line-level FSRS status
SELECT 
  COUNT(*) as total_lines,
  COUNT(*) FILTER (WHERE segment_hash IS NOT NULL) as with_segments,
  COUNT(*) FILTER (WHERE segment_hash IS NULL) as without_segments
FROM karaoke_lines;

-- Recent segment processing
SELECT 
  spotify_track_id,
  created_at,
  CASE WHEN segment_hash IS NOT NULL THEN 'processed' ELSE 'pending' END as status
FROM karaoke_lines 
ORDER BY created_at DESC 
LIMIT 10;
```

### Grove Upload Status
```sql
-- Check grove upload progress
SELECT 
  ks.spotify_track_id,
  ks.fal_segment_grove_url IS NOT NULL as has_grove_url,
  COUNT(kl.line_id) as line_count
FROM karaoke_segments ks
LEFT JOIN karaoke_lines kl ON ks.spotify_track_id = kl.spotify_track_id
GROUP BY ks.spotify_track_id, ks.fal_segment_grove_url
ORDER BY ks.spotify_track_id;
```

## 🚀 Deployment

### Production Pipeline
```bash
# Deploy to cloud
vercel deploy

# Or use Docker
docker build -t karaoke-pipeline .
docker run -p 8787:8787 karaoke-pipeline
```

### Environment Variables
```bash
# Production
NODE_ENV=production
DATABASE_URL=$NEON_DATABASE_URL
GROVE_API_KEY=$PROD_GROVE_KEY
RPC_URL=$PROD_RPC_URL
```

## 📚 Additional Documentation

- **[AGENTS.md](../../AGENTS.md)** - Service integration guide
- **[README.md](../../README.md)** - Project overview
