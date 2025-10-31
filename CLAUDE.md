# Karaoke School v1 - Technical Architecture

**AI-powered language learning through music with blockchain-native copyright tracking**

---

@AGENTS.md

---

## 🔧 Database Configuration

**IMPORTANT: Always use the correct Neon project when querying via MCP!**

**Active Database (USE THIS ONE):**
- **Project ID:** `frosty-smoke-70266868`
- **Project Name:** KS1
- **Region:** EU (aws-eu-central-1)
- **Pipeline Table:** `song_pipeline`
- **Created:** 2025-10-28

**Old Database (DO NOT USE):**
- **Project ID:** `plain-wave-99802895`
- **Project Name:** OLD_ARCHIVED
- **Region:** Singapore (aws-ap-southeast-1)
- **Pipeline Table:** `track_pipeline`
- **Status:** Archived - Do not query this database

---

## 🎯 Project Overview

Karaoke School is a decentralized karaoke platform for language learning that:
- Processes TikTok videos into karaoke segments with word-level timing
- Provides multi-language translations synced to word timestamps
- Tracks copyright via Story Protocol (82% original artist, 18% TikTok creator)
- Uses GRC-20 as immutable music metadata layer (like CISAC on-chain)
- Grades user performances using Lit Actions (off-chain compute)

**Key Innovation:** We separate concerns across multiple blockchain layers to optimize for cost, flexibility, and standards compliance.

---

## 🏗️ Complete Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: GRC-20 (Public Music Metadata - Like CISAC On-Chain)  │
│ Purpose: Immutable reference for music industry identifiers     │
├─────────────────────────────────────────────────────────────────┤
│ • Musical Works (ISWC when available, Spotify ID fallback)     │
│ • Artists (ISNI when available, Spotify/Genius fallback)        │
│                                                                  │
│ NOT dapp-specific! Public good infrastructure anyone can query  │
│ Cost: ~$0.20 per 1000 entities (can mint millions)              │
│ Query: The Graph GRC-20 API                                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Referenced by
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: Smart Contracts (Dapp-Specific Data)                   │
│ Purpose: Karaoke segments, translations, TikTok videos           │
├─────────────────────────────────────────────────────────────────┤
│ Contracts (Lens Chain):                                          │
│   • SegmentEvents.sol - Karaoke segments with timing            │
│   • TranslationEvents.sol - Multi-language translations         │
│   • TikTokVideoEvents.sol - Creator videos                      │
│   • PerformanceGrader.sol - User scores (via Lit Actions)       │
│                                                                  │
│ All contracts emit events, NO STORAGE (gas efficient)           │
│ Cost: ~50k gas per segment + ~10k per translation               │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Indexed by
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: Subgraph (Fast Queries)                                │
│ Purpose: Index contract events for app queries                  │
├─────────────────────────────────────────────────────────────────┤
│ Entities:                                                        │
│   • Segment (timing, instrumentalUri, alignmentUri)             │
│   • Translation (languageCode, translationUri)                  │
│   • TikTokVideo (creator PKP, Story IP Asset ID)                │
│   • Performance (user scores, leaderboard)                      │
│                                                                  │
│ Query: GraphQL endpoint (custom schema)                         │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Assets stored in
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: Grove/IPFS (Immutable Assets)                          │
│ Purpose: Decentralized storage for audio and metadata           │
├─────────────────────────────────────────────────────────────────┤
│ Asset Types:                                                     │
│   • Instrumental MP3s (fal.ai enhanced, ~190s)                  │
│   • TikTok clips (cropped 50s segments)                         │
│   • Word alignment JSON (ElevenLabs timing)                     │
│   • Translation JSON (line + word level, 3+ languages)          │
│   • Segment metadata JSON (references all above)                │
│                                                                  │
│ Cost: $0.01 per MB via Irys                                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Copyright tracked in
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5: Story Protocol (IP Assets & Revenue)                   │
│ Purpose: Copyright tracking and automatic revenue distribution  │
├─────────────────────────────────────────────────────────────────┤
│ IP Assets:                                                       │
│   • TikTok videos (82% original artist, 18% creator)            │
│   • References GRC-20 work entity ID in metadata                │
│   • Parent-child relationships to original works                │
│   • Automatic royalty splits on commercial use                  │
│                                                                  │
│ Cost: ~$2-5 per IP Asset registration                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow: From TikTok Video → Blockchain → App

### Phase 1: Audio Processing (Neon DB)

