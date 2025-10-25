# Karaoke School Master Pipeline

**TikTok creator video processing pipeline with blockchain provenance and multilingual support**

## 🎯 What This Does

Processes TikTok creator videos into karaoke-ready content:
1. **Identify songs** from TikTok videos (Spotify/Genius matching)
2. **Auto-create artist accounts** if they don't exist
3. **Auto-register songs** on blockchain if new
4. **Process videos**: Download, transcribe (STT), translate (vi/zh), upload to Grove
5. **Create karaoke segments**: Vocal separation + fal.ai enhancement
6. **Post to Lens** with translated metadata
7. **Optional**: Mint as IP Assets on Story Protocol

## ⚡ Recommended Workflows

**For batch processing (EASIEST):**
```bash
# Complete workflow with artist auto-creation
bun modules/creators/08-process-all-videos.ts --tiktok-handle @creator --parallel 2
```

**For single video:**
```bash
# Step 1: Create artist if new (manual check required)
bun modules/creators/10-auto-create-artist.ts --genius-id 498 --genius-artist-name "Artist"

# Step 2: Complete video workflow
bun modules/creators/09-video-upload-flow.ts --tiktok-handle @creator --video-id 7123456789
```

**Architecture:**
- `05-process-video.ts` = Partial (download/transcribe only)
- `09-video-upload-flow.ts` = Complete single video (song + segment + lens)
- `08-process-all-videos.ts` = Complete batch (auto-creates artists + uses 09 for each video)

## 🏗️ Architecture

### V2 Event-Driven System (Current)
```
Action → Emit Event (Lens Chain) → The Graph indexes → Query via GraphQL
```

**Storage:**
- Metadata & Media: Grove (IPFS via Lens Storage)
- On-chain: Events only (EventRegistry contract)
- Index: The Graph subgraph

**Key Benefit**: No expensive contract storage, events are cheap, The Graph handles querying

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Fill in: PRIVATE_KEY, GENIUS_API_KEY, etc.

# Python environment (for TikTok scraping)
cd .. && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### Process Videos for a Creator

**Single Video (Complete Pipeline):**

```bash
# 1. Scrape creator's videos
bun modules/creators/03-scrape-videos.ts --tiktok-handle @idazeile

# 2. Identify songs (Spotify/Genius matching)
bun modules/creators/04-identify-songs.ts --tiktok-handle @idazeile

# 3. Auto-create artist if needed (run once per new artist)
bun modules/creators/10-auto-create-artist.ts \
  --genius-id 498 \
  --genius-artist-name "Billy Joel"

# 4. Process video with COMPLETE WORKFLOW
bun modules/creators/09-video-upload-flow.ts \
  --tiktok-handle @idazeile \
  --video-id 7545183541190053142

# What 09-video-upload-flow does:
# ✅ Downloads video + thumbnail (via 05-process-video.ts)
# ✅ Extracts audio
# ✅ Transcribes audio (ElevenLabs STT)
# ✅ Translates captions (en → vi, zh)
# ✅ Translates description (en → vi, zh)
# ✅ Uploads to Grove
# ✅ Registers song to subgraph (via 01-register-song.ts)
# ✅ Creates karaoke segment (via 01-match-and-process.ts)
# ✅ Posts to Lens with translations (via 07-post-lens.ts)

# Skip optional steps:
bun modules/creators/09-video-upload-flow.ts \
  --tiktok-handle @idazeile \
  --video-id 7545183541190053142 \
  --skip-segment \
  --skip-lens

# 5. (Optional) Mint on Story Protocol
bun modules/creators/06-mint-derivative.ts \
  --tiktok-handle @idazeile \
  --video-hash <hash-from-manifest>
```

### Batch Process All Videos

```bash
# Process all videos with FULL AUTO-CREATION
# ✅ Auto-creates all artists first
# ✅ Uses 09-video-upload-flow.ts for each video
# ✅ Progress tracking and resume capability
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --parallel 2

# Resume if interrupted
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --resume

# Retry failed videos
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @idazeile \
  --retry-failed
```

---

## 📁 Project Structure

