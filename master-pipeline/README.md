# Master Pipeline

**Karaoke School Content Pipeline: TikTok-based song segments for English learning**

## Overview

This pipeline creates the complete karaoke learning experience:
1. **Artist Flow:** PKP → Lens Account → Artist Registry
2. **Song/Segment Flow:** TikTok → Audio Matching → Processing → Contracts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARTIST PIPELINE                               │
│  Input:  Artist name, Genius ID                                  │
│  Output: PKP + Lens Account + On-chain Artist                    │
│  Path:   /a/:lenshandle                                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Enables
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SONG/SEGMENT PIPELINE                            │
│  Input:  TikTok song page URL                                    │
│  Steps:                                                          │
│    1. Crawl TikTok → Download segment                            │
│    2. Audio matching → Find start/end in original                │
│    3. Crop original → Demucs → Fal → Grove                       │
│    4. Register Song → Register Segment → Update contracts        │
│  Output: Playable karaoke segment at /s/:songId                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```
Artist (PKP + Lens + On-chain)
  └── Song (Genius ID + Spotify ID + TikTok Music ID)
       └── Segment (~30s TikTok portion)
            ├── TikTok Videos (reference metadata)
            └── Student Performances (karaoke recordings)
```

## Folder Structure

```
master-pipeline/
├── artists/               # Artist pipeline scripts
│   ├── 01-mint-pkp.ts               # Mint PKP for artist
│   ├── 02-create-lens.ts            # Create Lens account with metadata
│   ├── 03-register-artist.ts        # Register in ArtistRegistry contract
│   └── pipeline-artist.ts           # Full artist flow (automated)
│
├── songs/                 # Song pipeline scripts
│   ├── 01-crawl-tiktok.ts          # Crawl TikTok song page
│   ├── 02-audio-match.ts           # Match segment to original
│   ├── 03-process-audio.ts         # Crop + Demucs + Fal
│   ├── 04-upload-grove.ts          # Upload to Grove storage
│   ├── 05-register-song.ts         # Register in SongRegistry
│   └── pipeline-song.ts            # Full song flow (automated)
│
├── segments/              # Segment pipeline scripts
│   ├── 01-register-segment.ts      # Phase 1: Metadata
│   ├── 02-process-segment.ts       # Phase 2: Audio assets
│   └── pipeline-segment.ts         # Full segment flow (automated)
│
├── scripts/               # Pipeline orchestration
│   ├── pipeline-full.ts            # Artist + Song + Segment (E2E)
│   ├── validate-data.ts            # Validate manifests
│   └── sync-contracts.ts           # Sync with on-chain data
│
├── lib/                   # Shared utilities
│   ├── pkp.ts                      # PKP utilities
│   ├── lens.ts                     # Lens utilities
│   ├── contracts.ts                # Contract interactions
│   ├── grove.ts                    # Grove storage
│   ├── audio.ts                    # Audio processing
│   └── tiktok.ts                   # TikTok utilities
│
├── config/                # Configuration files
│   ├── contracts.json              # Contract addresses
│   ├── networks.json               # Network configs
│   └── artists.json                # Artist metadata
│
├── data/                  # Pipeline outputs (gitignored)
│   ├── artists/                    # Artist manifests
│   │   └── {artist-handle}/
│   │       ├── pkp.json            # PKP data
│   │       ├── lens.json           # Lens data
│   │       └── manifest.json       # Full artist data
│   │
│   ├── songs/                      # Song manifests
│   │   └── {genius-song-id}/
│   │       ├── metadata.json       # Song metadata
│   │       ├── original.flac       # Original track (manual)
│   │       └── manifest.json       # Full song data
│   │
│   └── segments/                   # Segment data
│       └── {segment-hash}/
│           ├── tiktok_clip.mp4     # TikTok clip
│           ├── vocals.wav          # Cropped vocals
│           ├── instrumental.wav    # Processed instrumental
│           ├── alignment.json      # Forced alignment
│           └── manifest.json       # Full segment data
│
├── .env                   # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Pipeline Flows

### 1. Artist Pipeline

**Goal:** Create artist profile with PKP, Lens account, and on-chain registration

**Steps:**
```bash
# Full automated flow
bun run pipeline-artist --name beyonce --genius-id 498 --handle beyonce

