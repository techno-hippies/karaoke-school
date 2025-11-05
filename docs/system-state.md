# Karaoke School v1 - Complete System Overview

**Last Updated**: 2025-11-03
**Status**: GRC-20 minting complete (92.3%), contracts deployed, subgraph needs update

---

## 🎯 Current System State

### ✅ Deployed & Operational
1. **Smart Contracts** (Lens Testnet - Chain ID: 37111)
   - PerformanceGrader: `0x788A245B9AAB4E29D0152424b72bcB8Ac7c1E260`
   - SongEvents: `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6`
   - SegmentEvents: `0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8`
   - AccountEvents: `0x3709f41cdc9E7852140bc23A21adCe600434d4E8`

2. **GRC-20 v2 (Songverse)**
   - Space ID: `78e6adba-6d19-49e8-8b12-9d1e72ecfd25`
   - Network: Geo Testnet
   - Artists minted: 52/52 (100%)
   - Works minted: 36/39 (92.3%)
   - Recordings minted: 39/39 (100%)
   - View at: https://testnet.geobrowser.io/space/78e6adba-6d19-49e8-8b12-9d1e72ecfd25

3. **Neon Database**
   - Project: `frosty-smoke-70266868` (KS1 - EU)
   - 36 fully processed karaoke segments
   - Word-level timing (ElevenLabs)
   - Multi-language translations (zh, vi, id)
   - 8,196 TikTok videos (5,653 copyrighted)

### ⏳ Needs Deployment/Update
1. **Subgraph** (local only, needs testnet deployment)
   - Schema: Updated with GRC-20 references
   - Mappings: Event handlers ready
   - Network: Set to `local` in subgraph.yaml (needs update to lens-testnet)
   - Current subgraph URL: `https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.1`

2. **TranslationEvents Contract**
   - Address in subgraph.yaml: `0x0000000000000000000000000000000000000000` (placeholder)
   - Needs deployment to Lens Testnet

3. **App Integration**
   - GraphQL client configured
   - Needs routing updates for new GRC-20 flow
   - Subgraph URL hardcoded (needs environment variable)

---

## 📊 Complete Data Flow

### 1. Content Creation → Database

```
TikTok Video Scraped
  ↓
Spotify Track Resolved (song_pipeline)
  ↓
ISWC Discovery (quansic, BMI, MLC)
  ↓
MusicBrainz Enrichment (grc20_artists, grc20_works)
  ↓
Wikidata Enrichment (images, metadata)
  ↓
Audio Processing
  ├─ Download (freyr-service)
  ├─ Separation (Demucs)
  ├─ Enhancement (fal.ai)
  └─ Segmentation (Gemini)
  ↓
Lyrics Processing
  ├─ Word timing (ElevenLabs)
  └─ Translations (Gemini: zh, vi, id)
  ↓
Grove Upload (karaoke_segments table)
  ├─ Instrumental MP3
  ├─ Alignment JSON
  └─ Translation JSONs
```

### 2. Database → GRC-20 (Public Metadata Layer)

```
Neon Database (grc20_artists, grc20_works, grc20_work_recordings)
  ↓
Mint to GRC-20 (scripts in grc20-v2/scripts/)
  ├─ 03-mint-artists.ts → 52 artists
  ├─ 04-mint-works.ts → 36 works (23 + 13 backfilled)
  └─ 05-mint-recordings.ts → 39 recordings
  ↓
GRC-20 Knowledge Graph
  ├─ Musical Artist entities (UUID)
  ├─ Musical Work entities (UUID)
  └─ Audio Recording entities (UUID)
  ↓
Tracked in Neon (separate minting tables)
  ├─ grc20_artist_mints (spotify_artist_id → grc20_entity_id)
  ├─ grc20_work_mints (iswc → grc20_entity_id)
  └─ grc20_recording_mints (spotify_track_id → grc20_entity_id)
```

### 3. Database → Smart Contracts (Event Emission)

**MISSING STEP - NEEDS IMPLEMENTATION**

