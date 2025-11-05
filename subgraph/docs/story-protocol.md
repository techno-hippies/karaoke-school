# Story Protocol Creator Video Minting - Analysis & Implementation

## 📊 Current State

### ✅ What We Have
- **39 copyrighted TikTok videos** fully processed:
  - Transcribed (STT via Cartesia/Voxtral)
  - Translated (multi-language via Gemini)
  - Uploaded to Grove (IPFS storage)

### ⚠️ Gap Analysis
- **Only 3 videos** have BOTH work + recording minted to GRC-20
- **0 creators** have PKP/Lens accounts created
- **0 videos** minted to Story Protocol
- **0 videos** posted to Lens custom feed

### 🎯 Best Test Candidate

**Video:** `7558957526327332118` by @charleenweiss (Charlie)
- **Song:** "Life Is Good" by Kenny Chesney
- **Work GRC-20 ID:** `f79f9fb2-337c-416b-a1a4-a68c1e1b4a0e` ✅
- **Recording GRC-20 ID:** `ea1ee7bc-5b55-42e0-a093-f959a8ec0aab` ✅
- **Grove CID:** `cac42df6a149dfc1ba1204826c117505c7a75e3dc5ccd72ecdf20bd206c23909` ✅
- **Transcription:** "(cheerful country music) Life is good, the grass is green" ✅
- **Creator PKP/Lens:** ❌ Need to create

**Other Ready Videos:**
1. `7217015217417374981` by @gioscottii - "Sarà perché ti amo" by Ricchi E Poveri
2. `7008793648150203653` by @grimes - "THATS WHAT I WANT" by Lil Nas X

---

## 🏗️ Architecture Decisions

### 1. GRC-20 Reference Strategy (Simplified)

**❌ DON'T:** Duplicate all rights metadata in Story Protocol
```typescript
// BAD - duplicates everything from GRC-20
{
  iswc: "T-123.456.789-0",
  writers: [...], // 50+ lines
  publishers: [...], // 50+ lines
  mlc_data: {...}, // Huge nested object
  bmi_data: {...}
}
```

**✅ DO:** Simple reference to GRC-20 entity
```typescript
// GOOD - minimal reference
{
  grc20: {
    work_id: "f79f9fb2-337c-416b-a1a4-a68c1e1b4a0e",
    recording_id: "ea1ee7bc-5b55-42e0-a093-f959a8ec0aab",
    note: "All rights metadata stored in GRC-20 entity"
  }
}
```

**Rationale:**
- GRC-20 is the **single source of truth** for rights metadata
- Story Protocol just tracks **derivative relationship**
- Cheaper (less IPFS storage)
- Updatable (change GRC-20, not every video)

### 2. Creator vs Artist Distinction

| Type | Example | PKP/Lens Account | Revenue Split |
|------|---------|------------------|---------------|
| **TikTok Creator** | @charleenweiss singing Kenny Chesney | Creator's account | 18% creator / 82% rights |
| **Artist Video** | @beyonce singing her own song | Artist's account | 100% artist (no split) |

**Implementation:**
- TikTok creators: Use `tiktok_creators` table
- Artists: Use `grc20_artists` table + artist PKPs

---

## 📝 Story Protocol Metadata Structure

### Proposed Minimal Metadata

```typescript
interface StoryDerivativeMetadata {
  // Basic info
  title: string;  // "TikTok Cover by @charleenweiss"
  description: string;  // Transcription text

  // GRC-20 reference (NOT duplication!)
  grc20: {
    work_id: string;  // UUID from grc20_work_mints
    recording_id: string;  // UUID from grc20_recording_mints
    note: "All rights metadata (ISWC, writers, publishers) stored in GRC-20 entity"
  };

  // Creators (18/82 split)
  creators: [
    {
      name: string;  // "Charlie"
      address: string;  // Lens account address
      contributionPercent: 18;
      role: "derivative_performer";
      description: "TikTok creator performance";
    },
    {
      name: "Rights Holders (see GRC-20)";
      address: string;  // Safe multisig address
      contributionPercent: 82;
      role: "original_rights_holder";
      description: "Original artists and publishers tracked in GRC-20";
    }
  ];

  // Media
  mediaUrl: string;  // Grove URL
  mediaHash: string;  // SHA-256 of video
  mediaType: "video/mp4";

  // Provenance (minimal)
  provenance: {
    tiktok_video_id: string;
    tiktok_url: string;
    spotify_track_id: string;
    genius_song_id: number;
    created_at: string;
  };

  // Attribution
  ipType: "Music";
  tags: ["karaoke", "tiktok", "cover", "copyrighted"];
}
```

