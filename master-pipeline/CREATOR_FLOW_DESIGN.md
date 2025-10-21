# Creator Flow Architecture

## Overview

The **Creator Flow** enables karaoke content creators (non-artists) to:
1. Create a PKP + Lens account using their TikTok handle
2. Scrape their TikTok karaoke videos
3. Automatically identify copyrighted songs used in videos
4. Process and upload karaoke segments as derivative works
5. Mint on Story Protocol with proper licensing metadata

## Key Differences from Artist Flow

| Aspect | Artist Flow | Creator Flow |
|--------|-------------|--------------|
| **Primary Identifier** | Genius Artist ID | TikTok Handle |
| **Source Content** | TikTok Music Pages (canonical segments) | TikTok User Videos (creator content) |
| **Content Ownership** | Original song rights holder | Derivative work creator |
| **Licensing** | Publisher shares from MLC | References original song licensing |
| **Story Protocol Role** | IP Owner | Derivative Minter |
| **Lens Metadata** | Artist identifiers (ISNI, IPI, MusicBrainz) | Creator social identifiers |

---

## Architecture Components

### 1. Creator Identity Model

**New Types** (add to `lib/types.ts`):

```typescript
export interface CreatorPKP {
  pkpPublicKey: string;
  pkpEthAddress: Address;
  pkpTokenId: string;
  ownerEOA: Address;
  network: string;
  mintedAt: string;
  transactionHash: Hex;
}

export interface CreatorIdentifiers {
  tiktokHandle: string;        // Primary identifier
  tiktokUserId?: string;        // TikTok API user ID
  instagramHandle?: string;
  youtubeChannelId?: string;
  spotifyCreatorId?: string;
}

export interface CreatorLens {
  lensHandle: string;           // Same as TikTok handle
  lensAccountAddress: Address;
  lensAccountId: Hex;
  network: string;
  createdAt: string;
  metadataUri: string;
  transactionHash: Hex;
}

export interface CreatorManifest {
  handle: string;               // TikTok handle (filesystem + Lens)
  displayName: string;          // Creator's display name
  identifiers: CreatorIdentifiers;
  pkp: CreatorPKP;
  lens: CreatorLens;
  videos: string[];             // Array of video hashes
  createdAt: string;
  updatedAt: string;
}
```

**File Structure**:
```
data/
└── creators/
    └── {tiktok-handle}/
        ├── manifest.json           # CreatorManifest
        ├── pkp.json                # CreatorPKP
        ├── lens.json               # CreatorLens
        └── videos/
            └── {video-hash}/
                ├── manifest.json   # VideoManifest
                ├── original.mp4
                ├── segment.mp4
                ├── vocals.mp3
                ├── instrumental.mp3
                └── match.json
```

---

### 2. Creator Pipeline Modules

**New modules** (create `modules/creators/`):

#### `modules/creators/01-mint-pkp.ts`
```typescript
// Similar to artists/01-mint-pkp.ts but takes --handle instead of --genius-id
bun run creators/01-mint-pkp.ts --handle @karaokeking99
```

#### `modules/creators/02-create-lens.ts`
```typescript
// Create Lens account with creator metadata
bun run creators/02-create-lens.ts \
  --handle karaokeking99 \
  --display-name "Karaoke King" \
  [--instagram @karaokeking99] \
  [--youtube UCxxx...]
```

#### `modules/creators/03-scrape-videos.ts`
```typescript
// Scrape creator's TikTok video feed
// Extract karaoke videos that use copyrighted music
bun run creators/03-scrape-videos.ts \
  --handle karaokeking99 \
  --limit 50
```

#### `modules/creators/04-identify-songs.ts`
```typescript
// For each video, identify the copyrighted song
// Match to Spotify ISRC and fetch MLC licensing
bun run creators/04-identify-songs.ts \
  --handle karaokeking99 \
  --video-hash a1b2c3d4
```

#### `modules/creators/05-process-video.ts`
```typescript
// Process creator's karaoke video
// Match to original song, separate vocals, upload to Grove
bun run creators/05-process-video.ts \
  --handle karaokeking99 \
  --video-hash a1b2c3d4
```