```
TikTok Video
  ↓ Download (freyr-service)
  ↓ Demucs separation (vocals + instrumental)
  ↓ Gemini segmentation (find ~190s karaoke-worthy clip)
  ↓ fal.ai enhancement (high-quality instrumental)
  ↓ FFmpeg cropping (50s TikTok clip)
  ↓ ElevenLabs word alignment (word-level timing)
  ↓ Gemini translation (line-level, 3+ languages)
  ↓ Store in Neon DB

Result:
  • karaoke_segments (timing, Grove URLs)
  • elevenlabs_word_alignments (word timing)
  • lyrics_translations (multi-language)
  • tiktok_scraped_videos (8,196 videos, 5,653 copyrighted)
```

### Phase 2: Upload to Grove (IPFS)

```typescript
// Build metadata JSON files from Neon DB
const metadata = {
  segmentHash: "0xabc123...",
  grc20WorkId: "f1d7f4c7-ca47-4ba3-9875-a91720459ab4",
  spotifyTrackId: "43bCmCI0nSgcT7QdMXY6LV",
  timing: {
    fal_segment_start_ms: 45000,
    fal_segment_end_ms: 235000,
    duration_ms: 190000
  },
  assets: {
    instrumental: "grove://5d85ca354afb...",
    alignment: "grove://abc123...",
    translations: {
      zh: "grove://def456...",
      vi: "grove://ghi789...",
      id: "grove://jkl012..."
    }
  }
};

// Upload to Grove via Irys
const cid = await uploadToGrove(metadata);
```

### Phase 3: Emit Contract Events (Lens Chain)

```solidity
// 1. Register segment
emitSegmentRegistered(
  segmentHash,
  grc20WorkId,        // References GRC-20 public metadata
  spotifyTrackId,
  groveMetadataUri    // grove://...
);

// 2. Mark as processed
emitSegmentProcessed(
  segmentHash,
  instrumentalUri,    // grove://...
  alignmentUri,       // grove://...
  updatedMetadataUri
);

// 3. Add translations (one event per language)
emitTranslationAdded(segmentHash, "zh", translationUri);
emitTranslationAdded(segmentHash, "vi", translationUri);
emitTranslationAdded(segmentHash, "id", translationUri);
```

### Phase 4: Subgraph Indexes Events

```
The Graph listens to contracts:
  • SegmentRegistered → Create Segment entity
  • SegmentProcessed → Update URIs
  • TranslationAdded → Create Translation entities

Entities become queryable via GraphQL:
  query GetSegment($spotifyId: String!) {
    segments(where: { spotifyTrackId: $spotifyId }) {
      instrumentalUri
      alignmentUri
      translations { languageCode, translationUri }
    }
  }
```

### Phase 5: App Displays Karaoke UI

```tsx
// User selects song
const segment = useSegment(spotifyTrackId);

// Fetch assets from Grove
const instrumental = await fetch(segment.instrumentalUri);
const alignment = await fetch(segment.alignmentUri);
const translation = await fetch(segment.translations.find(t => t.languageCode === userLang).translationUri);

// Display karaoke UI
<KaraokePlayer
  audio={instrumental}
  words={alignment.words}  // [{text: "Moo", start: 0.099, end: 12.44}, ...]
  translation={translation.lines}  // Line-level with word timing
  onComplete={recordPerformance}
/>
```

### Phase 6: User Performance (Lit Actions)

```typescript
// User sings karaoke
const userRecording = await recordAudio();
const recordingUri = await uploadToGrove(userRecording);

// Lit Action grades performance (off-chain compute)
const score = await litAction.gradePerformance({
  userRecording: recordingUri,
  referenceAlignment: segment.alignmentUri,
  algorithm: "pronunciation-timing-pitch"
});

// Lit Action calls contract
await PerformanceGrader.emitPerformanceGraded(
  performanceId,
  segmentHash,
  userAddress,
  score,  // 0-10000 (7543 = 75.43%)
  recordingUri
);

// Subgraph updates leaderboard
```

### Phase 7: TikTok Derivatives (Story Protocol)

