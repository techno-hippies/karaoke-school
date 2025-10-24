# Karaoke School Pipeline Architecture Analysis

**Generated:** 2025-10-24
**Status:** Pre-production review before scaling

---

## Executive Summary

You have **4 modular pipelines** that work independently but connect together:

1. **CREATOR Pipeline** - TikTok creators → Lens accounts → video processing
2. **SONG Pipeline** - Genius API → metadata → Grove storage
3. **SEGMENT Pipeline** - Song → iconic segment selection → Demucs → fal.ai → Grove
4. **ARTIST Pipeline** - Artist accounts → blockchain registration → Lens

### Current State
- ✅ **Creators:** 5 onboarded (brookemonk_, idazeile, klarahellqvistt, notbrightemily, swiftysavvy)
- ✅ **Artists:** 2 registered (beyonce, taylorswift)
- ✅ **Songs:** 14 created (Genius metadata + Grove)
- ✅ **Segments:** 9 processed (TikTok segment → Demucs → fal.ai → Grove)
- ✅ **Services:** All working (SpotDL, SegmentSelector, LRCLIB, OpenRouter, etc.)

---

## Pipeline Architecture

### The Master Flow (What You Want)

```
TikTok Video URL
    ↓
1. Identify Song (Spotify ID from TikTok metadata)
    ↓
2. Check if Artist exists → Create if needed
    ↓
3. Check if Song exists → Create if needed
    ↓
4. Check if Segment exists → Create if needed
    ├─ Download song (SpotDL)
    ├─ Get lyrics (LRCLIB)
    ├─ Select iconic segment (Gemini)
    ├─ Crop segment
    ├─ Demucs separation
    ├─ fal.ai enhancement
    └─ Upload to Grove
    ↓
5. Check if Creator exists → Onboard if needed
    ↓
6. Process Video
    ├─ Download from TikTok
    ├─ STT + translations
    ├─ Upload to Grove
    └─ Save manifest
    ↓
7. Mint on Story Protocol (optional)
    ↓
8. Post to Lens with song reference
```

---

## Module Breakdown

### 1. CREATOR Pipeline (`modules/creators/`)

**What it does:** Onboards TikTok creators and processes their videos

**Modules:**
- `00-onboard-creator.ts` - **Master orchestrator** (PKP + Lens + scrape + identify)
- `01-mint-pkp.ts` - Create Lit Protocol wallet
- `02-create-lens.ts` - Create Lens account with translations
- `03-scrape-videos.ts` - Scrape TikTok videos (copyrighted + copyright-free)
- `04-identify-songs.ts` - Match videos to Spotify/Genius songs
- `05-process-video.ts` - Download, STT, translate, Grove upload
- `06-mint-derivative.ts` - Mint on Story Protocol (18/82 split)
- `07-post-lens.ts` - Post to Lens with metadata
- `08-process-all-videos.ts` - Batch process with resume/retry

**Data Structure:**
```
data/creators/{handle}/
├── pkp.json                     # Lit PKP wallet
├── lens.json                    # Lens account info
├── manifest.json                # Creator metadata
├── identified_videos.json       # Song identifications
├── progress.json                # Batch processing state
└── videos/{hash}/
    ├── manifest.json            # Video metadata
    ├── video.mp4                # Downloaded video (H.264)
    ├── audio.mp3                # Extracted audio
    └── thumbnail.jpg            # TikTok thumbnail
```

**Key Features:**
- ✅ Multilingual (EN, VI, ZH translations)
- ✅ Resume/retry for batch processing
- ✅ STT with word-level timestamps (ElevenLabs)
- ✅ Auto-converts videos to H.264 for Chrome

**Current Status:**
- 5 creators onboarded
- Multiple videos processed per creator
- Translations working
- Grove uploads working

---

### 2. SONG Pipeline (`modules/songs/`)

**What it does:** Fetches song metadata from Genius, creates Grove metadata