#### `modules/creators/06-mint-derivative.ts`
```typescript
// Mint on Story Protocol as derivative work
// Link to original song IP, register on SegmentRegistry
bun run creators/06-mint-derivative.ts \
  --handle karaokeking99 \
  --video-hash a1b2c3d4
```

#### `modules/creators/07-post-lens.ts`
```typescript
// Post to Lens with metadata
bun run creators/07-post-lens.ts \
  --handle karaokeking99 \
  --video-hash a1b2c3d4
```

---

### 3. TikTok Video Scraper

**New file**: `lib/tiktok_video_scraper.py`

Extends existing `tiktok_music_scraper.py` to scrape user video feeds.

```python
class TikTokVideoScraper:
    """Scrapes TikTok user video feeds"""

    def scrape_user_videos(self, handle: str, limit: int = 50) -> List[Dict]:
        """
        Scrape creator's video feed

        Returns:
            List of videos: [{
                'video_id': str,
                'url': str,
                'description': str,
                'music': {
                    'id': str,
                    'title': str,
                    'author': str,
                },
                'stats': {
                    'views': int,
                    'likes': int,
                }
            }]
        """

    def filter_karaoke_videos(self, videos: List[Dict]) -> List[Dict]:
        """
        Filter for karaoke/cover videos
        - Has copyrighted music (not original sound)
        - Creator is singing (check description/hashtags)
        """

    def download_video(self, video_id: str, output_path: Path) -> bool:
        """Download full creator video"""
```

**Usage**:
```bash
python lib/tiktok_video_scraper.py @karaokeking99 --limit 50
```

---

### 4. Song Identification Service

**New file**: `services/song-identification.ts`

```typescript
export interface SongIdentificationResult {
  spotifyId: string;
  spotifyUrl: string;
  isrc: string;
  title: string;
  artist: string;
  album: string;
  geniusId?: number;         // If found in Genius
  mlcData?: MLCData;         // Licensing data
  storyMintable: boolean;
}

export class SongIdentificationService {
  /**
   * Identify song from TikTok music metadata
   *
   * 1. Extract TikTok music ID from video
   * 2. Search Spotify by title + artist
   * 3. Fetch ISRC from Spotify track
   * 4. Optional: Search Genius for lyrics/metadata
   * 5. Fetch MLC licensing data by ISRC
   */
  async identifyFromTikTokMusic(
    musicId: string,
    musicTitle: string,
    musicArtist: string
  ): Promise<SongIdentificationResult>

  /**
   * Search Spotify by title and artist
   */
  private async searchSpotify(
    title: string,
    artist: string
  ): Promise<SpotifyTrack>

  /**
   * Fetch ISRC from Spotify track
   */
  private async getISRC(spotifyId: string): Promise<string>

  /**
   * Optional: Find in Genius database
   */
  private async findInGenius(
    title: string,
    artist: string
  ): Promise<number | null>

  /**
   * Fetch MLC licensing data by ISRC
   * Reuses logic from modules/songs/02-fetch-mlc-data.ts
   */
  private async fetchMLCData(
    isrc: string,
    title: string,
    artist: string
  ): Promise<MLCData | null>
}
```

---

### 5. Video Processing Pipeline

**Flow** (similar to `modules/segments/01-match-and-process.ts`):

1. **Download creator video** from TikTok
2. **Identify copyrighted song** using TikTok music metadata
3. **Find/download full song** (search local library or spotdl)
4. **Match video to song** using same forced alignment pipeline
5. **Crop to matched segment**
6. **Demucs separation** (vocals + instrumental)
7. **Optional fal.ai enhancement**
8. **Upload to Grove** (vocals, instrumental, alignment)
9. **Save video manifest**

**New Type**: `VideoManifest` (add to `lib/types.ts`):

```typescript
export interface VideoManifest {
  videoHash: string;
  creatorHandle: string;
  tiktokVideoId: string;
  tiktokUrl: string;

  song: {
    title: string;
    artist: string;
    spotifyId: string;
    isrc: string;
    geniusId?: number;
    mlcSongCode?: string;
  };

  match: {
    startTime: number;
    endTime: number;
    duration: number;
    confidence: number;
    method: string;
  };

  files: {
    originalVideo: string;
    segment: string;
    vocals: string;
    instrumental: string;
  };

  grove: {
    vocalsUri: string;
    instrumentalUri: string;
    alignmentUri: string;
  };

  licensing: MLCData;

  storyProtocol?: {
    ipId: string;
    parentIpId?: string;      // Original song IP (if registered)
    licenseTermsId?: string;
    mintedAt: string;
    transactionHash: Hex;
  };

  lens?: {
    postId: string;
    uri: string;
    transactionHash: Hex;
  };

  createdAt: string;
  updatedAt: string;
}
```