```typescript
// For copyrighted TikTok videos
for (const video of tiktokVideos) {
  // 1. Get or create PKP for creator
  const pkp = await getOrCreatePKP(video.creatorHandle);

  // 2. Create Lens account with PKP
  const lensAccount = await createLensAccount(pkp);

  // 3. Register as Story IP Asset
  const ipAsset = await story.ipAsset.register({
    nftContract: TIKTOK_VIDEO_NFT_CONTRACT,
    tokenId: BigInt(video.videoId),
    ipMetadata: {
      ipType: 'derivative',
      attributes: [
        { key: 'grc20_work_id', value: segment.grc20WorkId },
        { key: 'segment_hash', value: segment.segmentHash },
        { key: 'creator_pkp', value: pkp.address },
        { key: 'video_uri', value: video.groveUri }
      ]
    }
  });

  // 4. Set revenue split (82% original, 18% creator)
  await story.license.setTerms({
    ipId: ipAsset.ipId,
    terms: {
      commercialUse: true,
      commercialRevShare: 18  // Creator gets 18%
    }
  });

  // 5. Emit event for subgraph
  await TikTokVideoEvents.emitTikTokVideoMinted(
    video.videoId,
    segment.segmentHash,
    segment.grc20WorkId,
    video.creatorHandle,
    pkp.address,
    lensAccount.address,
    "copyrighted",
    ipAsset.ipId,
    18,  // Revenue split
    video.groveUri
  );
}
```

---

## 🗂️ Database Schema (Neon PostgreSQL)

### Core Tables

#### `grc20_artists` (106 minted)
```sql
CREATE TABLE grc20_artists (
  id SERIAL PRIMARY KEY,
  grc20_entity_id UUID,              -- Minted to GRC-20
  name TEXT NOT NULL,
  isni TEXT,                         -- International Standard Name Identifier
  mbid TEXT,                         -- MusicBrainz ID
  spotify_artist_id TEXT,
  genius_artist_id INTEGER,

  -- Social media
  instagram_handle TEXT,
  twitter_handle TEXT,
  tiktok_handle TEXT,

  -- Images (Grove URIs)
  image_url TEXT,
  image_source TEXT,                 -- 'fal' | 'spotify' | 'genius'

  -- Quality metrics
  completeness_score NUMERIC(3,2),
  consensus_score NUMERIC(3,2),
  ready_to_mint BOOLEAN DEFAULT FALSE,
  minted_at TIMESTAMP
);
```

#### `grc20_works` (63 minted)
```sql
CREATE TABLE grc20_works (
  id SERIAL PRIMARY KEY,
  grc20_entity_id UUID,              -- Minted to GRC-20
  title TEXT NOT NULL,

  -- Industry identifiers
  iswc TEXT,                         -- International Standard Musical Work Code
  isrc TEXT,                         -- International Standard Recording Code
  spotify_track_id TEXT,
  genius_song_id INTEGER,

  -- Relations
  primary_artist_id INTEGER REFERENCES grc20_artists(id),

  -- Metadata
  language CHAR(2),
  release_date DATE,
  duration_ms INTEGER,

  -- Quality
  completeness_score NUMERIC(3,2),
  ready_to_mint BOOLEAN DEFAULT FALSE,
  minted_at TIMESTAMP
);
```