```typescript
// Build metadata JSON from Neon DB
const segments = await query(`
  SELECT
    ks.*,
    gwm.grc20_entity_id as grc20_work_id,
    ewa.words as alignment_data,
    lt.lines as translation_data
  FROM karaoke_segments ks
  JOIN grc20_works gw ON gw.spotify_track_id = ks.spotify_track_id
  JOIN grc20_work_mints gwm ON gw.iswc = gwm.iswc
  LEFT JOIN elevenlabs_word_alignments ewa ON ks.spotify_track_id = ewa.spotify_track_id
  LEFT JOIN lyrics_translations lt ON ks.spotify_track_id = lt.spotify_track_id
  WHERE ks.fal_segment_grove_url IS NOT NULL
`);

for (const segment of segments) {
  // 1. Build Grove metadata JSON
  const metadata = {
    segmentHash: generateHash(segment.spotify_track_id, segment.fal_segment_start_ms),
    grc20WorkId: segment.grc20_work_id,
    spotifyTrackId: segment.spotify_track_id,
    timing: {
      fal_segment_start_ms: segment.fal_segment_start_ms,
      fal_segment_end_ms: segment.fal_segment_end_ms,
      duration_ms: segment.fal_segment_duration_ms
    },
    assets: {
      instrumental: segment.fal_segment_grove_url,
      tiktokClip: segment.tiktok_clip_grove_url
    }
  };

  // 2. Upload to Grove
  const metadataUri = await uploadToGrove(metadata);

  // 3. Emit SegmentRegistered event
  await segmentEvents.emitSegmentRegistered(
    metadata.segmentHash,
    segment.grc20_work_id,      // References GRC-20 public metadata
    segment.spotify_track_id,
    segment.fal_segment_start_ms,
    segment.fal_segment_end_ms,
    metadataUri                 // Grove URI
  );

  // 4. Build alignment metadata
  const alignmentUri = await uploadToGrove({
    spotifyTrackId: segment.spotify_track_id,
    totalWords: segment.alignment_data.length,
    words: segment.alignment_data
  });

  // 5. Emit SegmentProcessed event
  await segmentEvents.emitSegmentProcessed(
    metadata.segmentHash,
    segment.fal_segment_grove_url,  // Instrumental
    alignmentUri,                    // Word timing
    segment.translation_count,
    metadataUri
  );

  // 6. Emit translation events
  for (const translation of segment.translations) {
    const translationUri = await uploadToGrove(translation);

    await translationEvents.emitTranslationAdded(
      metadata.segmentHash,
      translation.language_code,
      translationUri,
      "gemini-flash-2.5",
      translation.confidence_score,
      false  // not validated
    );
  }
}
```

### 4. Smart Contracts → The Graph Subgraph

```
Contract Events (Lens Testnet)
  ↓
The Graph Indexer
  ├─ SegmentRegistered → Create Segment entity
  ├─ SegmentProcessed → Update Segment (add URIs)
  └─ TranslationAdded → Create Translation entity
  ↓
PostgreSQL Database (The Graph)
  ├─ Segment entities
  ├─ Translation entities
  ├─ Performance entities
  └─ Account entities
  ↓
GraphQL Endpoint
  └─ https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.X
```

### 5. Subgraph → Frontend App

```typescript
// app/src/lib/graphql/client.ts
import { GraphQLClient } from 'graphql-request';

const graphClient = new GraphQLClient(SUBGRAPH_URL);

// Query for karaoke data
const GET_SEGMENT = gql`
  query GetSegment($spotifyTrackId: String!) {
    segments(where: { spotifyTrackId: $spotifyTrackId }) {
      id
      segmentHash
      grc20WorkId              # Links to GRC-20
      spotifyTrackId
      instrumentalUri          # Grove: enhanced audio
      alignmentUri             # Grove: word timing
      translations {
        languageCode
        translationUri         # Grove: translation JSON
        confidenceScore
      }
    }
  }
