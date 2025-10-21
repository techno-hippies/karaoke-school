# Story Protocol Architecture (CORRECTED)

## Overview

We use Story Protocol to mint **TWO types of derivative IP Assets**, NOT the original songs.

## Architecture

### 1. Derivative AI-Generated Instrumental 🎹 (Current Implementation)

**One IP Asset per processed segment**

- **Type**: AI-generated instrumental derivative (100% owned by us)
- **Media**: instrumental.wav (fal.ai audio-to-audio enhancement)
- **Cover Art**: Seedream-generated abstract derivative
- **Ownership**: 100% KaraokeSchool (NOT a revenue split!)
- **Mechanical Royalties**: Paid separately per statutory rate to MLC publishers
- **When**: Minted AFTER segment processing completes
- **Use Case**: Educational karaoke - users sing over this instrumental

**Key Point**: We OWN the derivative instrumental. Mechanical royalties are a separate payment obligation, not a Story Protocol revenue split.

### 2. TikTok Dance Videos 👯 (Future Implementation)

**One IP Asset per user-posted dance video**

- **Type**: Derivative performance work
- **Media**: video/mp4 (TikTok dance performance)
- **Royalty Split**: 18% to dancer, 82% to original rights holders
- **When**: Minted when users post dance videos
- **Use Case**: Social media monetization

## What We DON'T Mint: Original Songs ❌

We are NOT the rights holders for songs like "TEXAS HOLD 'EM" by Beyoncé. The MLC licensing data shows the actual rights holders (Sony/ATV, Universal Music Corp, etc.).

**Original song IP Assets should only be minted by actual rights holders.**

---

## Contracts & Data Flow

### Song on Blockchain (Base Sepolia)

**Contract**: `SongRegistryV1`

```solidity
struct Song {
    uint32 geniusId;             // 10047250
    uint32 geniusArtistId;       // 498 (Beyoncé)
    string spotifyId;            // "0Z7nGFVCLfixWctgePsRk9"
    string tiktokMusicId;        // "7334542274145454891" (extracted from TikTok URL)
    string title;                // "TEXAS HOLD 'EM"
    string artist;               // "Beyoncé"
    uint32 duration;             // 233 seconds
    string coverUri;             // "https://images.genius.com/..." (Genius URL OK - reference only)
    string metadataUri;          // "lens://..." (Grove - contains MLC data + lyrics)
    bool copyrightFree;          // false
    bool enabled;                // true
}
```

