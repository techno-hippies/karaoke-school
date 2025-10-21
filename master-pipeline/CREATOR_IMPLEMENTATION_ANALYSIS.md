# Creator Flow Implementation Analysis

## Overview

This document analyzes how to adapt the **master-pipeline** (built for musicians like Beyoncé) for **TikTok creators** while maintaining the **18%/82% Story Protocol revenue split** from `pkp-lens-flow/local/17-mint-story-ip-assets.ts`.

---

## ✅ What's Already Built

### 1. **Core Services (Ready to Reuse)**

All critical services are already implemented in `master-pipeline/services/`:

| Service | Status | Notes |
|---------|--------|-------|
| **Story Protocol** | ✅ Ready | 18%/82% split implemented (line 306-317) |
| **Audio Matching** | ✅ Ready | Complete pipeline: Voxtral → ElevenLabs → Gemini |
| **Demucs** | ✅ Ready | Modal H200 GPU separation, ~30s processing |
| **Grove Storage** | ✅ Ready | Lens Network storage client |
| **TikTok** | ⚠️ Partial | Music page scraping only (needs video scraper) |
| **PKP/Lens** | ✅ Ready | Identical for artists and creators |

### 2. **Type Definitions** (`lib/types.ts`)

**ALL creator types already exist** (lines 185-308):

```typescript
✅ CreatorPKP
✅ CreatorIdentifiers (tiktokHandle, instagramHandle, etc.)
✅ CreatorLens
✅ CreatorManifest
✅ VideoManifest (with MLCData, StoryProtocol, Lens fields)
```

### 3. **Zod Schemas** (NEW: `lib/schemas/creator.ts`)

Just created comprehensive validation schemas:
- `CreatorPKPSchema`, `CreatorLensSchema`, `CreatorManifestSchema`
- `VideoManifestSchema` with full validation
- `SongIdentificationResultSchema` for Spotify matching
- Exported in `lib/schemas/index.ts`

---

## 🔑 The 18%/82% Split Implementation

### **Comparison: pkp-lens-flow vs master-pipeline**

#### **pkp-lens-flow/local/17-mint-story-ip-assets.ts** (Original)

```typescript
// Lines 170-189
creators: [
  {
    name: tiktokHandle,
    address: walletAddress,
    contributionPercent: 18,  // ← Creator
    role: 'derivative_performer',
    description: 'User-generated performance video creator',
  },
  {
    name: primaryArtists.join(' & '),
    address: zeroAddress,
    contributionPercent: 82,  // ← Rights holders
    role: 'original_rights_holder',
    description: 'Original artist(s) and rights holder(s)',
  },
]

// Lines 550-558: Commercial Remix License
licenseTermsData: [
  {
    terms: PILFlavor.commercialRemix({
      defaultMintingFee: 0,
      commercialRevShare: 18, // ← 18% paid back by derivatives
      currency: currency,
    }),
  },
]

// Lines 573-595: Royalty Token Transfer
await client.ipAccount.transferErc20({
  ipId: response.ipId,
  tokens: [{
    address: vaultAddress,
    amount: 82,  // ← Transfer 82 tokens to Safe
    target: safeWallet,
  }],
});
```

#### **master-pipeline/services/story-protocol.ts** (Current)

```typescript
// Lines 303-318: buildSongMetadata() - EXACT SAME STRUCTURE
creators: [
  {
    name: params.creatorName,
    address: params.creatorAddress,
    contributionPercent: 18,  // ✅ Same
    role: 'derivative_performer',
    description: 'User-generated performance video creator',
  },
  {
    name: params.artist,
    address: zeroAddress,
    contributionPercent: 82,  // ✅ Same
    role: 'original_rights_holder',
    description: 'Original artist(s) and rights holder(s)',
  },
],

// Lines 196-204: mintIPAsset() - EXACT SAME LICENSE
terms: PILFlavor.commercialRemix({
  defaultMintingFee: mintingFee,
  commercialRevShare, // ← Default 18%
  currency: currency as Address,
}),

// Lines 259-267: setupRoyaltySplit() - EXACT SAME TRANSFER
await this.client.ipAccount.transferErc20({
  ipId,
  tokens: [{
    address: vaultAddress as Address,
    amount: 100 - creatorShare, // ← 82 to Safe
    target: this.config.safeWallet,
  }],
});
```

### **✅ Verdict: Story Protocol Service is Production-Ready**

The `StoryProtocolService` in master-pipeline **already implements the exact same 18%/82% split** as pkp-lens-flow. No changes needed!

---

## 🆕 What Needs to be Created