`;

// Fetch from subgraph
const { segments } = await graphClient.request(GET_SEGMENT, {
  spotifyTrackId: "43bCmCI0nSgcT7QdMXY6LV"
});

// Fetch assets from Grove
const instrumental = await fetch(segments[0].instrumentalUri);
const alignment = await fetch(segments[0].alignmentUri);
const translation = await fetch(
  segments[0].translations.find(t => t.languageCode === 'zh').translationUri
);

// Render karaoke UI
<KaraokePlayer
  audio={instrumental}
  words={alignment.words}
  translation={translation.lines}
/>
```

---

## 🔧 Architecture Layers Explained

### Layer 1: GRC-20 (Public Music Metadata)
**Purpose**: Like CISAC on-chain - immutable music industry identifiers

- **What it stores**: Artists, Works, Recordings with industry IDs (ISNI, ISWC, ISRC)
- **Who uses it**: Any music app can reference these entities
- **Cost**: ~$0.20 per 1000 entities
- **Query**: The Graph GRC-20 API
- **NOT stored**: Karaoke-specific data (segments, translations, performances)

**Example**:
```graphql
query {
  musicalWork(id: "f1d7f4c7-ca47-4ba3-9875-a91720459ab4") {
    title                    # "Side To Side"
    iswc                     # "T0733312345"
    composedBy {             # Links to Musical Artist
      name                   # "Ariana Grande"
      isni                   # "0000000123456789"
    }
  }
}
```

### Layer 2: Smart Contracts (Dapp-Specific Events)
**Purpose**: Karaoke segments, translations, performances

- **What it stores**: NOTHING (events only!)
- **What it emits**: Event logs for The Graph to index
- **Cost**: ~35k gas per event (~$0.01 on Lens)
- **Benefits**: No storage fees, The Graph handles queries

**Example Event**:
```solidity
event SegmentRegistered(
  bytes32 indexed segmentHash,
  string indexed grc20WorkId,      // References Layer 1
  string spotifyTrackId,
  uint32 segmentStartMs,
  uint32 segmentEndMs,
  string metadataUri               // Grove: actual data
);
```

### Layer 3: The Graph Subgraph (Fast Queries)
**Purpose**: Index contract events for GraphQL queries

- **What it stores**: Indexed event data in PostgreSQL
- **How it works**: Listens to contracts, builds relational entities
- **Query language**: GraphQL
- **Updates**: Real-time as events are emitted

**Example Schema**:
```graphql
type Segment @entity {
  id: ID!                    # segmentHash
  grc20WorkId: String!       # References GRC-20
  spotifyTrackId: String!
  instrumentalUri: String    # Grove URI
  alignmentUri: String       # Grove URI
  translations: [Translation!]!
}
```

### Layer 4: Grove/IPFS (Immutable Storage)
**Purpose**: Store actual audio files and JSON metadata

- **What it stores**: MP3s, JSONs, images (content-addressed)
- **Access**: `grove://` URIs resolve to IPFS CIDs
- **Cost**: Free (IPFS storage via Grove)
- **Benefits**: Immutable, decentralized, verifiable

**Example Assets**:
```
grove://5d85ca354afb...  → Instrumental MP3 (2.5 MB)
grove://abc123...        → Alignment JSON (20 KB)
grove://def456...        → Translation JSON (30 KB)
```

### Layer 5: Story Protocol (Copyright Tracking)
**Purpose**: TikTok derivative works with automatic royalty splits

- **What it tracks**: IP Assets for 5,653 copyrighted TikTok videos
- **Revenue split**: 82% original artist, 18% TikTok creator
- **Integration**: References GRC-20 work IDs in IP Asset metadata

**Status**: Not yet implemented

---

## 🚧 What's Missing (Priority Order)

### 1. **HIGH PRIORITY: Grove Upload + Event Emission Script**
**Location**: `karaoke-pipeline/scripts/emit-segment-events.ts` (needs creation)

**What it does**:
1. Queries Neon for 36 processed segments with GRC-20 work IDs
2. Builds Grove metadata JSONs
3. Uploads to Grove/IPFS
4. Emits SegmentRegistered, SegmentProcessed, TranslationAdded events
5. Stores event hashes/timestamps in Neon