```
master-pipeline/
├── modules/           # Main pipeline modules
│   ├── accounts/      # Unified account system
│   ├── artists/       # Artist creation (PKP + Lens + Registry)
│   ├── creators/      # Creator video processing (main workflow)
│   ├── songs/         # Song registration
│   └── segments/      # Karaoke segment processing
│
├── services/          # Reusable services
│   ├── grove.ts              # Grove/IPFS storage
│   ├── tiktok.ts             # TikTok scraping & parsing
│   ├── song-identification.ts # Spotify/Genius matching
│   ├── elevenlabs.ts         # Speech-to-text (STT)
│   ├── translation.ts        # Google Translate API
│   ├── story-protocol.ts     # Story Protocol minting
│   └── ...
│
├── lib/               # Shared utilities
│   ├── schemas/       # Zod validation schemas
│   │   ├── grove/     # Grove metadata schemas
│   │   ├── creator.ts # Creator manifest schema
│   │   ├── segment.ts # Segment schema
│   │   └── song.ts    # Song schema
│   ├── event-emitter.ts      # Event emission helper
│   ├── subgraph.ts           # The Graph queries
│   ├── lens.ts               # Lens Protocol helpers
│   └── ...
│
├── data/              # Output data (gitignored)
│   ├── creators/      # Creator data
│   │   └── {handle}/
│   │       ├── pkp.json
│   │       ├── lens.json
│   │       ├── manifest.json
│   │       ├── identified_videos.json
│   │       ├── progress.json
│   │       └── videos/
│   │           └── {hash}/
│   │               ├── video.mp4
│   │               ├── audio.mp3
│   │               └── manifest.json
│   ├── songs/         # Song metadata
│   └── segments/      # Segment processing outputs
│
└── README.md (this file)
```

---

## 🎬 Modules Guide

### Creators Module (Main Workflow)

Complete creator onboarding and video processing pipeline.

#### 00-onboard-creator.ts
**Complete creator onboarding in one command**

```bash
bun modules/creators/00-onboard-creator.ts --tiktok-handle @creator
```

Steps:
1. Mints PKP wallet (Lit Protocol)
2. Creates Lens account with translated bio (en, vi, zh)
3. Scrapes TikTok videos
4. Identifies songs via Spotify/Genius
5. Checkpoint-based resume on failure

#### 03-scrape-videos.ts
**Scrape TikTok videos**

```bash
bun modules/creators/03-scrape-videos.ts \
  --tiktok-handle @creator \
  --video-limit 100
```

#### 04-identify-songs.ts
**Identify songs from scraped videos**

```bash
bun modules/creators/04-identify-songs.ts --tiktok-handle @creator
```

Uses Spotify/Genius matching to identify music in videos.

#### 05-process-video.ts
**Download and process video (partial workflow)**

```bash
bun modules/creators/05-process-video.ts \
  --tiktok-handle @creator \
  --video-id 7545183541190053142
```

**Note: This is a PARTIAL workflow. Use 09-video-upload-flow.ts for complete processing.**

This script only:
- Downloads video + thumbnail
- Transcribes audio (STT)
- Translates captions & description (vi, zh)
- Uploads to Grove
- Creates manifest with all metadata

Does NOT:
- Register songs
- Create segments
- Post to Lens

#### 09-video-upload-flow.ts
**Complete single video workflow (RECOMMENDED)**

```bash
bun modules/creators/09-video-upload-flow.ts \
  --tiktok-handle @creator \
  --video-id 7545183541190053142
```

This is the **complete workflow orchestrator** for single videos. It:
- Processes video (calls 05-process-video.ts)
- Registers song to subgraph (calls 01-register-song.ts)
- Creates karaoke segment (calls 01-match-and-process.ts)
- Posts to Lens (calls 07-post-lens.ts)

**Note: You must create artist first using 10-auto-create-artist.ts if new artist**

#### 08-process-all-videos.ts
**Batch process with auto-artist creation**

```bash
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @creator \
  --parallel 2 \
  --resume
```

This is the **most complete workflow** - handles everything automatically:
- Auto-creates all artists FIRST (calls 10-auto-create-artist.ts for each)
- Processes all videos (calls 09-video-upload-flow.ts for each)
- Parallel processing (configurable concurrency)
- Progress tracking with `progress.json`
- Resume capability on failure
- Retry failed videos
- Rate limiting

#### 10-auto-create-artist.ts
**Auto-create artist if doesn't exist**