#### `karaoke_segments` (36 with fal audio)
```sql
CREATE TABLE karaoke_segments (
  spotify_track_id TEXT PRIMARY KEY REFERENCES spotify_tracks(spotify_track_id),

  -- Timing (from Gemini + fal.ai)
  fal_segment_start_ms INTEGER,
  fal_segment_end_ms INTEGER,
  fal_segment_duration_ms INTEGER,

  -- Assets (Grove URLs)
  fal_segment_grove_cid TEXT,
  fal_segment_grove_url TEXT,        -- Instrumental MP3 (~190s)

  tiktok_clip_start_ms INTEGER,
  tiktok_clip_end_ms INTEGER,
  tiktok_clip_grove_cid TEXT,
  tiktok_clip_grove_url TEXT,        -- Cropped clip (50s)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `elevenlabs_word_alignments` (36 tracks)
```sql
CREATE TABLE elevenlabs_word_alignments (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL UNIQUE REFERENCES spotify_tracks(spotify_track_id),

  -- Word-level timing
  words JSONB NOT NULL,              -- [{text: "Moo", start: 0.099, end: 12.44, loss: 3.57}, ...]
  total_words INTEGER NOT NULL,
  alignment_duration_ms INTEGER,

  raw_alignment_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `lyrics_translations` (36 tracks × 3+ languages)
```sql
CREATE TABLE lyrics_translations (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL REFERENCES spotify_tracks(spotify_track_id),
  language_code TEXT NOT NULL CHECK (length(language_code) = 2),  -- ISO 639-1

  -- Line-level translation with word timing
  lines JSONB NOT NULL,              -- [{lineIndex, originalText, translatedText, start, end, words[]}, ...]

  translation_source TEXT DEFAULT 'gemini-flash-2.5',
  confidence_score NUMERIC,
  translated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(spotify_track_id, language_code)
);
```

#### `tiktok_scraped_videos` (8,196 videos, 5,653 copyrighted)
```sql
CREATE TABLE tiktok_scraped_videos (
  video_id TEXT PRIMARY KEY,
  tiktok_handle TEXT REFERENCES tiktok_creators(tiktok_handle),
  spotify_track_id TEXT,

  copyright_status TEXT CHECK (copyright_status IN ('copyrighted', 'copyright-free', 'unknown')),

  play_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,

  created_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `tiktok_creators` (51 creators)
```sql
CREATE TABLE tiktok_creators (
  tiktok_handle TEXT PRIMARY KEY,
  sec_uid TEXT NOT NULL,
  name TEXT,
  follower_count INTEGER,

  -- PKP/Lens (to be added)
  pkp_address TEXT,
  lens_account_address TEXT,

  raw_profile JSONB,
  last_scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📜 Smart Contract Architecture

### Contract: `SegmentEvents.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SegmentEvents {
    event SegmentRegistered(
        bytes32 indexed segmentHash,
        string indexed grc20WorkId,       // UUID from GRC-20
        string spotifyTrackId,
        string metadataUri,               // Grove URI
        address indexed registeredBy,
        uint64 timestamp
    );

    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string instrumentalUri,           // Grove: instrumental MP3
        string alignmentUri,              // Grove: word timing JSON
        string metadataUri,
        uint64 timestamp
    );

    function emitSegmentRegistered(
        bytes32 segmentHash,
        string calldata grc20WorkId,
        string calldata spotifyTrackId,
        string calldata metadataUri
    ) external {
        emit SegmentRegistered(
            segmentHash,
            grc20WorkId,
            spotifyTrackId,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function emitSegmentProcessed(
        bytes32 segmentHash,
        string calldata instrumentalUri,
        string calldata alignmentUri,
        string calldata metadataUri
    ) external {
        emit SegmentProcessed(
            segmentHash,
            instrumentalUri,
            alignmentUri,
            metadataUri,
            uint64(block.timestamp)
        );
    }
}
```

### Contract: `TranslationEvents.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TranslationEvents {
    event TranslationAdded(
        bytes32 indexed segmentHash,
        string languageCode,              // ISO 639-1: "zh", "vi", "id"
        string translationUri,            // Grove URI
        string translationSource,         // "gemini-flash-2.5"
        uint16 confidenceScore,           // 0-10000
        address indexed addedBy,
        uint64 timestamp
    );
}
```

### Contract: `TikTokVideoEvents.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TikTokVideoEvents {
    event TikTokVideoMinted(
        string indexed videoId,
        bytes32 indexed segmentHash,
        string grc20WorkId,
        string creatorHandle,
        address creatorPkpAddress,
        address creatorLensAccount,
        string copyrightStatus,           // "copyrighted" | "copyright-free"
        string storyIpAssetId,            // Story Protocol IP Asset ID
        uint8 revenueSplitCreator,        // 18 for copyrighted
        string videoUri,                  // Grove URI
        uint64 timestamp
    );
}
```

---

## 🔍 Subgraph Schema

```graphql
type Segment @entity(immutable: false) {
  id: ID! # segmentHash
  segmentHash: Bytes!

  # References
  grc20WorkId: String!                  # Join to GRC-20
  spotifyTrackId: String!

  # Grove URIs
  metadataUri: String!
  instrumentalUri: String
  alignmentUri: String                  # ElevenLabs word timing

  # Timing
  startMs: Int!
  endMs: Int!
  durationMs: Int!

  # Relations
  translations: [Translation!]! @derivedFrom(field: "segment")
  performances: [Performance!]! @derivedFrom(field: "segment")
  tiktokVideos: [TikTokVideo!]! @derivedFrom(field: "segment")

  registeredBy: Bytes!
  registeredAt: BigInt!
  processedAt: BigInt
}

type Translation @entity(immutable: false) {
  id: ID! # segmentHash-languageCode
  segment: Segment!
  languageCode: String!                 # "zh", "vi", "id"
  translationUri: String!               # Grove URI
  translationSource: String!
  confidenceScore: BigDecimal
  addedAt: BigInt!
}

type TikTokVideo @entity(immutable: true) {
  id: ID! # videoId
  videoId: String!
  segment: Segment!

  # Creator
  creatorHandle: String!
  creatorPkpAddress: Bytes
  creatorLensAccount: Bytes

  # Copyright
  copyrightStatus: String!
  storyIpAssetId: String                # Story Protocol
  revenueSplitCreator: Int              # 18 or 0

  videoUri: String!
  mintedAt: BigInt!
}

type Performance @entity(immutable: true) {
  id: ID! # performanceId
  performanceId: BigInt!
  segment: Segment!
  performer: Account!
  score: Int!                           # 0-10000
  metadataUri: String!
  gradedAt: BigInt!
}
```

---

## 📁 Grove/IPFS File Structures

### `segment-metadata.json`
```json
{
  "segmentHash": "0xabc123...",
  "grc20WorkId": "f1d7f4c7-ca47-4ba3-9875-a91720459ab4",
  "spotifyTrackId": "43bCmCI0nSgcT7QdMXY6LV",
  "title": "Side To Side",
  "artist": "Ariana Grande",
  "timing": {
    "fal_segment_start_ms": 45000,
    "fal_segment_end_ms": 235000,
    "duration_ms": 190000,
    "tiktok_clip_start_ms": 60000,
    "tiktok_clip_end_ms": 110000
  },
  "assets": {
    "instrumental": "grove://5d85ca354afb...",
    "tiktokClip": "grove://...",
    "alignment": "grove://..."
  },
  "languages": ["en", "zh", "vi", "id"],
  "translationUris": {
    "zh": "grove://...",
    "vi": "grove://...",
    "id": "grove://..."
  }
}
```

### `alignment.json` (ElevenLabs)
```json
{
  "spotifyTrackId": "43bCmCI0nSgcT7QdMXY6LV",
  "totalWords": 247,
  "alignmentDurationMs": 190000,
  "words": [
    {
      "text": "Moo",
      "start": 0.099,
      "end": 12.44,
      "loss": 3.57421875,
      "confidence": 0.96
    },
    {
      "text": "I",
      "start": 12.52,
      "end": 12.66,
      "loss": 0.12,
      "confidence": 0.99
    }
  ]
}
```

### `translation-zh.json` (Gemini)
```json
{
  "spotifyTrackId": "43bCmCI0nSgcT7QdMXY6LV",
  "languageCode": "zh",
  "translationSource": "gemini-flash-2.5",
  "confidenceScore": 0.92,
  "translatedAt": "2025-10-28T19:30:00Z",
  "lines": [
    {
      "lineIndex": 0,
      "originalText": "Someone said they left together",
      "translatedText": "有人说他们已双双离去",
      "start": 25.42,
      "end": 29.119,
      "words": [
        {
          "text": "Someone",
          "start": 25.42,
          "end": 26.299
        },
        {
          "text": "said",
          "start": 26.42,
          "end": 26.84
        }
      ],
      "translatedWords": [
        {
          "text": "有人",
          "start": 25.42,
          "end": 26.299
        },
        {
          "text": "说",
          "start": 26.42,
          "end": 26.84
        }
      ]
    }
  ]
}
```

---

## 🛠️ Development Workflow

### 1. Mint Artists/Works to GRC-20
```bash
cd grc20-integration

# Mint artists (106 minted, 133 ready)
dotenvx run -f .env -- bun run import-artists

# Mint works (63 minted, needs more)
dotenvx run -f .env -- bun run import-works

# Verify in GeoBrowser
open https://testnet.geobrowser.io/space/2a629b2a-a575-4d07-8cde-29855a02660c
```

### 2. Process Karaoke Segments
```bash
# Run unified pipeline (in cloudflare-worker-scraper or karaoke-pipeline)
# This handles:
#   - Audio download
#   - Demucs separation
#   - Fal.ai enhancement
#   - ElevenLabs alignment
#   - Gemini translation

# Manual processing steps documented in respective READMEs
```

### 3. Upload to Grove and Emit Events
```bash
# Build Grove JSON files from Neon DB
dotenvx run -f .env -- bun run build-grove-metadata

# Upload to Grove via Irys
dotenvx run -f .env -- bun run upload-to-grove

# Emit contract events
dotenvx run -f .env -- bun run emit-segment-events
dotenvx run -f .env -- bun run emit-translation-events
```

### 4. Deploy/Update Contracts
```bash
cd contracts

# Compile contracts
forge build

# Deploy to Lens testnet
forge script script/DeployEvents.s.sol --rpc-url lens-testnet --broadcast

# Verify on block explorer
forge verify-contract <address> SegmentEvents --chain lens-testnet
```

### 5. Deploy/Update Subgraph
```bash
cd subgraph

# Update contract addresses in subgraph.yaml
# Update ABIs if contracts changed
npm run codegen
npm run build

# Deploy to The Graph (or local node)
graph deploy --studio karaoke-school-v1
```

### 6. Mint TikTok Derivatives
```bash
# Create PKPs for creators
dotenvx run -f .env -- bun run create-creator-pkps

# Mint to Story Protocol
dotenvx run -f .env -- bun run mint-tiktok-derivatives

# Emit events
dotenvx run -f .env -- bun run emit-tiktok-events
```

---

## 🎯 Key Design Decisions

### Why GRC-20 for Artists/Works?
- **Immutable identifiers** when Spotify IDs, SoundCloud handles, etc. change
- **Public good infrastructure** - not dapp-specific, anyone can reference
- **99% cheaper** than storing in smart contracts
- **Standards-based** - like CISAC/ISNI on-chain
- **Flexible** - can add properties without contract upgrades

### Why NOT Put Segments in GRC-20?
- **Dapp-specific** - karaoke segments are unique to our use case
- **Frequently updated** - translations, validations change often
- **Better in contracts** - faster queries via subgraph
- **Cost-effective** - event logs are cheaper for mutable data

### Why Grove for Assets?
- **Immutable storage** via IPFS
- **Cheap** - $0.01 per MB
- **Fast** - CDN-backed
- **Verifiable** - content-addressed (CIDs)

### Why Story Protocol for TikTok?
- **Automatic revenue splits** (82/18)
- **Copyright tracking** on-chain
- **Commercial licensing** built-in
- **Industry standard** for IP management

---

## 🔒 Environment Management Guidelines

### Security Best Practices
- Always use `dotenvx run -f .env -- [command]`
- Never prefix or export `DOTENV_PRIVATE_KEY` inline
- Assume `DOTENV_PRIVATE_KEY` is in `.claude/settings.local.json`
- Never log, read, or expose secrets in commands/outputs

### Example Commands
```bash
# ✅ GOOD
dotenvx run -f .env -- bun run import-artists

# ❌ BAD
export DOTENV_PRIVATE_KEY='...' && dotenvx run -f .env -- bun run import-artists
```

---

## 📝 Git Workflow

- Only commit working milestones with tested code
- Don't commit untested code
- Use descriptive commit messages

---

## 📊 Current Status (2025-10-29)

### GRC-20 Layer
- ✅ 106 artists minted (133 ready to mint)
- ✅ 63 works minted
- ⏳ Need to mint remaining artists
- ⏳ Need to mint more works

### Audio Processing
- ✅ 36 segments with fal audio
- ✅ Word-level timing (ElevenLabs)
- ✅ 3+ translations per track
- ⏳ Need to process more segments

### TikTok Data
- ✅ 8,196 videos scraped
- ✅ 5,653 copyrighted videos identified
- ✅ 51 creators tracked
- ⏳ Need to create PKPs
- ⏳ Need to mint as Story IP Assets

### Contracts
- ✅ PerformanceGrader.sol (deployed)
- ⏳ Need to update SegmentEvents.sol
- ⏳ Need to create TranslationEvents.sol
- ⏳ Need to create TikTokVideoEvents.sol

### Subgraph
- ✅ Basic schema exists
- ⏳ Need to update for new events
- ⏳ Need to add Translation entity
- ⏳ Need to add TikTokVideo entity

---

## 🚀 Next Steps

1. **Update contracts** with GRC-20 references
2. **Build Grove upload script** (metadata JSON from Neon DB)
3. **Emit segment/translation events** for 36 segments
4. **Update subgraph** schema and mappings
5. **Create PKPs** for 51 TikTok creators
6. **Mint Story IP Assets** for 5,653 copyrighted videos
7. **Update app** to query subgraph + GRC-20

---

## 📚 Related Documentation

- [GRC-20 Integration README](./grc20-integration/README.md)
- [Cloudflare Worker Scraper](./cloudflare-worker-scraper/)
- [Karaoke Pipeline](./karaoke-pipeline/)
- [Contracts](./contracts/)
- [Subgraph](./subgraph/)
- [App](./app/)

---

**This is the core technical reference for Karaoke School v1. Keep it updated as architecture evolves.**