Based on `CREATOR_FLOW_DESIGN.md` and `FLOW_COMPARISON.md`:

### **1. TikTok Video Scraper** (NEW: `lib/tiktok_video_scraper.py`)

Extend existing `lib/tiktok_music_scraper.py` to scrape user video feeds:

```python
class TikTokVideoScraper:
    """Scrapes TikTok user video feeds using hrequests"""

    def scrape_user_videos(self, handle: str, limit: int = 50) -> List[Dict]:
        """
        Returns: [{
            'video_id': str,
            'url': str,
            'description': str,
            'music': {'id': str, 'title': str, 'author': str},
            'stats': {'views': int, 'likes': int}
        }]
        """

    def filter_karaoke_videos(self, videos: List[Dict]) -> List[Dict]:
        """Filter for karaoke/cover videos with copyrighted music"""

    def download_video(self, video_id: str, output_path: Path) -> bool:
        """Download full creator video"""
```

**Usage:**
```bash
python lib/tiktok_video_scraper.py @karaokeking99 --limit 50
```

### **2. Song Identification Service** (NEW: `services/song-identification.ts`)

```typescript
export class SongIdentificationService {
  /**
   * Identify song from TikTok music metadata
   * 1. Extract TikTok music ID from video
   * 2. Search Spotify by title + artist
   * 3. Fetch ISRC from Spotify track
   * 4. Optional: Search Genius for lyrics
   * 5. Fetch MLC licensing data by ISRC
   */
  async identifyFromTikTokMusic(
    musicId: string,
    musicTitle: string,
    musicArtist: string
  ): Promise<SongIdentificationResult>

  private async searchSpotify(title: string, artist: string): Promise<SpotifyTrack>
  private async getISRC(spotifyId: string): Promise<string>
  private async findInGenius(title: string, artist: string): Promise<number | null>
  private async fetchMLCData(isrc: string): Promise<MLCData | null>
}
```

**Reuses:** MLC logic from `modules/songs/02-fetch-mlc-data.ts`

### **3. Creator Modules** (NEW: `modules/creators/`)

7 new scripts following the artist flow pattern:

```bash
modules/creators/
├── 01-mint-pkp.ts           # --handle @karaokeking99
├── 02-create-lens.ts        # --handle karaokeking99 --display-name "Karaoke King"
├── 03-scrape-videos.ts      # --handle karaokeking99 --limit 50
├── 04-identify-songs.ts     # --handle karaokeking99 --video-hash a1b2c3d4
├── 05-process-video.ts      # --handle karaokeking99 --video-hash a1b2c3d4
├── 06-mint-derivative.ts    # --handle karaokeking99 --video-hash a1b2c3d4
└── 07-post-lens.ts          # --handle karaokeking99 --video-hash a1b2c3d4
```

**Automation Script:** `scripts/process-creator-full.sh`
```bash
#!/bin/bash
HANDLE=$1
VIDEO_HASH=$2

bun run creators/04-identify-songs.ts --handle $HANDLE --video-hash $VIDEO_HASH && \
bun run creators/05-process-video.ts --handle $HANDLE --video-hash $VIDEO_HASH && \
bun run creators/06-mint-derivative.ts --handle $HANDLE --video-hash $VIDEO_HASH && \
bun run creators/07-post-lens.ts --handle $HANDLE --video-hash $VIDEO_HASH
```

---

## 🔄 Flow Comparison

### **Artist Flow** (Current)
```
Genius Artist ID + TikTok Music URL
│
├─ Mint PKP (genius-id)
├─ Create Lens (artist metadata: ISNI, IPI, MusicBrainz)
├─ Register Artist (ArtistRegistryV1)
│
└─ FOR EACH SONG:
   ├─ Register Song (Genius metadata)
   ├─ Fetch MLC Licensing (ISRC-based)
   ├─ Build Metadata (LRCLib lyrics)
   │
   └─ FOR EACH TIKTOK SEGMENT:
      ├─ Match & Process (Voxtral → ElevenLabs → Gemini)
      ├─ Demucs Separation (Modal H200)
      ├─ Upload to Grove
      └─ Register Segment (SegmentRegistryV1)
```

### **Creator Flow** (NEW)
```
TikTok Handle
│
├─ Mint PKP (tiktok-handle)
├─ Create Lens (creator metadata: Instagram, YouTube)
├─ Scrape TikTok Videos (hrequests)
│
└─ FOR EACH VIDEO:
   ├─ Identify Song (TikTok music → Spotify → ISRC → MLC)
   ├─ Process Video (same audio matching pipeline)
   ├─ Demucs Separation (same Modal H200)
   ├─ Upload to Grove
   ├─ Mint Derivative on Story Protocol (18%/82% split) ← NEW
   └─ Post to Lens with attribution ← NEW
```