**Modules:**
- `01-create-song.ts` - Fetch from Genius, create Grove metadata
- `02-fetch-mlc-data.ts` - Fetch MLC (Mechanical License Collective) data
- `03-build-metadata.ts` - Build metadata for Grove upload

**Data Structure:**
```
data/songs/{geniusId}.json

Schema:
{
  "geniusId": 8434253,
  "title": "Anti-Hero",
  "artist": "Taylor Swift",
  "geniusArtistId": 1177,
  "spotifyId": "",  // ⚠️ Often missing
  "duration": 180,
  "coverUrl": "https://...",
  "metadataUri": "lens://...",
  "createdAt": "2025-10-22T13:20:08.409Z"
}
```

**Current Status:**
- 14 songs created
- Grove metadata uploaded
- ⚠️ Spotify IDs often missing (manual input required)

---

### 3. SEGMENT Pipeline (`modules/segments/`)

**What it does:** Creates karaoke segments (iconic 20-40s) from songs

**Modules:**
- `01-create-segment.ts` - Basic segment creation
- `01-match-and-process.ts` - **Full pipeline** (download → match → Demucs → fal.ai → Grove)
- `02-mint-segment-ip-asset.ts` - Mint segment on Story Protocol
- `02-register-segment.ts` - Register on blockchain
- `build-segment-metadata-v2.ts` - Build Grove metadata

**Current Flow (OLD - Manual):**
```
User provides:
  1. Genius ID
  2. TikTok music URL (with ~30s segment)
    ↓
Download TikTok segment
    ↓
Find/download full song (local library or Tidal)
    ↓
Match TikTok segment → full song timestamps (Gemini)
    ↓
Crop matched segment
    ↓
Demucs separation
    ↓
fal.ai enhancement
    ↓
Upload to Grove
```

**New Flow (AUTOMATED - What You Want):**
```
Input: Spotify ID + Genius ID
    ↓
Download full song (SpotDL) ✅ NEW
    ↓
Get lyrics (LRCLIB) ✅ NEW
    ↓
Ask Gemini: "Select iconic 20-40s" ✅ NEW
    ↓
Crop segment
    ↓
Demucs separation (existing)
    ↓
fal.ai enhancement (existing)
    ↓
Upload to Grove (existing)
```

**Data Structure:**
```
data/segments/{hash}/
├── manifest.json                # Segment metadata
├── tiktok_clip.mp4             # Original TikTok clip (OLD flow)
├── cropped.flac                # Cropped segment
├── vocals.mp3                  # Demucs separated vocals
├── instrumental.mp3            # Demucs separated instrumental
├── instrumental_enhanced.mp3   # fal.ai enhanced
└── match.json                  # Match results
```

**Current Status:**
- 9 segments processed (old manual flow)
- ✅ NEW: SpotDL service ready
- ✅ NEW: SegmentSelector service ready
- ⚠️ Need to build automated flow

---

### 4. ARTIST Pipeline (`modules/artists/`)

**What it does:** Registers artists on blockchain + Lens

**Modules:**
- `01-mint-pkp.ts` - Create Lit PKP wallet
- `01-register-artist.ts` - Register on ArtistRegistryV1 contract
- `02-create-lens.ts` - Create Lens account
- `03-register-artist.ts` - Full registration flow

**Data Structure:**
```
data/artists/{handle}/
├── pkp.json         # Lit PKP wallet
├── lens.json        # Lens account
└── manifest.json    # Artist metadata
```

**Current Status:**
- 2 artists registered (beyonce, taylorswift)
- Blockchain registration working
- Lens accounts created

---

## Data Storage Patterns

### V1 (Legacy - Directory-based)
```
data/songs/{geniusId}/
├── metadata.json
├── manifest.json
└── original.flac
```

### V2 (Current - File-based)
```
data/songs/{geniusId}.json
```

**Unified Account Pattern:**
```
data/accounts/{username}.json
```

---

## Services (External APIs)

