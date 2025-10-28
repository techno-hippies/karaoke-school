# Karaoke School Master Pipeline

**TikTok-based karaoke segments for English learning with blockchain provenance**

## Overview

Complete pipeline for creating karaoke learning content from TikTok music segments:

1. **Song Registration**: Fetch metadata, MLC licensing data, synced lyrics
2. **Segment Processing**: TikTok matching → Audio processing → Blockchain registration
3. **Story Protocol (Optional)**: Mint derivative IP Assets for AI-generated instrumentals

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SONG PIPELINE                                │
│  Input:  Genius ID, Artist ID                                    │
│  Steps:                                                          │
│    1. Register Song (blockchain)                                 │
│    2. Fetch MLC Data (licensing, ISRC)                           │
│    3. Build Metadata (lyrics + licensing → Grove)                │
│  Output: Song on Base Sepolia + metadata JSON                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Enables
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SEGMENT PIPELINE                                │
│  Input:  TikTok music URL + full song file                       │
│  Steps:                                                          │
│    1. Match TikTok segment to original (audio fingerprinting)    │
│    2. Crop segment → Demucs separation → fal.ai enhancement      │
│    3. ElevenLabs forced alignment (word timestamps)              │
│    4. Upload to Grove (vocals, instrumental, alignment)          │
│    5. Register on blockchain (SegmentRegistry)                   │
│  Output: Karaoke-ready segment with word-level timing            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Optional
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              STORY PROTOCOL (DERIVATIVE)                         │
│  Input:  Processed segment                                       │
│  Steps:                                                          │
│    1. Generate Seedream derivative cover art                     │
│    2. Build IP Asset metadata (100% ownership)                   │
│    3. Mint derivative instrumental on Story Protocol             │
│  Output: IP Asset for AI-generated karaoke instrumental          │
│  Note: NOT original song (we're not rights holders)              │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```
Song (Genius + Spotify + MLC)
  ├── Metadata (MLC licensing + synced lyrics)
  └── Segments (TikTok music segments)
       ├── Audio Assets (vocals, instrumental, alignment)
       ├── Blockchain Entry (SegmentRegistry)
       └── Story Protocol IP Asset (derivative instrumental)
```

## Quick Start

### 1. Song Registration

```bash
# Register song on blockchain
bun songs/01-register-song.ts \
  --genius-id 10047250 \
  --genius-artist-id 498

# Fetch MLC licensing data (publishers, writers, ISRC)
bun songs/02-fetch-mlc-data.ts \
  --genius-id 10047250

# Build metadata JSON with lyrics + licensing
bun songs/03-build-metadata.ts \
  --genius-id 10047250
```

**Result**: Song registered on Base Sepolia + `data/metadata/10047250.json`

### 2. Segment Processing

```bash
# Complete segment pipeline (match + process + register)
bun segments/01-match-and-process.ts \
  --genius-id 10047250 \
  --tiktok-url "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \
  --song-path "/path/to/TEXAS-HOLD-EM.flac"
```

**Pipeline Steps**:
1. Extract TikTok music ID from URL
2. Match TikTok segment to original song (Voxtral STT + Gemini matching)
3. Crop audio segment
4. Demucs separation (vocals + instrumental)
5. fal.ai audio-to-audio enhancement (instrumental only)
6. ElevenLabs forced alignment (word timestamps)
7. Upload to Grove (3 files: vocals, instrumental, alignment)
8. Register on blockchain (SegmentRegistry)

**Result**: Segment hash + Grove URIs ready for karaoke app

### 3. Story Protocol (Optional)

```bash
# Mint derivative IP Asset for AI-generated instrumental
bun segments/02-mint-segment-ip-asset.ts \
  --genius-id 10047250 \
  --segment-id "7334542274145454891-0-60"
```

**What gets minted**:
- **Type**: Derivative AI-generated instrumental (NOT original song)
- **Primary Media**: `instrumental.wav` (users sing over this)
- **Cover Art**: Seedream derivative (abstract painting transformation)
- **Ownership**: 100% KaraokeSchool (mechanical royalties paid separately)
- **License**: Commercial Remix PIL with 0% revenue share

**Important**: We do NOT mint the original song as we are not rights holders. We mint the derivative instrumental we created via fal.ai audio-to-audio processing.

## Folder Structure

```
master-pipeline/
├── artists/               # Artist pipeline (future)
├── songs/                 # Song registration + metadata
│   ├── 01-register-song.ts        # Base Sepolia: SongRegistry
│   ├── 02-fetch-mlc-data.ts       # MLC API: publishers, writers, ISRC
│   └── 03-build-metadata.ts       # Metadata JSON with lyrics
│
├── segments/              # Segment processing
│   ├── 01-match-and-process.ts   # Complete segment pipeline
│   └── 02-mint-segment-ip-asset.ts # Story Protocol derivative mint
│
├── services/              # Reusable services
│   ├── StoryProtocolService.ts    # Story Protocol integration
│   ├── FalSeedreamService.ts      # Derivative cover art generation
│   ├── audio-matching.ts          # TikTok → song timestamp matching
│   ├── audio-processing.ts        # Demucs + fal.ai
│   ├── elevenlabs.ts              # Forced alignment
│   ├── voxtral.ts                 # Speech-to-text
│   ├── openrouter.ts              # Gemini Flash 2.5 Lite
│   ├── lrclib.ts                  # Synced lyrics
│   ├── grove.ts                   # IPFS via Grove
│   ├── tiktok.ts                  # TikTok URL parsing
│   └── base.ts                    # Base service with retry
│
├── data/                  # Pipeline outputs (gitignored)
│   ├── metadata/                  # Song metadata JSONs
│   │   └── {genius-id}.json       # MLC data + lyrics + segments
│   └── segments/                  # Segment processing (temp)
│
├── scripts/               # Python utilities
│   ├── scrape_tiktok_segment.py  # TikTok music segment scraper
│   └── demucs_api.py             # Modal Demucs endpoint
│
├── STORY_PROTOCOL_ARCHITECTURE.md # Story Protocol details
├── .env
└── README.md
```

## Service Architecture

### Base Service Pattern

All services extend `BaseService` with automatic retry logic:

```typescript
import { BaseService, ServiceConfig } from './base.js';

export class MyService extends BaseService {
  constructor(config: MyServiceConfig) {
    super('MyService', { retries: 3, ...config });
  }

  async doSomething() {
    this.log('Starting...');
    // Automatic retry on failure
  }
}
```

### Key Services

- **AudioMatchingService**: TikTok → song timestamp matching
  - Scrapes TikTok segment
  - Voxtral STT on TikTok clip
  - LRCLib lyrics with album fallback
  - ElevenLabs forced alignment on full song
  - Gemini Flash 2.5 Lite intelligent matching

- **AudioProcessingService**: Stem separation + enhancement
  - Demucs via Modal (H200 GPU)
  - fal.ai audio-to-audio enhancement
  - Returns vocals + instrumental paths

- **StoryProtocolService**: IP Asset minting
  - NFT collection creation
  - IP Asset registration with PIL
  - Metadata hashing (SHA-256)
  - Royalty vault setup

- **GroveService**: IPFS storage via Grove
  - Upload files/buffers
  - Returns `lens://` URIs + gateway URLs
  - Supports Base Sepolia (chain_id=84532)

## Story Protocol Architecture

### What We Mint: Derivative Instrumentals

We mint **TWO types** of derivative IP Assets (NOT original songs):

#### 1. Derivative AI-Generated Instrumental (Current)

**One IP Asset per processed segment**

- **Type**: AI-generated instrumental derivative (100% owned by us)
- **Media**: `instrumental.wav` (fal.ai audio-to-audio enhancement)
- **Cover Art**: Seedream-generated abstract derivative
- **Ownership**: 100% KaraokeSchool
- **Mechanical Royalties**: Paid separately per statutory rate to MLC publishers
- **Use Case**: Educational karaoke - users sing over this instrumental

**Key Point**: We OWN the derivative instrumental. Mechanical royalties are a separate payment obligation, not a Story Protocol revenue split.

#### 2. TikTok Dance Videos (Future)

**One IP Asset per user-posted dance video**

- **Type**: Derivative performance work
- **Media**: `video/mp4` (TikTok dance performance)
- **Royalty Split**: 18% to dancer, 82% to original rights holders
- **Use Case**: Social media monetization

### What We DON'T Mint

❌ **Original Songs**: We are NOT the rights holders for songs like "TEXAS HOLD 'EM" by Beyoncé. The MLC licensing data shows the actual rights holders (Sony/ATV, Universal Music Corp, etc.).

Original song IP Assets should only be minted by actual rights holders.

### Derivative Cover Art Strategy

**Problem**: Original album art is copyrighted - we can't use it directly.

**Solution**: fal.ai Seedream Transformation

```typescript
const prompt = "convert this to an abstract painting maintaining its shapes and overall structure but making it vague";
```

**Process**:
1. Original album art (from Genius or Spotify)
2. → fal.ai Seedream 4 text-to-image
3. → Abstract painting with vague shapes
4. → Upload to Grove (`lens://...`)
5. → Use as derivative cover art

**Why this works**:
- Creates a transformative derivative work
- Maintains visual connection to original
- Legally distinct from copyrighted original
- Safe for commercial use

## Contract Integration

### Base Sepolia Contracts

```typescript
// SongRegistryV1
struct Song {
  uint32 geniusId;             // 10047250
  uint32 geniusArtistId;       // 498 (Beyoncé)
  string spotifyId;            // "0Z7nGFVCLfixWctgePsRk9"
  string tiktokMusicId;        // "7334542274145454891"
  string title;                // "TEXAS HOLD 'EM"
  string artist;               // "Beyoncé"
  uint32 duration;             // 233 seconds
  string coverUri;             // Genius URL (reference only)
  string metadataUri;          // lens://... (MLC data + lyrics)
  bool copyrightFree;          // false
  bool enabled;                // true
}

// SegmentRegistryV1
struct Segment {
  uint32 geniusId;             // Links to Song
  string tiktokSegmentId;      // TikTok music ID
  uint32 startTime;            // 0 seconds
  uint32 endTime;              // 60 seconds
  uint32 duration;             // 60 seconds
  string vocalsUri;            // lens://... (backup only)
  string instrumentalUri;      // lens://... (PRIMARY - users karaoke over this)
  string alignmentUri;         // lens://... (ElevenLabs word timestamps)
  string coverUri;             // lens://... (Seedream derivative)
  bool processed;              // true
  bool enabled;                // true
}
```

**Notes**:
- `Song.coverUri`: Genius URL is fine (reference only, not hosting)
- `Segment.instrumentalUri`: PRIMARY media (users sing over this)
- `Segment.vocalsUri`: Backup only (NOT used in app)

## Environment Variables

```bash
# Base Sepolia (EVM contracts)
PRIVATE_KEY=...
ARTIST_REGISTRY_ADDRESS=0x...
SONG_REGISTRY_ADDRESS=0x...
SEGMENT_REGISTRY_ADDRESS=0x...

# Story Protocol Aeneid Testnet
STORY_SPG_NFT_CONTRACT=0x...
SAFE_MULTISIG_ADDRESS=0x... (optional)

# API Keys
GENIUS_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
ELEVENLABS_API_KEY=...
VOXTRAL_API_KEY=...
OPENROUTER_API_KEY=...
FAL_KEY=...
MODAL_API_KEY=...

# Python environment
DOTENV_PRIVATE_KEY=... (dotenvx encryption key)
```

## Prerequisites

### 1. System Tools

```bash
# Audio processing
brew install ffmpeg  # or apt-get install ffmpeg

# Python environment
pip install uv
uv venv
uv pip install hrequests "numpy<2" soundfile
```

### 2. Modal Demucs Setup

```bash
cd scripts
modal deploy demucs_api.py
```

See `STORY_PROTOCOL_ARCHITECTURE.md` for complete details.

### 3. Test Tokens

- Base Sepolia ETH (for contract interactions)
- Story Protocol Aeneid IP tokens (for IP minting)

## Example: Process TEXAS HOLD 'EM

```bash
# 1. Register song
bun songs/01-register-song.ts --genius-id 10047250 --genius-artist-id 498
bun songs/02-fetch-mlc-data.ts --genius-id 10047250
bun songs/03-build-metadata.ts --genius-id 10047250

# 2. Process segment
bun segments/01-match-and-process.ts \
  --genius-id 10047250 \
  --tiktok-url "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \
  --song-path "/path/to/TEXAS-HOLD-EM.flac"

# 3. Mint Story Protocol IP Asset (optional)
bun segments/02-mint-segment-ip-asset.ts \
  --genius-id 10047250 \
  --segment-id "7334542274145454891-0-60"
```

**Result**:
- Song on blockchain (Base Sepolia)
- Segment with vocals + instrumental on Grove
- IP Asset on Story Protocol (Aeneid testnet)
- Metadata: `data/metadata/10047250.json`

## Performance

### Audio Matching
- TikTok scraping: ~3s
- Voxtral STT: ~5s
- LRCLib lyrics: <1s
- ElevenLabs alignment: ~8s
- Gemini matching: ~2s
- **Total**: ~20s

### Audio Processing
- Modal Demucs: 26-31s (H200 GPU)
- fal.ai enhancement: ~12s
- **Total**: ~43s

### Story Protocol
- Seedream cover: ~10s
- IP Asset mint: ~5s
- **Total**: ~15s

**Full Pipeline**: ~80s for 60s segment

## Key Differences: Karaoke vs TikTok Dance Videos

| Aspect | Karaoke Instrumental | Dance Videos |
|--------|---------------------|--------------|
| **What we mint** | Derivative instrumental | Derivative performance |
| **Primary media** | instrumental.wav | video/mp4 |
| **Ownership** | 100% ours | 18/82 split |
| **Cover art** | Seedream derivative | Seedream derivative |
| **Revenue share** | 0% (we own it) | 18% creator, 82% rights holders |
| **Royalties** | Mechanical (separate) | Via Story Protocol |
| **Use case** | Educational karaoke | Social monetization |

## Resources

- Story Protocol Docs: https://docs.story.foundation
- MLC API: https://api.ptl.themlc.com
- fal.ai Seedream: https://fal.ai/models/bytedance/seedream/v4/text-to-image
- Grove Storage: https://grove.storage
- Mechanical License Guide: https://www.themlc.com

## License

MIT