### **Shared Components**
Both flows use:
- `lib/pkp.ts` → PKP minting
- `lib/lens.ts` → Lens account creation
- `services/audio-matching.ts` → Complete matching pipeline
- `services/demucs-modal.ts` → Vocal separation
- `services/grove.ts` → Storage
- MLC licensing logic (ISRC-based search)

### **Key Differences**

| Aspect | Artist Flow | Creator Flow |
|--------|-------------|--------------|
| **Primary ID** | Genius Artist ID | TikTok Handle |
| **Content Source** | TikTok Music Pages | TikTok User Videos |
| **IP Role** | Original Rights Holder | Derivative Creator |
| **Smart Contracts** | Artist/Song/Segment Registries | Segment + Story IP |
| **Licensing** | MLC Publisher Shares | Reference to Original |
| **Story Protocol** | Optional (if eligible) | **Required** (derivatives) |
| **Genius Integration** | Required | Optional |

---

## 📋 Implementation Checklist

### Phase 1: Foundation (Week 1)
- [x] **Zod Schemas** (`lib/schemas/creator.ts`) ✅ DONE
- [ ] **TikTok Video Scraper** (`lib/tiktok_video_scraper.py`)
  - User feed scraping with hrequests
  - Karaoke video filtering
  - Video download with metadata
- [ ] **Song Identification Service** (`services/song-identification.ts`)
  - Spotify search by title + artist
  - ISRC extraction
  - MLC licensing fetch (reuse existing)

### Phase 2: Creator Identity (Week 1-2)
- [ ] `modules/creators/01-mint-pkp.ts`
- [ ] `modules/creators/02-create-lens.ts`
- [ ] `modules/creators/03-scrape-videos.ts`

### Phase 3: Video Processing (Week 2-3)
- [ ] `modules/creators/04-identify-songs.ts`
- [ ] `modules/creators/05-process-video.ts` (reuse audio-matching.ts)

### Phase 4: Story Protocol & Lens (Week 3-4)
- [ ] `modules/creators/06-mint-derivative.ts` (use StoryProtocolService)
- [ ] `modules/creators/07-post-lens.ts`
- [ ] `scripts/process-creator-full.sh` (automation)

### Phase 5: Testing (Week 4)
- [ ] End-to-end test with real TikTok creator
- [ ] Verify 18%/82% royalty split on Story Protocol
- [ ] Test with/without parent IP scenarios

---

## 🎯 Key Recommendations

### 1. **Reuse Existing Services**

**DO NOT duplicate code!** The master-pipeline already has production-ready services:

```typescript
// ✅ GOOD: Reuse audio matching
import { AudioMatchingService } from '../../services/audio-matching.js';

const audioMatch = new AudioMatchingService(config);
const result = await audioMatch.matchTikTokToSong(
  tiktokVideoPath,
  originalSongPath,
  lyrics
);
```

```typescript
// ❌ BAD: Don't rewrite from scratch
// Don't create a new "creator-audio-matching.ts"
```

### 2. **Story Protocol Integration Pattern**

For `modules/creators/06-mint-derivative.ts`:

```typescript
import { StoryProtocolService } from '../../services/story-protocol.js';
import { GroveService } from '../../services/grove.js';

// 1. Build metadata (reuse existing helper)
const metadata = StoryProtocolService.buildSongMetadata({
  title: video.song.title,
  description: `Karaoke cover by ${creatorHandle}`,
  artist: video.song.artist,
  creatorName: creatorHandle,
  creatorAddress: creator.pkp.pkpEthAddress,
  imageUrl: video.grove.vocalsUri,
  mediaUrl: video.files.originalVideo,
  tiktokUrl: video.tiktokUrl,
  spotifyUrl: video.song.spotifyUrl,
  mlcData: video.licensing,
  copyrightType: 'derivative_performance',
});

// 2. Upload metadata to Grove
const grove = new GroveService();
const metadataUri = await grove.uploadJSON(metadata, {
  name: `story-metadata-${video.videoHash}.json`,
  acl: lensAccountOnly(creator.lens.lensAccountAddress),
});

// 3. Mint IP Asset with 18%/82% split
const story = new StoryProtocolService({
  privateKey: process.env.PRIVATE_KEY!,
  spgNftContract: process.env.STORY_SPG_NFT_CONTRACT!,
  safeWallet: process.env.SAFE_MULTISIG_ADDRESS!,
});

const result = await story.mintIPAsset({
  metadata,
  metadataUri,
  recipient: creator.pkp.pkpEthAddress,
  commercialRevShare: 18, // ← 18% to creator, 82% to Safe
});

// 4. Save to manifest
video.storyProtocol = {
  ipId: result.ipId,
  txHash: result.txHash,
  metadataUri: result.metadataUri,
  royaltyVault: result.royaltyVault,
  mintedAt: new Date().toISOString(),
};
```