### ✅ Production Ready
- **SpotDL** - Download songs from Spotify (FLAC)
- **LRCLIB** - Fetch synced lyrics
- **SegmentSelector** - AI segment selection (Gemini Flash 2.5 Lite)
- **OpenRouter** - LLM API (Gemini)
- **ElevenLabs** - STT with word-level timestamps
- **Grove** - Decentralized storage (Lens)
- **Demucs** - Vocal separation (Modal.com)
- **fal.ai** - Audio-to-audio enhancement
- **Story Protocol** - IP asset minting
- **TikTok Scraper** - Video metadata/download

### ⚠️ Partially Working
- **Tidal Downloader** - Endpoint changed, needs fixing (but SpotDL works)

---

## Missing Connections

### 1. ✅ Automated Segment Creation (COMPLETED)
**Status:** Fully implemented and integrated
**Location:** `modules/segments/auto-create-segment.ts`

**Features:**
- SpotDL download (FLAC, 23MB avg)
- LRCLIB synced lyrics fetch
- Gemini AI segment selection (20-40s, iconic parts)
- ElevenLabs STT word-level alignment
- Demucs vocal separation (Modal H100)
- fal.ai audio enhancement
- Grove upload + translations (VI, ZH)

**Usage:**
```bash
bun modules/segments/auto-create-segment.ts \
  --genius-id 8434253 \
  --spotify-id 0V3wPSX9ygBnCm8psDIegu
```

**Integrated into video processing:**
```bash
# Automatically creates segment if missing
bun modules/creators/05-process-video.ts \
  --tiktok-handle @creator \
  --video-id 123 \
  --create-segment
```

### 2. ✅ Song → Segment Linking (COMPLETED)
**Status:** Fully integrated into video processing
**Location:** `modules/creators/05-process-video.ts:532-566`

**How it works:**
1. Video processing identifies song (Genius ID + Spotify ID)
2. Checks if segment exists for song
3. If missing and `--create-segment` flag → auto-creates segment
4. Links video to segment in manifest

### 3. ⚠️ Artist Auto-Creation
**Current:** Artists created manually
**Needed:** Auto-create artist when processing first song

**Solution:**
```typescript
// Check if artist exists
const artistPath = paths.artist(artistHandle);
if (!existsSync(artistPath)) {
  // Create artist
  await createArtist(geniusArtistId, artistName);
}
```

### 4. ⚠️ Spotify ID Population
**Current:** Songs created without Spotify IDs
**Needed:** Fetch Spotify ID during song creation

**Fix:** Add Spotify API call to `01-create-song.ts`

---

## Cleanup Tasks

### HIGH PRIORITY

1. **Build Auto-Segment Pipeline**
   - Create `modules/segments/auto-create-segment.ts`
   - Integrate SpotDL + SegmentSelector
   - Test end-to-end

2. **Update Video Processing Integration**
   - Modify `05-process-video.ts` to call auto-segment
   - Remove manual TikTok segment URL requirement

3. **Add Spotify ID Fetching**
   - Update `songs/01-create-song.ts` to fetch Spotify ID
   - Use Spotify Web API or search

4. **Auto-Artist Creation**
   - Add artist existence check in video processing
   - Auto-create if missing

### MEDIUM PRIORITY

5. **Fix Tidal Downloader** (or deprecate in favor of SpotDL)
   - API endpoint changed
   - Either fix or remove

6. **Clean Up Old Segment Flow**
   - Archive `01-match-and-process.ts` old logic
   - Document migration path

7. **Unify Data Schemas**
   - Some files use V1 (directory-based)
   - Migrate all to V2 (file-based)

### LOW PRIORITY

8. **Add Export Services**
   - Export to index services
   - Update README

9. **Add Caching Layer** (optional)
   - Cache Spotify lookups
   - Cache LRCLIB results

10. **Testing Suite**
    - Add integration tests
    - Test full pipeline end-to-end