Called automatically by `05-process-video.ts`.  Can also be run manually:

```bash
bun modules/creators/10-auto-create-artist.ts \
  --genius-id 498 \
  --genius-artist-name "Beyoncé"
```

Checks The Graph subgraph, creates artist if not found.

---

### Songs Module

#### 01-create-song.ts
**Create song with Grove metadata (V2)**

```bash
bun modules/songs/01-create-song.ts \
  --genius-id 10047250 \
  --artist-username beyonce \
  --emit-event
```

Creates song with:
- Grove metadata (immutable)
- Optional artist account link
- Event emission for The Graph

#### 02-fetch-mlc-data.ts
**Fetch MLC licensing data**

```bash
bun modules/songs/02-fetch-mlc-data.ts --genius-id 10047250
```

Fetches publishers, writers, ISRC from MLC API.

#### 03-build-metadata.ts
**Build complete metadata JSON**

```bash
bun modules/songs/03-build-metadata.ts --genius-id 10047250
```

Combines Genius + MLC + lyrics into complete metadata.

---

### Segments Module

#### 01-match-and-process.ts
**Process TikTok karaoke segment**

```bash
bun modules/segments/01-match-and-process.ts \
  --genius-id 8434253 \
  --tiktok-url "https://www.tiktok.com/music/..."
```

Full segment pipeline:
1. Extract TikTok music ID
2. Match TikTok segment to original song (audio fingerprinting)
3. Crop segment
4. Demucs vocal separation
5. fal.ai enhancement
6. ElevenLabs forced alignment (word timestamps)
7. Upload to Grove
8. Emit events for The Graph

#### auto-create-segment.ts
**Auto-create segment without TikTok URL**

```bash
bun modules/segments/auto-create-segment.ts \
  --genius-id 8434253 \
  --spotify-id 0V3wPSX9ygBnCm8psDIegu
```

Automatically:
1. Downloads full song (SpotDL)
2. Fetches lyrics (LRCLIB)
3. AI selects iconic segment (Gemini Flash 2.5 Lite)
4. Processes segment (Demucs + fal.ai)
5. Uploads to Grove

---

### Artists Module

#### create-artist.ts
**Unified artist creation wrapper**

```bash
bun modules/artists/create-artist.ts \
  --name taylorswift \
  --genius-id 498 \
  --display-name "Taylor Swift" \
  --isni 0000000078519858
```

Calls unified account system (accounts/01-create-account.ts) with verification.

#### Individual Steps (if needed)
```bash
# Step 1: Mint PKP
bun modules/artists/01-mint-pkp.ts --name taylorswift

# Step 2: Create Lens account
bun modules/artists/02-create-lens.ts --name taylorswift --genius-id 498

# Step 3: Emit registry event
bun modules/artists/03-register-artist.ts --name taylorswift --genius-id 498
```

---

## 🌍 Translation Support

All creator bios, video descriptions, and captions are automatically translated to:
- Vietnamese (vi)
- Mandarin Chinese (zh)

Translations are stored in Lens metadata and Grove manifests.

### Translation Data Structure

**Creator Bio:**
```json
{
  "bio": "IG @idazeile 🧚🏼",
  "attributes": [{
    "type": "JSON",
    "key": "bioTranslations",
    "value": "{\"vi\":\"...\",\"zh\":\"...\"}"
  }]
}
```

**Video Captions:**
```json
{
  "captions": {
    "en": "Original English text",
    "vi": "Vietnamese translation",
    "zh": "Mandarin translation"
  }
}
```

---

## 📊 Progress Tracking

Batch processing creates `data/creators/{handle}/progress.json`:

```json
{
  "creatorHandle": "idazeile",
  "startedAt": "2025-10-23T20:00:00.000Z",
  "totalVideos": 50,
  "completed": 45,
  "failed": 3,
  "skipped": 2,
  "videos": {
    "7545183541190053142": {
      "status": "completed",
      "videoHash": "2b0b7deaa241de09",
      "retryCount": 0,
      "steps": {
        "download": true,
        "stt": true,
        "translate": true,
        "grove": true
      }
    }
  }
}
```

Status: `pending`, `processing`, `completed`, `failed`, `skipped`

---

## 🔧 Configuration

### Environment Variables