---

### 6. Story Protocol Integration

Creators register their karaoke segments as **derivative works**.

**Two scenarios**:

#### Scenario A: Original Song NOT on Story Protocol
- Register creator's segment as standalone IP
- Store MLC licensing metadata in IP metadata
- Add attribution to original song (off-chain reference)

#### Scenario B: Original Song IS on Story Protocol
- Register as derivative work with parent IP
- Attach proper license terms
- Automated royalty splits via PIL

**New file**: `services/story-protocol.ts`

```typescript
export interface StoryIPMetadata {
  name: string;
  description: string;
  ipType: 'MUSIC' | 'DERIVATIVE_MUSIC';

  // Original song reference
  originalSong?: {
    title: string;
    artist: string;
    isrc: string;
    mlcSongCode?: string;
    spotifyUrl: string;
  };

  // Creator attribution
  creator?: {
    tiktokHandle: string;
    lensHandle: string;
    pkpAddress: Address;
  };

  // Licensing
  licensing?: MLCData;
}

export class StoryProtocolService {
  /**
   * Check if original song is registered on Story Protocol
   */
  async findOriginalSongIP(
    isrc: string,
    title: string,
    artist: string
  ): Promise<string | null>

  /**
   * Register creator's karaoke segment as derivative work
   */
  async registerDerivativeWork(params: {
    creatorPKP: Address;
    videoHash: string;
    metadataUri: string;
    parentIpId?: string;        // If original song exists on Story
    licenseTermsId?: string;
  }): Promise<{ ipId: string; txHash: Hex }>

  /**
   * Create IP metadata for karaoke segment
   */
  async createIPMetadata(
    video: VideoManifest
  ): Promise<StoryIPMetadata>
}
```

---

### 7. Complete Creator Pipeline

**End-to-end flow**:

```bash
# 1. Setup creator identity
bun run creators/01-mint-pkp.ts --handle karaokeking99
bun run creators/02-create-lens.ts --handle karaokeking99 --display-name "Karaoke King"

# 2. Scrape creator's TikTok videos
bun run creators/03-scrape-videos.ts --handle karaokeking99 --limit 50

# 3. Process each video
for video_hash in $(jq -r '.videos[]' data/creators/karaokeking99/manifest.json); do
  # Identify song
  bun run creators/04-identify-songs.ts --handle karaokeking99 --video-hash $video_hash

  # Process audio
  bun run creators/05-process-video.ts --handle karaokeking99 --video-hash $video_hash

  # Mint on Story Protocol
  bun run creators/06-mint-derivative.ts --handle karaokeking99 --video-hash $video_hash

  # Post to Lens
  bun run creators/07-post-lens.ts --handle karaokeking99 --video-hash $video_hash
done
```

**Automation** (new file: `scripts/process-creator-full.sh`):
```bash
#!/bin/bash
# Process complete creator pipeline
HANDLE=$1
VIDEO_HASH=$2

echo "Processing video $VIDEO_HASH for creator @$HANDLE"

bun run creators/04-identify-songs.ts --handle $HANDLE --video-hash $VIDEO_HASH && \
bun run creators/05-process-video.ts --handle $HANDLE --video-hash $VIDEO_HASH && \
bun run creators/06-mint-derivative.ts --handle $HANDLE --video-hash $VIDEO_HASH && \
bun run creators/07-post-lens.ts --handle $HANDLE --video-hash $VIDEO_HASH

echo "✅ Complete pipeline finished for $VIDEO_HASH"
```

---

## Implementation Plan

### Phase 1: Identity Setup (Week 1)
- [ ] Add `CreatorPKP`, `CreatorLens`, `CreatorManifest` types to `lib/types.ts`
- [ ] Implement `modules/creators/01-mint-pkp.ts` (adapt from artists)
- [ ] Implement `modules/creators/02-create-lens.ts` (adapt from artists)
- [ ] Create `data/creators/` directory structure