**Notes**:
- `coverUri` can be Genius URL (we're not hosting the copyrighted image, just referencing)
- `tiktokMusicId` extracted from URL like: `https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891`
- `metadataUri` contains full metadata JSON with MLC licensing data and synced lyrics

### Segment on Blockchain (Base Sepolia)

**Contract**: `SegmentRegistryV1`

```solidity
struct Segment {
    uint32 geniusId;             // 10047250 (links to Song)
    string tiktokSegmentId;      // "7334542274145454891" (TikTok music ID)
    uint32 startTime;            // 0 seconds
    uint32 endTime;              // 60 seconds
    uint32 duration;             // 60 seconds
    string vocalsUri;            // "lens://..." (backup only - NOT used in app!)
    string instrumentalUri;      // "lens://..." (PRIMARY - users karaoke over this)
    string alignmentUri;         // "lens://..." (ElevenLabs word timestamps)
    string coverUri;             // "lens://..." (Seedream derivative cover)
    bool processed;              // true
    bool enabled;                // true
}
```

**Notes**:
- `vocalsUri` = Encrypted/backup only (not used in the app)
- `instrumentalUri` = PRIMARY media (AI-generated, users sing over this)
- `coverUri` = Seedream-generated derivative (NOT Genius URL)

---

## Story Protocol IP Asset (Aeneid Testnet)

### Derivative AI-Generated Instrumental

```typescript
{
  // Basic Info
  title: "TEXAS HOLD 'EM (Karaoke Instrumental 0-60s)",
  description: "AI-generated karaoke instrumental (fal.ai audio-to-audio derivative). Educational fair use karaoke - users sing over this instrumental. Mechanical license: MLC TB46ND.",

  // Media
  image: "lens://...",           // Seedream derivative cover
  imageHash: "0x...",            // SHA-256
  mediaUrl: "lens://...",        // instrumental.wav (PRIMARY!)
  mediaHash: "0x...",            // SHA-256
  mediaType: "audio/wav",

  // IP Type
  ipType: "Music",
  tags: ["karaoke", "ai_generated", "instrumental", "derivative_mechanical_license"],

  // Ownership: 100% KaraokeSchool
  creators: [
    {
      name: "KaraokeSchool AI",
      address: "0x0C64...",
      contributionPercent: 100,  // We own the derivative 100%
      role: "ai_music_generator",
      description: "AI-generated instrumental derivative using fal.ai audio-to-audio. Mechanical royalties paid separately per statutory rate."
    }
  ],

  // Original Work Reference (for mechanical license tracking)
  original_work: {
    title: "TEXAS HOLD 'EM",
    primary_artists: ["Beyoncé"],
    iswc: "T3236453484",         // Composition identifier
    mlc_work_id: "TB46ND",       // Mechanical license reference
    genius_url: "https://genius.com/songs/10047250"
    // NO ISRC - not relevant for instrumental derivatives
  },

  // MLC Data (for mechanical royalty payment obligation)
  rights_metadata: {
    mlc_data: {
      song_code: "TB46ND",       // MLC Song Code (not ISRC!)
      title: "TEXAS HOLD 'EM",
      iswc: "T3236453484",
      total_publisher_share: 98.5,
      writers: [...],            // 7 writers with IPI numbers
      publishers: [...]          // 10 publishers with shares
    }
  },

  // Derivative-Specific Metadata
  derivative_metadata: {
    type: "ai_generated_instrumental",
    segment_id: "7334542274145454891-0-60",
    start_time: 0,
    end_time: 60,
    duration: 60,
    primary_media_uri: "lens://...",     // What users karaoke over
    vocals_uri: "lens://...",            // Backup/reference only
    alignment_uri: "lens://...",         // Word timestamps
    use_case: "educational_karaoke",
    user_interaction: "Users sing over this AI-generated instrumental (fair use)",
    processing: {
      source_separation: "Demucs (htdemucs_ft model)",
      ai_enhancement: "fal.ai audio-to-audio",
      forced_alignment: "ElevenLabs word-level timestamps"
    },
    ownership: {
      derivative_owner: "KaraokeSchool",
      ownership_percent: 100,
      mechanical_royalty_obligation: "Paid separately per statutory rate to MLC publishers"
    }
  },

  // Provenance
  provenance: {
    created_at: "2025-01-21T...",
    uploader: "0x0C64...",
    tiktok_url: "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891",
    copyright_type: "derivative_ai_instrumental"
  }
}
```

**License**: Commercial Remix PIL with **0% revenue share**
- We own 100% of the derivative instrumental
- Mechanical royalties paid separately (not through Story Protocol)
- No royalty vault needed

### TikTok Dance Video (Future)

```typescript
{
  title: "Dance Performance: TEXAS HOLD 'EM",

  // Media
  mediaUrl: "lens://...",        // video/mp4
  mediaType: "video/mp4",

  // Revenue Split: 18/82
  creators: [
    {
      name: "Dancer Username",
      address: "0x...",
      contributionPercent: 18,   // Dancer
      role: "performer"
    },
    {
      name: "Original Rights Holders",
      address: "0x0000...",      // Or MLC publishers
      contributionPercent: 82,   // Original rights holders
      role: "original_rights_holder"
    }
  ]
}
```

**License**: Commercial Remix PIL with **18% revenue share**

---

## Derivative Cover Art Strategy

### Problem
Original album art is copyrighted - we can't use it directly.

### Solution: fal.ai Seedream Transformation

```typescript
const prompt = "convert this to an abstract painting maintaining its shapes and overall structure but making it vague"
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

---

## MLC Data (Mechanical License Provenance)

**Why we include MLC data**:
- Shows proper provenance chain
- Demonstrates mechanical license for composition
- Transparent attribution to rights holders
- Documents our mechanical royalty payment obligation

**Key fields**:
- `mlcSongCode`: MLC's unique identifier (e.g., TB46ND) - USE THIS, NOT ISRC!
- `iswc`: International Standard Musical Work Code
- `writers`: Composer/author credits with IPI numbers
- `publishers`: Publishing companies with shares
- `totalPublisherShare`: Must be ≥98% for Story Protocol eligibility

**Note**: We use **MLC Song Code**, not ISRC
- ISRC = Recording identifier (for sound recording rights)
- MLC = Composition identifier (for mechanical license rights)
- Karaoke is a mechanical license use case

---

## File Structure

```
services/
  ├── StoryProtocolService.ts    # Core Story Protocol integration
  ├── FalSeedreamService.ts      # Derivative cover art generation
  ├── grove.ts                   # IPFS storage via Grove
  └── tiktok.ts                  # TikTok URL parsing utilities

segments/
  ├── 01-match-and-process.ts           # Main segment processing pipeline
  └── 02-mint-segment-ip-asset.ts       # Mint derivative IP Asset

story/
  └── DEPRECATED-01-mint-song-ip-asset.ts  # OLD: Do not use
```

---

## Complete Flow

### 1. Song Registration (Base Sepolia)
```bash
bun songs/01-register-song.ts --genius-id 10047250 --genius-artist-id 498
bun songs/02-fetch-mlc-data.ts --genius-id 10047250
bun songs/03-build-metadata.ts --genius-id 10047250
```

**Result**:
- Song registered on blockchain
- MLC data fetched (TB46ND, 98.5% publisher shares)
- Metadata uploaded to Grove with licensing data + synced lyrics

### 2. Segment Processing (Base Sepolia + off-chain)
```bash
bun segments/01-match-and-process.ts \
  --genius-id 10047250 \
  --tiktok-url "https://www.tiktok.com/music/TEXAS-HOLDEM-7334542274145454891" \
  --song-path "/path/to/song.flac"
```

**Pipeline**:
1. Extract TikTok music ID: `7334542274145454891`
2. Match TikTok segment → full song timestamp (0-60s)
3. Crop audio segment
4. Demucs stem separation → vocals.wav, instrumental.wav
5. fal.ai audio-to-audio enhancement (instrumental only!)
6. ElevenLabs forced alignment → alignment.json
7. Upload stems + alignment to Grove
8. Register segment on blockchain (Phase 1: metadata)
9. Process segment on blockchain (Phase 2: audio assets)

**Result**:
- Segment registered with vocals (backup), instrumental (primary), alignment
- `instrumentalUri` = What users karaoke over

### 3. Story Protocol IP Asset (Aeneid Testnet - OPTIONAL)
```bash
bun segments/02-mint-segment-ip-asset.ts \
  --genius-id 10047250 \
  --segment-id "7334542274145454891-0-60"
```

**Pipeline**:
1. Load segment data from blockchain
2. Generate Seedream derivative cover → upload to Grove
3. Build derivative IP Asset metadata (100% ownership, instrumental as primary)
4. Upload IPA metadata to Grove
5. Mint derivative IP Asset on Story Protocol

**Result**:
- IP Asset ID: `0x...`
- 100% owned by KaraokeSchool
- Mechanical royalties paid separately
- Derivative instrumental safe for educational karaoke use

---

## Key Differences from Previous Implementation

| Aspect | OLD (WRONG ❌) | NEW (CORRECT ✅) |
|--------|----------------|------------------|
| **What we mint** | Original song | Derivative instrumental |
| **Primary media** | vocals.wav | instrumental.wav |
| **Ownership** | 18/82 split | 100% ours |
| **Cover art** | Genius URL (copyrighted) | Seedream derivative |
| **mediaType** | video/mp4 | audio/wav |
| **Title** | "texas hold 'em - beyonc" | "TEXAS HOLD 'EM (Karaoke Instrumental 0-60s)" |
| **Revenue share** | 18% commercial | 0% (we own it) |
| **Royalties** | Via Story Protocol | Mechanical royalties paid separately |
| **Use case** | Unclear | Educational karaoke |

---

## Questions & Answers

**Q: Do we own the derivative instrumental?**
A: YES - 100%. We created it via AI processing. Mechanical royalties are a separate obligation.

**Q: Why instrumental, not vocals?**
A: Users sing OVER the instrumental. That's what karaoke is!

**Q: Why 0% revenue share?**
A: We own the derivative. Mechanical royalties are paid separately, not via Story Protocol.

**Q: Can we use Genius cover art?**
A: For Song.coverUri (reference only): YES
   For Segment.coverUri (hosted/commercial use): NO - use Seedream derivative

**Q: What about TikTok dance videos?**
A: Those will use 18/82 split. Different use case, separate implementation (future).

**Q: What if MLC data is incomplete?**
A: Story Protocol minting requires ≥98% publisher share. Script fails gracefully with clear errors.

---

## Resources

- Story Protocol Docs: https://docs.story.foundation
- MLC API: https://api.ptl.themlc.com
- fal.ai Seedream: https://fal.ai/models/bytedance/seedream/v4/text-to-image
- Grove Storage: https://grove.storage
- Mechanical License Guide: https://www.themlc.com