### What We DON'T Include
- ❌ MLC writers/publishers (in GRC-20)
- ❌ BMI work details (in GRC-20)
- ❌ Quansic artist data (in GRC-20)
- ❌ ISWC/ISRC codes (in GRC-20)
- ❌ Wikidata IDs (in GRC-20)

---

## 🔗 Database Schema Changes

```sql
-- Add Story Protocol tracking to tiktok_videos
ALTER TABLE tiktok_videos
  ADD COLUMN IF NOT EXISTS story_ip_id TEXT,
  ADD COLUMN IF NOT EXISTS story_metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS story_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS story_license_terms_ids TEXT[],
  ADD COLUMN IF NOT EXISTS story_royalty_vault TEXT,
  ADD COLUMN IF NOT EXISTS story_minted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lens_post_hash TEXT,
  ADD COLUMN IF NOT EXISTS lens_post_uri TEXT,
  ADD COLUMN IF NOT EXISTS lens_posted_at TIMESTAMPTZ;

-- Index for mintable videos
CREATE INDEX IF NOT EXISTS idx_videos_story_mintable
  ON tiktok_videos(video_id)
  WHERE is_copyrighted = TRUE
    AND grove_video_cid IS NOT NULL
    AND story_ip_id IS NULL;

-- Index for videos ready to post to Lens
CREATE INDEX IF NOT EXISTS idx_videos_lens_postable
  ON tiktok_videos(video_id)
  WHERE story_ip_id IS NOT NULL
    AND lens_post_hash IS NULL;
```

---

## 🚀 Implementation Steps

### Step 1: Create PKP/Lens for @charleenweiss
```bash
# Run existing processors
bun karaoke-pipeline/src/processors/mint-creator-pkps.ts --username=charleenweiss
bun karaoke-pipeline/src/processors/create-creator-lens.ts --username=charleenweiss
```

### Step 2: Mint Single Video to Story Protocol
```bash
# New processor (to be created)
bun karaoke-pipeline/src/processors/13-mint-story-derivatives.ts \
  --video-id=7558957526327332118 \
  --test-mode
```

### Step 3: Verify & Post to Lens
```bash
# Check Story Protocol explorer
# Post to Lens feed if successful
bun karaoke-pipeline/src/processors/13-mint-story-derivatives.ts \
  --video-id=7558957526327332118 \
  --post-lens
```

### Step 4: Scale to All 3 Videos
```bash
bun karaoke-pipeline/src/processors/13-mint-story-derivatives.ts --limit=3
```

---

## 🎯 Next Actions

1. **Review & approve** metadata structure above
2. **Implement** `13-mint-story-derivatives.ts` processor
3. **Create** PKP/Lens for @charleenweiss
4. **Test** mint single video
5. **Verify** on Story Protocol explorer
6. **Post** to Lens custom feed
7. **Scale** to remaining 2 videos

---

## ❓ Questions for User

1. **Metadata structure:** Approve the simplified GRC-20 reference approach?
2. **Safe multisig:** What address should receive the 82% rights holder share?
3. **Story Protocol network:** Aeneid testnet (1315) or mainnet (1514)?
4. **Lens feed posting:** Should this be automatic or manual review first?
5. **Artist videos:** Should we handle @beyonce videos differently (100% split)?

---

## 📋 Success Criteria

✅ Video minted to Story Protocol with correct 18/82 split
✅ GRC-20 work/recording IDs referenced in metadata
✅ Creator PKP/Lens account created
✅ Video posted to Lens custom feed
✅ Visible in Story Protocol explorer
✅ Trackable in database (story_ip_id populated)