---

## Recommended Next Steps

### Phase 1: Complete Auto-Segment Flow (1-2 days)

1. Build `modules/segments/auto-create-segment.ts`
   ```bash
   # Usage:
   bun modules/segments/auto-create-segment.ts \
     --genius-id 8434253 \
     --spotify-id 0V3wPSX9ygBnCm8psDIegu
   ```

2. Test with Anti-Hero
   ```bash
   # Should:
   # - Download via SpotDL
   # - Get lyrics from LRCLIB
   # - Select segment with Gemini
   # - Process with Demucs + fal.ai
   # - Upload to Grove
   ```

3. Update `05-process-video.ts` to use it
   ```typescript
   if (manifest.song.spotifyId && manifest.song.geniusId) {
     await autoCreateSegment(
       manifest.song.geniusId,
       manifest.song.spotifyId
     );
   }
   ```

### Phase 2: Add Spotify ID Fetching (1 day)

1. Add Spotify search to `songs/01-create-song.ts`
2. Test with existing songs
3. Backfill missing Spotify IDs

### Phase 3: Auto-Artist Creation (1 day)

1. Add artist check in video processing
2. Auto-create artist if missing
3. Test full flow

### Phase 4: Test End-to-End (1 day)

1. Pick a new TikTok video
2. Run full pipeline:
   ```bash
   # Should automatically:
   # - Create artist (if new)
   # - Create song (if new)
   # - Create segment (if new)
   # - Process video
   # - Mint + Post
   ```

---

## File Organization

### Clean Structure ✅
```
master-pipeline/
├── modules/           # Pipeline modules (modular ✅)
│   ├── creators/      # 10 files (well organized)
│   ├── songs/         # 3 files (clean)
│   ├── segments/      # 6 files (needs consolidation)
│   └── artists/       # 4 files (clean)
├── services/          # 19 services (all working ✅)
├── lib/               # Helpers, schemas, config
└── data/              # Pipeline outputs
    ├── creators/      # 5 creators
    ├── artists/       # 2 artists
    ├── songs/         # 14 songs
    └── segments/      # 9 segments
```

### Needs Cleanup ⚠️
- `modules/segments/` has duplicate/old files
- Some old V1 patterns still present
- Tidal downloader service broken

---

## Key Insights

### ✅ What's Working Well

1. **Modularity** - Each pipeline step is isolated
2. **Resume/Retry** - Batch processing is robust
3. **Translations** - Multilingual support working
4. **Services** - All external APIs integrated
5. **Data Structure** - Clean JSON manifests

### ⚠️ What Needs Work

1. **Manual Steps** - Still require manual song/segment creation
2. **Missing Links** - Pipelines don't auto-trigger each other
3. **Spotify IDs** - Often missing in song metadata
4. **Segment Flow** - Old manual flow needs replacement

### 🎯 Goal State

```bash
# User runs ONE command:
bun process-video --tiktok-url "https://tiktok.com/@creator/video/123"

# Pipeline automatically:
# 1. Identifies song (Spotify ID)
# 2. Creates artist (if new)
# 3. Creates song (if new)
# 4. Creates segment (if new) ← KEY MISSING PIECE
# 5. Creates creator (if new)
# 6. Processes video
# 7. Mints + Posts
```

**Estimate to reach goal:** 3-4 days of focused development

---

## Summary

**Current State:** You have all the **building blocks** working independently:
- ✅ Creator onboarding
- ✅ Video processing
- ✅ Song metadata
- ✅ Manual segment processing
- ✅ SpotDL download
- ✅ AI segment selection

**Missing:** The **glue code** to connect them automatically:
- ⚠️ Auto-create segments from Spotify ID
- ⚠️ Auto-create artists when needed
- ⚠️ Auto-create songs when needed

**Recommendation:** Build `auto-create-segment.ts` first (Phase 1), then add auto-triggering logic to video processing. This gets you to full automation in ~3-4 days.
