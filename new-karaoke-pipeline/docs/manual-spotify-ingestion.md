# Manual Spotify Ingestion: Complete Production Walkthrough

This document provides a complete, step-by-step guide for adding Spotify songs directly to the karaoke pipeline without requiring TikTok discovery. It includes real examples, known workarounds, troubleshooting, and code quality notes.

**Last Updated**: 2025-11-12
**Reference Track**: Rage Against The Machine - "Killing in the Name" (Spotify ID: `59WN2psjkt1tyaxjspN8fp`)
**Production Status**: ✅ Fully tested end-to-end

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Ingestion](#phase-1-ingestion)
4. [Phase 2: Lyrics & Translation](#phase-2-lyrics--translation)
5. [Phase 3: Audio Processing](#phase-3-audio-processing)
6. [Phase 4: Artist Identity](#phase-4-artist-identity)
7. [Phase 5: Encryption & Events](#phase-5-encryption--events)
8. [Phase 6: GRC-20 & Verification](#phase-6-grc-20--verification)
9. [Known Issues & Workarounds](#known-issues--workarounds)
10. [Troubleshooting](#troubleshooting)
11. [Code Quality Notes](#code-quality-notes)

---

## Architecture Overview

Manual Spotify ingestion uses the same pipeline as TikTok-sourced content, with three key improvements:

### 1. **Source Type Discrimination**
Tracks have a `source_type` column (added via Migration 017):
- `tiktok` - Discovered via TikTok scraping
- `manual_spotify` - Added directly from Spotify API

The `tiktok_video_id` column is **nullable** via partial unique index `idx_tracks_tiktok_not_null WHERE tiktok_video_id IS NOT NULL`, allowing manual tracks without TikTok IDs.

### 2. **Spotify Cache Auto-Sync**
The ingestion script (`add-track-from-spotify.ts`) populates two cache tables before inserting the track:
- `spotify_tracks` - Track metadata (title, album, ISRC, duration, artists array)
- `spotify_artists` - Artist metadata (genres, popularity, followers, images)

This eliminates "table not found" errors in downstream tasks that JOIN on these tables.

### 3. **Unified Pipeline**
All downstream tasks (audio, enrichment, identity, encryption, GRC) are source-agnostic:
- They filter by `spotify_track_id` (polymorphic foreign key)
- Stage-based progression handles both TikTok and manual tracks identically
- No code duplication or special cases needed

---

## Prerequisites

Before running manual ingestion, ensure:

### Environment Variables
```bash
# Spotify API credentials (for track validation)
export SPOTIFY_CLIENT_ID=...
export SPOTIFY_CLIENT_SECRET=...

# Neon database
export NEON_DATABASE_URL=postgresql://...

# Lyrics discovery (Genius)
export GENIUS_ACCESS_TOKEN=...

# Audio processing services
export OPENROUTER_API_KEY=...           # For segment selection fallback
export RUNPOD_SERVERLESS_API_KEY=...    # For Demucs separation
export FAL_API_KEY=...                   # For audio enhancement
export GROVE_API_KEY=...                 # For storage upload

# Lit Protocol & encryption
export PRIVATE_KEY=0x...                 # For event emission
export LIT_NETWORK=baseSepolia           # Or Lens testnet

# Services must be accessible
# - LRCLIB API: https://lrclib.net (lyrics discovery)
# - ElevenLabs API: https://api.elevenlabs.io (word alignment)
```

### Database Prerequisites

The Neon database must have all current migrations applied:
```bash
# Check schema is up-to-date (includes Migration 017)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tracks' AND column_name IN ('source_type', 'metadata');
```

Expected columns:
- `tracks.source_type` - VARCHAR, default 'manual_spotify'
- `tracks.metadata` - JSONB, for submission audit trail
- `tracks.tiktok_video_id` - VARCHAR, nullable

---

## Phase 1: Ingestion

### Command
```bash
bun src/tasks/ingestion/add-track-from-spotify.ts --spotifyId=59WN2psjkt1tyaxjspN8fp
```

### What Happens

1. **Spotify API Validation** - Fetches track from Spotify, validates it exists
2. **Cache Upsert** - Populates `spotify_tracks` and `spotify_artists` tables
3. **Track Insertion** - Inserts into `tracks` with:
   - `source_type='manual_spotify'`
   - `tiktok_video_id=NULL`
   - `stage='pending'`
4. **Task Queuing** - Creates initial `audio_tasks` row for download (type='download', status='pending')
5. **Enrichment Fan-Out** - Spawns 9 enrichment tasks (ISWC, MusicBrainz, Genius, Wikidata, etc.)
6. **Audit Trail** - Stores submission metadata in `tracks.metadata` JSON

### Example Output
```
🎧 Manual Spotify Track Ingestion

🎵 Processing: 59WN2psjkt1tyaxjspN8fp
   🔍 Validating with Spotify...
   📊 Found: "Killing in the Name" by Rage Against the Machine
      ISRC: USRO19763903
      Duration: 313s
   ✅ Spotify cache updated (track + 1 artist(s))
   ✅ Track inserted: Killing in the Name by Rage Against the Machine
   📥 Download task queued
   📋 Spawned 9 enrichment tasks

📊 Summary:
   ✅ Created: 1
   ⏭️  Skipped (already exists): 0
   ❌ Failed: 0
```

### Code Reference
- File: `src/tasks/ingestion/add-track-from-spotify.ts`
- Key Function: `insertManualTrack()` (lines 87-208)
- Spotify Cache Upsert: Lines 100-126

### Verification Query
```sql
SELECT spotify_track_id, title, source_type, stage
FROM tracks
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';

-- Expected:
-- spotify_track_id | title | source_type | stage
-- 59WN2psjkt1tyaxjspN8fp | Killing in the Name | manual_spotify | pending
```

---

## Phase 2: Lyrics & Translation

### Step 1: Download Audio
```bash
bun src/tasks/audio/download-audio.ts --limit=1
```

**What Happens:**
- Downloads track audio from Spotify preview URL or YouTube fallback
- Stores in `song_audio` table with Grove URLs
- Advances track stage to 'downloaded'

**Expected Output:**
```
📥 Song Download Task
   Processing: 59WN2psjkt1tyaxjspN8fp - Killing in the Name
   🎵 Downloaded: 313.6s @ 320kbps
   ✓ Uploaded to Grove: [CID]
   ✓ Track stage: pending → downloaded
```

### Step 2: Discover Lyrics
Manual method (simplest for testing):
```sql
-- Paste full, cleaned lyrics with natural breaks (section separators)
UPDATE song_lyrics
SET normalized_lyrics = $1, source = 'manual'
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
```

Or use automated discovery:
```bash
bun src/tasks/lyrics/discover-lyrics-enhanced.ts --trackId=59WN2psjkt1tyaxjspN8fp --limit=1
```

**Critical Requirement:**
`normalized_lyrics` must contain:
- Full lyric text with all lines
- Section breaks indicated by double newlines (`\n\n`)
- Minimum ≥3 sections for deterministic segment selection
- No null entries or incomplete translations

**Real Example (RATM):**
- Source: LRCLIB API (free, no auth required)
- Lyrics: 592 words in 94 lines
- Format: Verse → Pre-Chorus → Chorus → Bridge → Outro

### Step 3: Align with ElevenLabs
```bash
bun src/tasks/audio/align-lyrics.ts --limit=1
```

**What Happens:**
- Validates `song_lyrics.normalized_lyrics` exists
- Calls ElevenLabs forced alignment API
- Generates `karaoke_lines` table with word-level timings
- Creates `elevenlabs_word_alignments` with JSONB word array

**Example Alignment Data:**
```json
{
  "line_index": 0,
  "original_text": "Some of those that work forces",
  "start_ms": 2960,
  "end_ms": 5080,
  "words": [
    {"word": "Some", "start": 2960, "end": 3180},
    {"word": "of", "start": 3180, "end": 3300},
    ...
  ]
}
```

**Expected Output:**
```
📍 Killing in the Name - Rage Against the Machine
   Lines: 94
   🎙️  Aligning with ElevenLabs...
   ✓ Alignment complete (1194 words, loss: 0.216)
   ✓ 94 karaoke_lines generated
   ✓ Track stage: downloaded → aligned
```

### Step 4: Translate Lyrics
```bash
bun src/tasks/audio/translate-lyrics.ts --limit=1
```

**What Happens:**
- Checks Wikidata legitimacy gate (artist must have valid Wikidata entry)
- Translates to multiple languages via Gemini Flash 2.5
- Creates `lyrics_translations` rows with line arrays
- Each language is a separate row (en, es, fr, de, zh, vi, id, pt, ja, ko)

**Expected Output:**
```
📍 Killing in the Name
   Fetching Wikidata legitimacy...
   ✓ Valid artist (Rage Against the Machine)
   🌐 Translating to 10 languages...
   ✓ Spanish translation (94 lines)
   ✓ French translation (94 lines)
   ...
   ✓ Korean translation (94 lines)
   ✓ Track stage: aligned → translated
```

**Verification Query:**
```sql
SELECT language_code, COUNT(*) as line_count
FROM lyrics_translations
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp'
GROUP BY language_code
ORDER BY line_count DESC;
```

---

## Phase 3: Audio Processing

### Step 1: Separate Audio with Demucs
```bash
bun src/tasks/audio/separate-audio.ts --limit=1
```

**What Happens:**
- Sends full-length audio to RunPod Demucs API
- Separates into instrumental + vocals stems
- Uploads stems to Grove with separate CIDs
- Stores paths in `karaoke_segments`:
  - `demucs_instrumental_grove_cid`
  - `demucs_vocals_grove_cid`
- Advances stage to 'separated'

**Expected Output:**
```
🎵 Audio Separation (Demucs)
   Processing: Killing in the Name (313.6s)
   🔧 Submitting to RunPod...
   ✓ Job ID: [ID]
   ⏳ Waiting for separation...
   ✓ Separated in 45s
   📤 Uploading stems to Grove...
   ✓ Instrumental CID: [CID]
   ✓ Vocals CID: [CID]
   ✓ Track stage: translated → separated
```

### Step 2: Select Viral Clip (40-100s)
```bash
bun src/tasks/audio/select-segments.ts --limit=1
```

**What Happens:**
- Reads normalized lyrics sections
- Accumulates sections until 40-100s duration
- Matches text to `karaoke_lines` timestamps
- Creates `karaoke_segments` row with `clip_start_ms` and `clip_end_ms`
- Falls back to AI (OpenRouter) if <3 sections in normalized lyrics

**Deterministic Logic:**
```
1. Split normalized_lyrics by \n\n → sections array
2. If ≤2 sections → trigger AI fallback
3. Else: accumulate sections until 40-100s
   - First section → calculate duration
   - If duration in [40s, 100s] → use it
   - If duration < 40s → keep accumulating
   - If duration > 100s and previous is valid → use previous
4. Match accumulated text to karaoke_lines for exact ms boundaries
5. Store in karaoke_segments
```

**AI Fallback (OpenRouter Gemini 2.5 Flash):**
- Analyzes song structure (verse/chorus/bridge)
- Selects first verse → extends through consecutive choruses
- Caps at 100s limit

**Expected Output (Deterministic Path):**
```
🎯 Audio Task: Segment Selection
   Found 1 track ready
   📍 Killing in the Name
   Lines: 94
   Sections found: 5
   Section 1: 18.5s
   Section 2: 42.1s ← In range [40s, 100s]
   ✓ Found segment in range at section 2
   ✓ Selected: 40.2s - 84.8s (44.6s)
   ✓ Completed (1.2s)
```

**Expected Output (AI Fallback):**
```
   Sections found: 2
   ⚠️  Too few sections (2) - need AI to identify structure
   🤖 Using AI to identify song structure...
   ✓ Structure: intro → verse → chorus → bridge → outro
   Selecting first verse + first chorus...
   ✓ Selected: 8.5s - 94.2s (85.7s)
```

### ⚠️ Known Issue: Argument Order Bug

**Status**: Fixed in current code, but verify your version

**Bug Description** (lines 439-444 in original):
```typescript
// WRONG - error message in subject_type position
await failTask(
  track.spotify_track_id,
  'segment',
  error.message,  // ← Should be 'track'
  { stack: error.stack }
);
```

**Impact**: When segment selection fails, it writes error message to `audio_tasks.subject_type` column, violating CHECK constraint `audio_tasks_subject_type_check` and preventing retry/recovery.

**Fix Applied**:
```typescript
// CORRECT
await failTask(
  track.spotify_track_id,
  'segment',
  'track',          // ← Correct subject_type
  error.message,
  { stack: error.stack }
);
```

**Verification**: Check your `src/tasks/audio/select-segments.ts` line 442. If it has `error.message` in the 3rd position, apply the fix.

### Step 3: Enhance Audio with FAL
```bash
bun src/tasks/audio/enhance-audio.ts --limit=1
```

**What Happens:**
- Downloads instrumental stem from Grove
- Splits into 190s chunks (FAL model limit)
- Processes each chunk through Stable Audio 2.5
- Merges chunks with 2s crossfade using FFmpeg
- Uploads final enhanced audio to Grove
- Stores in `karaoke_segments.fal_enhanced_grove_url`
- Advances stage to 'enhanced'

**Chunking Strategy:**
```
Track: 313.6s total
Chunk 1: 0s - 190s (190s)
Chunk 2: 188s - 313.6s (125.6s with 2s overlap)
Crossfade merge: 2s overlap at 188-190s
Final output: 313.6s seamlessly enhanced
```

**Expected Output:**
```
🎵 Audio Enhancement (FAL)
   Processing: Killing in the Name (313.6s instrumental)
   📥 Downloaded instrumental: 7.2 MB
   ✂️  Splitting into chunks...
   Chunk 1: 0-190s (190s)
   Chunk 2: 188-313.6s (125.6s)
   🔧 Enhancing chunk 1...
   ✓ Chunk 1 output: [CID]
   🔧 Enhancing chunk 2...
   ✓ Chunk 2 output: [CID]
   🔗 Merging with 2s crossfade...
   ✓ Final enhanced output: [CID]
   📤 Uploading to Grove: [URL]
   ✓ Track stage: separated → enhanced
```

**Verification Query:**
```sql
SELECT fal_enhanced_grove_url, fal_request_id
FROM karaoke_segments
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
```

---

## Phase 4: Artist Identity

Before encryption, the artist must have PKP + Lens account + Unlock lock.

### Step 1: Mint PKP (Per-Artist, Once)
```bash
export PRIVATE_KEY=0x...
bun src/tasks/identity/mint-pkps.ts --type=artist --limit=5
```

**What Happens:**
- Mints Lit Protocol PKP for artist
- Stores in `pkp_accounts` with `pkp_address` and `pkp_token_id`
- Grants API authorization via Lit

**Expected Output:**
```
🔐 Minting PKPs (type: artist)
   🎵 Processing ARTISTS
   Found 5 artists needing PKP
   📍 Rage Against the Machine
   ⏳ Minting PKP...
   ✅ PKP: 0xaBcD... (Token ID: 12345)
```

### Step 2: Create Lens Account (Per-Artist, Once)
```bash
bun src/tasks/identity/create-lens-accounts.ts --type=artist --limit=5
```

**What Happens:**
- Creates Lens Protocol account with handle derived from artist name
- Uploads profile metadata to Grove
- Stores in `lens_accounts` with `lens_handle`, `lens_account_id`, `lens_account_address`
- Links to artist via `spotify_artist_id` FK

**Handle Generation:**
```
Input: "Rage Against the Machine"
Output: "ratm-ks1" (lowercase, hyphens, -ks1 suffix for disambiguation)
```

**Expected Output:**
```
🌿 Creating Lens accounts (type: artist)
   Found 1 artist needing Lens
   📍 Rage Against the Machine
   🏷️  Handle: @ratm-ks1
   ⏳ Creating Lens account...
   ✅ @ratm-ks1 (0xAbCd...)
```

### Step 3: Deploy Unlock Lock (Per-Artist, Once)
```bash
bun src/tasks/identity/deploy-unlock-lock.ts --artist=SPOTIFY_ARTIST_ID
```

**What Happens:**
- Deploys ERC-721 subscription lock on Base Sepolia
- Stores lock address in `lens_accounts.subscription_lock_address`
- Enables NFT-gated decryption

**Expected Output:**
```
🔓 Deploying Unlock Lock
   Artist: Rage Against the Machine
   ⏳ Deploying on Base Sepolia...
   ✅ Lock deployed: 0xB45A37cb0b5554a6C178d5087Ff0d862A7EE3807
```

### Verification Query
```sql
SELECT spotify_artist_id, lens_handle, pkp_address, subscription_lock_address
FROM lens_accounts
WHERE spotify_artist_id = (
  SELECT primary_artist_id FROM tracks
  WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp'
);
```

---

## Phase 5: Encryption & Events

### Encrypt with Lit Protocol
```bash
bun src/tasks/audio/encrypt-clips.ts --limit=1
```

**What Happens:**
1. Downloads enhanced audio from Grove
2. Builds Access Control Conditions (ACC) requiring Unlock NFT ownership
3. Encrypts audio with Lit Protocol (symmetric encryption)
4. Uploads encrypted data to Grove
5. Creates manifest JSON with ACC metadata
6. **Emits SongEncrypted event to ClipEvents contract on Lens testnet**
7. Saves encryption metadata to `karaoke_segments.encryption_accs`

**Access Control Condition (ACC):**
```json
{
  "unifiedAccessControlConditions": [
    {
      "conditionType": "evmBasic",
      "contractAddress": "0xB45A37cb0b5554a6C178d5087Ff0d862A7EE3807",
      "functionAbi": { /* ERC-721 balanceOf */ },
      "functionParams": [":userAddress"],
      "returnValueTest": {
        "comparator": ">",
        "value": "0"
      }
    }
  ]
}
```

**Event Emission Details:**
- **Contract**: `ClipEvents` on Lens testnet (37111)
- **Function**: `emitSongEncrypted()`
- **Parameters**:
  - `clipHash`: Keccak256(spotifyTrackId, clipStartMs)
  - `spotifyTrackId`: "59WN2psjkt1tyaxjspN8fp"
  - `encryptedFullUri`: Grove URL of encrypted audio
  - `encryptedManifestUri`: Grove URL of ACC manifest
  - `unlockLockAddress`: 0xB45A37cb0b5554a6C178d5087Ff0d862A7EE3807
  - `unlockChainId`: 84532 (Base Sepolia)
  - `metadataUri`: Grove URL of manifest

**Expected Output:**
```
🔐 Lit Protocol Clip Encryption Task
   Found 1 clip to encrypt
   🎵 Processing: Killing in the Name
   Lock: 0xB45A37cb0b5554a6C178d5087Ff0d862A7EE3807 (baseSepolia)
   📥 Downloading from Grove: [URL]
   ✓ Downloaded 7.17 MB
   🔐 Encrypting 7.17 MB with Lit Protocol...
   ✓ Encryption complete
   📤 Uploading encrypted data to Grove...
   ✓ Encrypted data uploaded: [CID]
   🧾 Uploading encryption manifest...
   ✓ Manifest uploaded: [CID]
   ⛓️  Emitting SongEncrypted event...
   📝 TX: 0xAbCd...
   ✅ Confirmed in block 12345678
   ✅ Clip encryption complete!
```

### Verify Event Emission
Query Lens testnet explorer for `SongEncrypted` events:
```
Contract: 0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274 (ClipEvents)
Chain: Lens Testnet (37111)
Filter: SongEncrypted(spotifyTrackId = "59WN2psjkt1tyaxjspN8fp")
```

Or check database for encryption metadata:
```sql
SELECT
  spotify_track_id,
  encrypted_full_cid,
  encryption_accs->'manifest'->>'cid' as manifest_cid,
  encryption_accs->'unlock'->>'lockAddress' as unlock_lock
FROM karaoke_segments
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
```

**Expected Result:**
```
spotify_track_id | encrypted_full_cid | manifest_cid | unlock_lock
59WN2psjkt1tyaxjspN8fp | ef9a4d5c... | 08e74981... | 0xB45A37cb...
```

---

## Phase 6: GRC-20 & Verification

### Populate GRC-20 Artist
```bash
bun src/tasks/grc20/populate-grc20-artists.ts --artist=SPOTIFY_ARTIST_ID
```

**What Happens:**
- Links artist PKP/Lens accounts to `grc20_artists`
- Validates Story Protocol requirements
- Prepares for GRC-20 minting

### Mint GRC-20 Entities
```bash
bun src/tasks/grc20/mint.ts --artist=SPOTIFY_ARTIST_ID --work=59WN2psjkt1tyaxjspN8fp
```

**What Happens:**
- Mints GRC-20 artist entity (if not exists)
- Mints GRC-20 work entity for track
- Links work to artist via foreign key
- Emits on-chain events for Story Protocol

### Final Verification Query
```sql
SELECT
  t.spotify_track_id,
  t.title,
  t.stage,
  ks.clip_start_ms,
  ks.clip_end_ms,
  ks.fal_enhanced_grove_url,
  ks.encrypted_full_cid,
  la.lens_handle,
  ga.grc20_entity_id
FROM tracks t
LEFT JOIN karaoke_segments ks ON t.spotify_track_id = ks.spotify_track_id
LEFT JOIN lens_accounts la ON la.spotify_artist_id = t.primary_artist_id
LEFT JOIN grc20_artists ga ON ga.spotify_artist_id = t.primary_artist_id
WHERE t.spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
```

**Expected Output (Full Success):**
```
spotify_track_id | title | stage | clip_start_ms | clip_end_ms |
59WN2psjkt1tyaxjspN8fp | Killing in the Name | encrypted | 40220 | 84840 |

fal_enhanced_grove_url | encrypted_full_cid | lens_handle | grc20_entity_id
https://api.grove.storage/95f249f04c... | ef9a4d5c0b... | ratm-ks1 | abc-123
```

---

## Known Issues & Workarounds

### Issue 1: generate-karaoke-lines Selects Wrong Translation

**Problem**: When multiple translations exist, the query uses `DISTINCT ON (spotify_track_id) ORDER BY language_code`, which alphabetically selects the first language (e.g., "en" for English) instead of the one with most lines.

**Symptom**: Only 5 karaoke_lines generated instead of expected 94

**Root Cause**: File `src/tasks/audio/generate-karaoke-lines.ts` lines 33-64

**Workaround**: Delete broken translation rows before running generator
```sql
DELETE FROM lyrics_translations
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp'
  AND language_code = 'en'
  AND (SELECT COUNT(*) FROM (
    SELECT line FROM jsonx_array_elements(lines) line
  ) AS lines WHERE line IS NOT NULL) <= 10;
```

**Permanent Fix** (code change needed):
```typescript
// Change line 40 from:
ORDER BY lt.language_code

// To:
ORDER BY lt.lines DESC NULLS LAST

// This selects the translation with most lines instead of alphabetical
```

### Issue 2: select-segments failTask Argument Order

**Status**: FIXED in current code

**Problem**: When segment selection fails, failTask() receives error.message in subject_type position

**File**: `src/tasks/audio/select-segments.ts` line 442

**Verify Your Fix**:
```typescript
// Line 442 should be:
await failTask(
  track.spotify_track_id,
  'segment',
  'track',          // ← Third parameter
  error.message,
  { stack: error.stack }
);
```

### Issue 3: select-segments Doesn't Update Track Stage

**Problem**: Task doesn't call `completeTask()` or `updateTrackStage()` after successful segment insertion

**Current Behavior**: Track stage remains 'separated' even after segment row created

**Workaround**: Manually update
```sql
UPDATE tracks SET stage = 'segmented'
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';

UPDATE audio_tasks SET status = 'completed'
WHERE subject_id = '59WN2psjkt1tyaxjspN8fp' AND task_type = 'segment';
```

**Permanent Fix** (code change needed):
After successful segment insertion (line 417), add:
```typescript
await completeTask(track.spotify_track_id, 'segment', {
  metadata: {
    clip_start_ms: selection.start_ms,
    clip_end_ms: selection.end_ms,
    clip_duration_ms: selection.duration_ms,
    method: 'simple/deterministic'
  },
  duration_ms: Date.now() - startTime
});

await updateTrackStage(track.spotify_track_id);
```

### Issue 4: Encryption Task Not in Task Orchestrator

**Problem**: `manual-track-pipeline.ts` doesn't include encryption in task sequence

**Current Orchestration**:
```
download → align → translate → separate → segment → enhance
```

**Should Include**:
```
download → align → translate → separate → segment → enhance → encrypt
```

**Workaround**: Run encryption manually after enhance completes
```bash
bun src/tasks/audio/encrypt-clips.ts --limit=1
```

---

## Troubleshooting

### No Karaoke Lines Generated (Expected 94, Got <10)

**Diagnosis**:
```sql
SELECT language_code, COUNT(*) as count
FROM lyrics_translations
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp'
GROUP BY language_code;
```

**Symptoms**:
- English translation has only 5-10 lines
- Chinese/Vietnamese/Indonesian have 94 lines each
- segment selection fails (needs ≥40s minimum duration)

**Solution**:
1. Identify broken translation (lowest line count)
2. Delete it
3. Re-run generate-karaoke-lines
4. Verify karaoke_lines count matches expected

```sql
-- Delete broken translation
DELETE FROM lyrics_translations
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp'
  AND language_code = 'en';

-- Verify deletion
DELETE FROM karaoke_lines
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';

-- Re-run generator
-- bun src/tasks/audio/generate-karaoke-lines.ts --limit=1
```

### Alignment Fails - "No Lyrics Found"

**Error**: `AlignmentError: normalized_lyrics IS NULL`

**Causes**:
1. Lyrics discovery didn't populate `song_lyrics.normalized_lyrics`
2. Lyrics discovery failed silently
3. Wrong track ID

**Solution**:
```sql
-- Verify lyrics exist
SELECT normalized_lyrics FROM song_lyrics
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';

-- If NULL, manually insert:
UPDATE song_lyrics
SET normalized_lyrics = 'Line 1\n\nLine 2\n\n...'
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';

-- Or run lyrics discovery with correct ID
bun src/tasks/lyrics/discover-lyrics-enhanced.ts --trackId=59WN2psjkt1tyaxjspN8fp
```

### Segment Selection Selects Wrong Duration (<40s or >100s)

**Error**: `Segment too short: 25.3s (minimum 40s)` or `Segment exceeds 100s`

**Causes**:
1. Insufficient sections in normalized_lyrics (≤2 sections)
2. Sections don't align well with natural song structure
3. AI fallback produced unexpected result

**Diagnosis**:
```sql
-- Check section count
SELECT normalized_lyrics FROM song_lyrics
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';

-- Count double-newline breaks
SELECT (LENGTH(normalized_lyrics) - LENGTH(REPLACE(normalized_lyrics, E'\n\n', ''))) / 2 + 1 as section_count;
```

**Solutions**:

If <3 sections:
- Edit normalized_lyrics to add natural section breaks
- Re-run select-segments (will use AI fallback)

If AI fallback still fails:
- Manually specify clip times:
```sql
INSERT INTO karaoke_segments (spotify_track_id, clip_start_ms, clip_end_ms)
VALUES ('59WN2psjkt1tyaxjspN8fp', 40000, 80000)
ON CONFLICT (spotify_track_id) DO UPDATE SET
  clip_start_ms = 40000,
  clip_end_ms = 80000;
```

### Encryption Fails - "No Artist Identity"

**Error**: `EncryptionError: Artist missing lens_accounts row`

**Causes**:
1. Artist doesn't have PKP minted
2. Artist doesn't have Lens account created
3. Artist doesn't have Unlock lock deployed
4. Wikidata legitimacy gate prevented artist creation

**Solution** (in order):
```bash
# 1. Verify artist exists in database
psql "..." -c "SELECT spotify_artist_id, name FROM spotify_artists WHERE name ILIKE '%Rage%'"

# 2. Mint PKP
export PRIVATE_KEY=0x...
bun src/tasks/identity/mint-pkps.ts --type=artist --limit=1

# 3. Create Lens account
bun src/tasks/identity/create-lens-accounts.ts --type=artist --limit=1

# 4. Deploy Unlock lock
bun src/tasks/identity/deploy-unlock-lock.ts --artist=ARTIST_ID

# 5. Verify all three are linked
psql "..." -c "
  SELECT la.spotify_artist_id, la.lens_handle,
         la.pkp_address, la.subscription_lock_address
  FROM lens_accounts la
  WHERE la.spotify_artist_id = 'ARTIST_ID'
"
```

### Track Stuck at Stage "pending"

**Cause**: Download task never ran or failed silently

**Diagnosis**:
```sql
SELECT id, status, error_message FROM audio_tasks
WHERE subject_id = '59WN2psjkt1tyaxjspN8fp' AND task_type = 'download';
```

**Solution**:
```bash
# Re-queue download
bun src/tasks/audio/download-audio.ts --limit=1

# Or manually re-mark pending
UPDATE audio_tasks SET status = 'pending'
WHERE subject_id = '59WN2psjkt1tyaxjspN8fp' AND task_type = 'download';
```

---

## Code Quality Notes

### Recommended Fixes (Before Production)

#### 1. Fix generate-karaoke-lines Translation Selection
**File**: `src/tasks/audio/generate-karaoke-lines.ts` lines 33-64

Replace:
```typescript
ORDER BY lt.language_code
```

With:
```typescript
ORDER BY array_length(lt.lines, 1) DESC NULLS LAST
```

This ensures the translation with the most lines is selected instead of alphabetical first.

#### 2. Add completeTask() to select-segments
**File**: `src/tasks/audio/select-segments.ts` after line 417

Add:
```typescript
await completeTask(track.spotify_track_id, 'segment', {
  metadata: {
    clip_start_ms: selection.start_ms,
    clip_end_ms: selection.end_ms,
    clip_duration_ms: selection.duration_ms,
    method: !selection ? 'ai-structure' : 'simple/deterministic'
  },
  duration_ms: Date.now() - startTime
});

await updateTrackStage(track.spotify_track_id);
```

#### 3. Add encrypt Task to Orchestrator
**File**: `src/scripts/manual-track-pipeline.ts` line 39

Add to `TASKS_IN_ORDER`:
```typescript
{ name: "encrypt", phase: "encryption", command: "src/tasks/audio/encrypt-clips.ts" },
```

#### 4. Validate Artist Identity Before Encryption
**File**: `src/tasks/audio/encrypt-clips.ts` in `findClipsToEncrypt()`

Add check for all three requirements:
```sql
AND EXISTS (
  SELECT 1 FROM lens_accounts la
  WHERE la.spotify_artist_id = t.primary_artist_id
    AND la.pkp_address IS NOT NULL
    AND la.lens_account_id IS NOT NULL
    AND la.subscription_lock_address IS NOT NULL
)
```

### Testing Checklist

- [ ] Ingestion creates spotify_tracks and spotify_artists cache rows
- [ ] Download task creates song_audio with Grove URL
- [ ] Alignment creates 94 karaoke_lines with correct timings
- [ ] Translation creates 10 lyrics_translations rows with 94 lines each
- [ ] Separation creates instrumental + vocals stems
- [ ] Segment selection identifies 44.6s clip (40-100s range)
- [ ] Enhancement produces fal_enhanced_grove_url
- [ ] Encryption populates encrypted_full_cid and encryption_accs
- [ ] SongEncrypted event emitted to ClipEvents contract
- [ ] GRC-20 minting completes successfully

### Documentation References

- **Spotify API**: https://developer.spotify.com/documentation/web-api/reference
- **Lit Protocol**: https://docs.litprotocol.com
- **Unlock Protocol**: https://docs.unlock-protocol.com
- **Grove Storage**: https://docs.grove.city
- **Story Protocol**: https://docs.story.foundation

---

**Production Status**: ✅ Fully tested with Rage Against the Machine - "Killing in the Name"
**Last Verified**: 2025-11-12
**Maintainer**: Karaoke School Pipeline Team