**Blockers**:
- Need to deploy TranslationEvents.sol
- Need Grove API credentials configured
- Need wallet with gas on Lens Testnet

---

### 2. **HIGH PRIORITY: Deploy TranslationEvents Contract**
**Location**: `contracts/src/events/TranslationEvents.sol` (exists, not deployed)

**Steps**:
```bash
cd contracts
forge script script/DeployTranslationEvents.s.sol \
  --zk \
  --rpc-url https://rpc.testnet.lens.xyz \
  --broadcast
```

**Update subgraph.yaml** with deployed address.

---

### 3. **MEDIUM PRIORITY: Update & Deploy Subgraph**
**Location**: `subgraph/`

**Steps**:
1. Update `subgraph.yaml`:
   - Change `network: local` → `network: lens-testnet`
   - Update TranslationEvents address (after deployment)
   - Verify all contract addresses match Lens Testnet deployments

2. Deploy:
```bash
cd subgraph
bun run codegen
bun run build
graph deploy --studio ksc-1
```

3. Update app with new subgraph URL:
```typescript
// app/src/lib/graphql/client.ts
export const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL ||
  'https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.2';
```

---

### 4. **MEDIUM PRIORITY: PKP + Lens for TikTok Creators**
**Purpose**: Enable creator attribution before Story Protocol

**Steps**:
1. Create PKPs for 51 TikTok creators (`karaoke-pipeline/scripts/create-pkps.ts`)
2. Create Lens accounts (`karaoke-pipeline/scripts/create-lens-accounts.ts`)
3. Store in `pkp_accounts` and `lens_accounts` tables

---

### 5. **LOW PRIORITY: Story Protocol IP Assets**
**Purpose**: Register 5,653 copyrighted TikTok videos

**Requires**: PKPs created first

**Steps**:
1. For each copyrighted video, register as IP Asset
2. Set 82/18 revenue split
3. Link to GRC-20 work ID in metadata
4. Emit TikTokVideoMinted events

---

### 6. **LOW PRIORITY: Complete Remaining ISWCs**
**3 works missing ISWCs**:
- Life Is Good (Kenny Chesney)
- Sarà perché ti amo (Ricchi E Poveri)
- THATS WHAT I WANT (Lil Nas X)

**Solution**: Wait for BMI/MLC services to come online, then run backfill script.

---

## 📋 Verification Checklist

### Contracts
- [x] PerformanceGrader deployed
- [x] SongEvents deployed
- [x] SegmentEvents deployed
- [x] AccountEvents deployed
- [ ] TranslationEvents deployed
- [x] All contracts verified on block explorer

### GRC-20
- [x] Space created
- [x] Schema defined (99 properties, 3 types)
- [x] Artists minted (52/52)
- [x] Works minted (36/39)
- [x] Recordings minted (39/39)
- [x] Separate minting tables implemented

### Database
- [x] 36 segments with fal audio
- [x] Word-level timing (ElevenLabs)
- [x] Multi-language translations
- [x] Grove URLs stored
- [x] GRC-20 entity IDs tracked

### Subgraph
- [x] Schema updated with GRC-20 references
- [x] Event handlers implemented
- [ ] Deployed to testnet
- [ ] Contract addresses updated
- [ ] App using new subgraph URL

### App
- [x] GraphQL client configured
- [ ] Routing updated for new flow
- [ ] Environment variables for subgraph URL
- [ ] Testing with deployed subgraph

---

## 🎯 Recommended Next Action

**Create the Grove upload + event emission script** (`emit-segment-events.ts`):

This is the critical missing piece that connects the database → contracts → subgraph → app flow. Once this script runs:

1. ✅ All 36 segments will be on-chain
2. ✅ Subgraph will index them
3. ✅ App can query via GraphQL
4. ✅ Full end-to-end flow operational

**Estimated time**: 2-3 hours
**Blockers**: Deploy TranslationEvents, configure Grove credentials