### Phase 2: TikTok Video Scraping (Week 1-2)
- [ ] Implement `lib/tiktok_video_scraper.py`
  - [ ] User feed scraping with hrequests
  - [ ] Karaoke video filtering
  - [ ] Video download with metadata extraction
- [ ] Implement `modules/creators/03-scrape-videos.ts`
- [ ] Test with real TikTok creator accounts

### Phase 3: Song Identification (Week 2)
- [ ] Implement `services/song-identification.ts`
  - [ ] Spotify search by title + artist
  - [ ] ISRC extraction
  - [ ] Optional Genius lookup
  - [ ] MLC licensing fetch (reuse existing logic)
- [ ] Implement `modules/creators/04-identify-songs.ts`
- [ ] Add `VideoManifest` type to `lib/types.ts`

### Phase 4: Video Processing (Week 2-3)
- [ ] Implement `modules/creators/05-process-video.ts`
  - [ ] Reuse audio matching pipeline
  - [ ] Reuse Demucs + fal.ai processing
  - [ ] Grove upload with creator attribution
- [ ] Test with various karaoke video qualities

### Phase 5: Story Protocol Integration (Week 3)
- [ ] Implement `services/story-protocol.ts`
  - [ ] Original song IP lookup
  - [ ] Derivative work registration
  - [ ] IP metadata creation
- [ ] Implement `modules/creators/06-mint-derivative.ts`
- [ ] Test with/without parent IP scenarios

### Phase 6: Lens Publishing (Week 4)
- [ ] Implement `modules/creators/07-post-lens.ts`
  - [ ] Create Lens post with video + metadata
  - [ ] Link to Story Protocol IP
  - [ ] Include licensing attribution
- [ ] Implement `scripts/process-creator-full.sh` automation

### Phase 7: Testing & Documentation (Week 4)
- [ ] End-to-end test with real creator
- [ ] Performance optimization
- [ ] Error handling for edge cases
- [ ] Documentation and examples

---

## API Requirements

### New Environment Variables
```bash
# TikTok API (if using official API)
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...

# Story Protocol
STORY_API_KEY=...
STORY_RPC_URL=https://testnet.storyrpc.io

# Existing (already in .env)
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
GENIUS_API_KEY=...
ELEVENLABS_API_KEY=...
VOXTRAL_API_KEY=...
OPENROUTER_API_KEY=...
```

---

## Copyright Compliance

**Key considerations**:

1. **Derivative Work Attribution**
   - All creator segments reference original song
   - MLC licensing data included in metadata
   - Story Protocol IP graph shows provenance

2. **Licensing Transparency**
   - Display publisher shares from MLC
   - Show storyMintable status
   - Link to original song Spotify/Genius

3. **Creator Rights**
   - Creator owns performance (vocals)
   - Original song owner retains composition rights
   - Story Protocol manages licensing terms

4. **Metadata Storage**
   - Full lyrics NOT stored (copyright violation)
   - Only LRCLib ID + cropped segment lyrics
   - Grove storage for processed audio only

---

## Differences Summary

| Component | Artist Flow | Creator Flow |
|-----------|-------------|--------------|
| **Identity** | genius-id | tiktok-handle |
| **PKP Minting** | Same logic | Same logic |
| **Lens Account** | Artist metadata | Creator metadata |
| **Content Source** | TikTok music pages | TikTok user videos |
| **Song Registry** | Registers original songs | References existing songs |
| **Segment Registry** | Canonical TikTok segments | Creator karaoke videos |
| **Story Protocol** | IP Owner (if applicable) | Derivative Work |
| **Licensing** | MLC publisher shares | References original licensing |
| **Lens Posts** | Original song metadata | Performance + attribution |

---

## Next Steps

1. **Review this design** - Confirm architecture aligns with product vision
2. **Choose Phase 1 start** - Begin with identity setup modules
3. **TikTok API decision** - Official API vs. hrequests scraping
4. **Story Protocol setup** - Get testnet access and API keys
5. **Test creator selection** - Find real TikTok karaoke creator for testing