# Or step-by-step:
bun run artists/01-mint-pkp --name beyonce --genius-id 498
bun run artists/02-create-lens --name beyonce --handle beyonce
bun run artists/03-register-artist --name beyonce
```

**Output:**
- `data/artists/beyonce/pkp.json` - PKP address, token ID
- `data/artists/beyonce/lens.json` - Lens handle, account address
- `data/artists/beyonce/manifest.json` - Combined metadata
- On-chain: ArtistRegistry entry for Genius ID 498
- Frontend: Artist page at `/a/beyonce`

---

### 2. Song/Segment Pipeline

**Goal:** Add song with TikTok segment, processed audio, and on-chain data

**Steps:**
```bash
# Full automated flow
bun run pipeline-song \
  --artist beyonce \
  --tiktok-url https://www.tiktok.com/music/CUFF-IT-7164943011337561089 \
  --original-path /path/to/original.flac

# Or step-by-step:
bun run songs/01-crawl-tiktok --url https://www.tiktok.com/music/...
bun run songs/02-audio-match --tiktok-clip clip.mp4 --original original.flac
bun run songs/03-process-audio --segment-id {hash} --original original.flac
bun run songs/04-upload-grove --segment-id {hash}
bun run songs/05-register-song --artist beyonce --genius-id 7163434
bun run segments/01-register-segment --song-id 7163434 --segment-id {hash}
bun run segments/02-process-segment --segment-id {hash}
```

**Output:**
- `data/songs/{genius-id}/metadata.json` - Genius metadata
- `data/segments/{hash}/manifest.json` - Segment metadata + Grove URIs
- On-chain: SongRegistry + SegmentRegistry entries
- Frontend: Song page at `/s/{genius-id}` with TikTok dance videos

---

## Key Differences from pkp-lens-flow

| Aspect | pkp-lens-flow | master-pipeline |
|--------|---------------|-----------------|
| **Purpose** | TikTok content monetization | Karaoke learning platform |
| **Artists** | TikTok creators | Music artists (Genius) |
| **Content** | Full TikTok videos (encrypted) | ~30s song segments (open) |
| **Access** | Subscription gated (Unlock) | Free for learning |
| **Audio** | Original video audio | Demucs instrumental + vocals |
| **Lyrics** | Transcription (any language) | Forced alignment (English) |
| **Data** | Grove + Lens posts | Grove + Smart contracts |
| **Frontend** | `/u/:username` (user profile) | `/a/:handle` (artist page) |

## Integration Points

### With v2-contracts
- ArtistRegistryV1: Store PKP + Lens + Genius mapping
- SongRegistryV1: Store songs with artist linkage
- SegmentRegistryV1: Store ~30s segments with audio URIs

### With audio-matching-test
- Use `scripts/match-audio-alignment.mjs` for segment matching
- Input: TikTok clip + original FLAC + lyrics.txt
- Output: `crop_instructions.json` with start/end times

### With pkp-lens-flow (reusable)
- PKP minting logic
- Lens account creation
- Grove upload utilities
- Audio transcription/alignment

## Getting Started

### Prerequisites
1. **Test Tokens**
   - Chronicle Yellowstone (PKP minting)
   - Lens Testnet (Lens accounts)
   - ZKsync/Lens Network (contracts)

2. **API Keys**
   - Genius API (song metadata)
   - Spotify API (ISRC, track data)
   - Deepinfra/OpenRouter (STT for matching)

3. **Tools**
   - `ffmpeg` (audio processing) - install via package manager
   - `demucs` (stem separation) - see [SETUP_DEMUCS.md](./SETUP_DEMUCS.md)
   - `fal.ai` API (audio2audio) - API key required

### Environment Setup
```bash
cd master-pipeline

# Install TypeScript dependencies
bun install

# Setup Python venv for TikTok scraper + Demucs
uv venv
uv pip install hrequests "numpy<2" "demucs==4.0.1" soundfile

# Copy .env.example to .env and fill in values
cp .env.example .env
```

See [SETUP_DEMUCS.md](./SETUP_DEMUCS.md) for detailed Demucs installation guide.

### Example: Create Beyoncé with "CUFF IT" segment

```bash
# 1. Create artist
bun run pipeline-artist --name beyonce --genius-id 498 --handle beyonce

# 2. Add song + segment
bun run pipeline-song \
  --artist beyonce \
  --tiktok-url https://www.tiktok.com/music/CUFF-IT-7164943011337561089 \
  --original-path ~/Music/Beyoncé/CUFF-IT.flac

# 3. Verify on-chain
bun run scripts/validate-data --artist beyonce

# 4. Frontend ready!
# Artist page: /a/beyonce
# Song page: /s/7163434
```

## Next Steps

- [ ] Implement artist pipeline scripts
- [ ] Implement song/segment pipeline scripts
- [ ] Integrate audio-matching-test
- [ ] Add demucs/fal processing
- [ ] Contract interaction utilities
- [ ] Grove upload logic
- [ ] End-to-end testing with Beyoncé

## License

MIT