### 3. **File Structure**

```
data/
└── creators/
    └── {tiktok-handle}/          # e.g., "karaokeking99"
        ├── manifest.json          # CreatorManifest
        ├── pkp.json               # CreatorPKP
        ├── lens.json              # CreatorLens
        └── videos/
            └── {video-hash}/      # e.g., "a1b2c3d4e5f6"
                ├── manifest.json  # VideoManifest
                ├── original.mp4   # Downloaded TikTok video
                ├── segment.mp4    # Cropped to matched timestamps
                ├── vocals.mp3     # Demucs separated
                ├── instrumental.mp3
                └── alignment.json # ElevenLabs word alignment
```

### 4. **Environment Variables**

Add to `.env`:

```bash
# Story Protocol (already exists)
STORY_RPC_URL=https://aeneid.storyrpc.io
STORY_SPG_NFT_CONTRACT=0x... # Reusable NFT collection
SAFE_MULTISIG_ADDRESS=0x...  # For 82% royalty split

# TikTok (if using official API)
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

---

## 🚀 Quick Start

### **1. Create a TikTok Creator**

```bash
# Setup identity
bun run creators/01-mint-pkp.ts --handle karaokeking99
bun run creators/02-create-lens.ts \
  --handle karaokeking99 \
  --display-name "Karaoke King" \
  --instagram karaokeking99

# Scrape videos
bun run creators/03-scrape-videos.ts --handle karaokeking99 --limit 20
```

### **2. Process a Video**

```bash
# Manual (step-by-step)
bun run creators/04-identify-songs.ts --handle karaokeking99 --video-hash abc123
bun run creators/05-process-video.ts --handle karaokeking99 --video-hash abc123
bun run creators/06-mint-derivative.ts --handle karaokeking99 --video-hash abc123
bun run creators/07-post-lens.ts --handle karaokeking99 --video-hash abc123

# Automated (all steps)
bash scripts/process-creator-full.sh karaokeking99 abc123
```

---

## 📊 Comparison with pkp-lens-flow

| Component | pkp-lens-flow | master-pipeline | Status |
|-----------|---------------|-----------------|--------|
| **PKP Minting** | 01-mint-pkp.ts | lib/pkp.ts | ✅ Same |
| **Lens Account** | 06-create-lens-account.ts | lib/lens.ts | ✅ Same |
| **Story Protocol** | 17-mint-story-ip-assets.ts | services/story-protocol.ts | ✅ **Same 18%/82%** |
| **Audio Processing** | Multiple scripts | services/audio-matching.ts | ✅ Unified |
| **MLC Licensing** | 15-fetch-mlc.ts | modules/songs/02-fetch-mlc-data.ts | ✅ Same logic |
| **Grove Storage** | 12-upload-grove.ts | services/grove.ts | ✅ Same |
| **TikTok Scraping** | N/A (manual) | lib/tiktok_music_scraper.py | ⚠️ Need video scraper |
| **Lens Posts** | 18-create-lens-posts.ts | modules/creators/07-post-lens.ts | ❌ TODO |

---

## ⚠️ Important Notes

### **1. Derivative Work Attribution**
All creator segments **MUST** reference the original song:
- MLC licensing data in metadata
- Story Protocol IP graph shows provenance
- Lens posts include attribution

### **2. Copyright Compliance**
- Creator owns **performance** (vocals)
- Original song owner retains **composition rights**
- Story Protocol manages licensing terms automatically

### **3. Licensing Transparency**
- Display publisher shares from MLC
- Show `storyMintable` status (≥98% shares required)
- Link to original song on Spotify/Genius

---

## ✅ Next Steps

1. **Implement TikTok Video Scraper** (`lib/tiktok_video_scraper.py`)
2. **Create Song Identification Service** (`services/song-identification.ts`)
3. **Build Creator Modules** (7 scripts in `modules/creators/`)
4. **Test End-to-End** with real TikTok creator
5. **Verify Story Protocol** 18%/82% split on Aeneid testnet

The foundation is **solid** - master-pipeline already has all the core services. You just need to add creator-specific logic for TikTok video processing and Story Protocol derivative minting.