```bash
# Blockchain
PRIVATE_KEY=0x...
BACKEND_WALLET_ADDRESS=0x...

# APIs
GENIUS_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
ELEVENLABS_API_KEY=...
OPENROUTER_API_KEY=...
FAL_KEY=...
GOOGLE_TRANSLATE_API_KEY=...

# The Graph
SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../...

# Story Protocol (optional)
STORY_SPG_NFT_CONTRACT=0x...

# Python
DOTENV_PRIVATE_KEY=... (for dotenvx encryption)
```

### Rate Limiting

Recommended settings for batch processing:
- Serial: `--rate-limit 2000` (2 seconds)
- Parallel (2-3): `--rate-limit 3000` (3 seconds)
- Parallel (4+): `--rate-limit 5000` (5 seconds)

---

## 🧪 Testing

```bash
# Test single video processing
bun modules/creators/05-process-video.ts \
  --tiktok-handle @testcreator \
  --video-id 7545183541190053142

# Test artist auto-creation
bun modules/creators/10-auto-create-artist.ts \
  --genius-id 498 \
  --genius-artist-name "Taylor Swift"

# Test song creation
bun modules/songs/01-create-song.ts \
  --genius-id 10047250
```

---

## 🐛 Troubleshooting

### Resume After Failure
```bash
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @creator \
  --resume
```

### Clear Progress and Start Fresh
```bash
rm data/creators/{handle}/progress.json
bun modules/creators/08-process-all-videos.ts --tiktok-handle @creator
```

### Check Failed Videos
```bash
cat data/creators/{handle}/progress.json | \
  jq '.videos | to_entries[] | select(.value.status == "failed")'
```

### Retry Specific Video
```bash
bun modules/creators/05-process-video.ts \
  --tiktok-handle @creator \
  --video-id 7545183541190053142
```

---

## 📚 Additional Documentation

- [CREATOR_PIPELINE_GUIDE.md](./CREATOR_PIPELINE_GUIDE.md) - Complete guide to creator workflows
- [CLEANUP_ANALYSIS.md](./CLEANUP_ANALYSIS.md) - Technical architecture analysis
- [PIPELINE_ANALYSIS.md](./PIPELINE_ANALYSIS.md) - Detailed pipeline breakdown

---

## 🎯 Common Use Cases

### Use Case 1: Process New Creator's Videos
```bash
# Onboard creator
bun modules/creators/00-onboard-creator.ts --tiktok-handle @newcreator

# Process all videos
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @newcreator \
  --parallel 2
```

### Use Case 2: Process Single Video
```bash
# Scrape if needed
bun modules/creators/03-scrape-videos.ts --tiktok-handle @creator

# Identify songs
bun modules/creators/04-identify-songs.ts --tiktok-handle @creator

# Create artist if new (check The Graph first)
bun modules/creators/10-auto-create-artist.ts \
  --genius-id 498 \
  --genius-artist-name "Billy Joel"

# Process video with complete workflow
bun modules/creators/09-video-upload-flow.ts \
  --tiktok-handle @creator \
  --video-id 7545183541190053142
```

### Use Case 3: Create Artist Manually
```bash
bun modules/artists/create-artist.ts \
  --name beyonce \
  --genius-id 498 \
  --display-name "Beyoncé" \
  --isni 0000000078519858
```

### Use Case 4: Create Song + Segment Manually
```bash
# Create song
bun modules/songs/01-create-song.ts \
  --genius-id 10047250 \
  --artist-username beyonce

# Auto-create segment (AI selects iconic part)
bun modules/segments/auto-create-segment.ts \
  --genius-id 10047250 \
  --spotify-id 0V3wPSX9ygBnCm8psDIegu
```

---

## 🚦 Development Status

**Current Architecture**: V2 Event-Driven System ✅
- Uses The Graph for querying
- Grove for storage
- Lens Chain EventRegistry for events

**Deprecated**: V1 Direct Contract System ❌
- Base Sepolia contracts (ArtistRegistryV1, SongRegistryV1, SegmentRegistryV1)
- Direct contract storage (expensive)
- Files removed in cleanup

---

## 📝 License

MIT

---

**Questions?** See [CREATOR_PIPELINE_GUIDE.md](./CREATOR_PIPELINE_GUIDE.md) for detailed workflows.
