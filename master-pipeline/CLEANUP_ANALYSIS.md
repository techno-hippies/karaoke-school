# Master Pipeline Cleanup Analysis

## Executive Summary

After deep file-by-file analysis, I've identified clear patterns of:
1. **Architectural migration** - Old Base Sepolia contracts → New event-driven system with The Graph
2. **Test files** mixed in with production code
3. **One-time utility scripts** in `/scripts` and `/workflows`
4. **Duplicate entry points** for the same functionality

## Current Pipeline Status: MIGRATION IN PROGRESS

The codebase shows a **V1 → V2 architectural transition**:
- **V1 (OLD)**: Direct smart contract interaction on Base Sepolia
- **V2 (NEW)**: Event emission → The Graph indexing → Grove storage

## Detailed File Analysis

### 🎤 Artists Module

#### ✅ KEEP (Active V2 Architecture)
- `create-artist.ts` - **PRIMARY**: Unified wrapper that calls accounts/01-create-account
- `01-mint-pkp.ts` - Mint PKP wallet (Step 1)
- `02-create-lens.ts` - Create Lens account (Step 2)
- `03-register-artist.ts` - **V2**: Emit events, use event-emitter system

#### ❌ DELETE (Obsolete V1)
- `01-register-artist.ts` - **OBSOLETE**: Direct contract calls to ArtistRegistryV1 on Base Sepolia
  - Requires manual PKP/Lens params
  - Uses old contract ABI
  - Replaced by create-artist.ts wrapper

**Recommendation**: Delete `01-register-artist.ts`, keep V2 system

---

### 🎵 Songs Module

#### ✅ KEEP
- `01-create-song.ts` - **V2**: Grove + events system, NEW architecture
- `01-register-song.ts` - **V2**: Grove + events system
- `02-fetch-mlc-data.ts` - Fetch MLC licensing data
- `03-build-metadata.ts` - Build complete metadata JSON

#### ⚠️  INVESTIGATE
**01-create-song.ts vs 01-register-song.ts** - These appear similar:
- Both create song with Grove metadata
- Both emit events
- Both use V2 architecture
- **NEED TO CHECK**: Are these duplicates or do they serve different purposes?

**Action**: Compare these two files side-by-side to determine if one should be removed

---

### 🎬 Segments Module

#### ✅ KEEP (Active V2)
- `01-match-and-process.ts` - **PRIMARY**: Core segment processing pipeline
- `01-create-segment.ts` - Orchestrator wrapper that calls 01-match-and-process
- `auto-create-segment.ts` - Automated segment creation without TikTok URLs
- `build-segment-metadata.ts` - Build segment metadata
- `build-segment-metadata-v2.ts` - V2 metadata builder
- `02-mint-segment-ip-asset.ts` - Story Protocol minting (optional feature)

#### ❌ DELETE (Obsolete V1)
- `02-register-segment.ts` - **OBSOLETE**: Direct contract interaction with SegmentRegistryV1
  - Uses cast CLI commands
  - Manual contract calls
  - Replaced by event system in 01-match-and-process

**Recommendation**: Delete `02-register-segment.ts`

---

### 👤 Creators Module

#### ✅ KEEP (All Active)
- `00-onboard-creator.ts` - Complete creator onboarding flow
- `01-mint-pkp.ts` - Mint creator PKP
- `02-create-lens.ts` - Create creator Lens account
- `03-scrape-videos.ts` - Scrape TikTok videos
- `04-identify-songs.ts` - Identify songs via Spotify/Genius
- `05-process-video.ts` - Process single video (download, STT, translate, Grove)
- `06-mint-derivative.ts` - Mint video as Story Protocol IP
- `07-post-lens.ts` - Post video to Lens
- `08-process-all-videos.ts` - Batch process videos with progress tracking
- `10-auto-create-artist.ts` - Auto-create artist if doesn't exist

#### ❌ DELETE (Test Files)
- `test-mint.ts` - **TEST SCRIPT**: Story Protocol minting test
  - Hardcoded test data
  - Not used in production flow

**Recommendation**: Delete `test-mint.ts` or move to `/tests`

---

### 📜 Scripts Directory

#### ⚠️  ONE-TIME UTILITIES (Archive or Delete)
- `update-artist-avatar.ts` - One-time script to update artist avatars from Genius
  - Manually updates Lens metadata
  - Not part of regular pipeline
  - **ACTION**: Archive to `archived/utilities/` or delete

- `set-metadata-uri.ts` - One-time script to set Lens account metadata URI
  - Manual Lens operations
  - Not part of regular pipeline
  - **ACTION**: Archive to `archived/utilities/` or delete

**Recommendation**: Create `archived/utilities/` directory for one-time scripts

---

### 🔄 Workflows Directory

#### ❌ DELETE (Obsolete Workflow)
- `add-video-segment.ts` - **SUPERSEDED**: Complete automation workflow
  - Was used before auto-create-segment.ts
  - Parses TikTok URLs → Spotify → Genius mapping
  - Now handled by modules/creators/ and modules/segments/
  - 393 lines of code doing what's now split across multiple focused modules

**Recommendation**: Delete `workflows/add-video-segment.ts` (completely superseded)

---

### 🧪 Services Directory (Test Files)

#### ❌ DELETE (Test Scripts)
- `test-segment-selector.ts` - Tests SegmentSelectorService
- `test-spotdl.ts` - Tests SpotDLService

**Recommendation**: Move to `/tests/services/` or delete if covered by actual tests

---

### 🧪 Tests Directory (Multiple Test Styles)

#### Current Structure:
```
tests/
├── integration/
│   ├── audio-matching.test.ts
│   └── audio-processing.test.ts
├── services/
│   ├── test-song-identification.ts
│   └── test-translation.ts
└── story-protocol/
    ├── test-docs-example.ts
    ├── test-manual-terms.ts
    ├── test-minimal.ts
    ├── test-no-license.ts
    ├── test-noncommercial.ts
    ├── test-story-beyonce.ts
    ├── test-story-mint-simple.ts
    └── test-story-raw-transaction.ts
```

#### ✅ KEEP
- `integration/` - Integration tests (good)
- `services/` - Service tests (good)

#### ⚠️  CONSOLIDATE
- `story-protocol/` - 8 different Story Protocol test files
  - Many seem to test the same functionality with slight variations
  - **ACTION**: Review and consolidate to 2-3 core tests

---

## Recommended Actions

### Phase 1: Delete Dead Code (Safe, No Dependencies)
```bash
# Delete obsolete V1 contract files
rm master-pipeline/modules/artists/01-register-artist.ts
rm master-pipeline/modules/segments/02-register-segment.ts

# Delete test files mixed in production code
rm master-pipeline/modules/creators/test-mint.ts
rm master-pipeline/services/test-segment-selector.ts
rm master-pipeline/services/test-spotdl.ts

# Delete superseded workflow
rm master-pipeline/workflows/add-video-segment.ts
```

### Phase 2: Archive One-Time Utilities
```bash
# Create archive directory
mkdir -p master-pipeline/archived/utilities

# Move one-time scripts
mv master-pipeline/scripts/update-artist-avatar.ts master-pipeline/archived/utilities/
mv master-pipeline/scripts/set-metadata-uri.ts master-pipeline/archived/utilities/

# Add README explaining these are one-time utilities
```

### Phase 3: Investigate Duplicates
```bash
# Compare these files to see if one should be removed:
diff master-pipeline/modules/songs/01-create-song.ts \
     master-pipeline/modules/songs/01-register-song.ts
```

### Phase 4: Consolidate Tests
```bash
# Review Story Protocol tests and consolidate
# Keep only the essential test cases
```

---

## Primary Pipeline Flow (Current Active System)

### For Individual Videos (Your Use Case)

#### Option A: Process Existing Creator's Videos
```bash
# 1. Scrape and identify videos
bun modules/creators/03-scrape-videos.ts --tiktok-handle @creator
bun modules/creators/04-identify-songs.ts --tiktok-handle @creator

# 2. Process single video (full flow: artist → song → segment → grove → lens)
bun modules/creators/05-process-video.ts \
  --tiktok-handle @creator \
  --video-id 7545183541190053142

# Behind the scenes, 05-process-video.ts:
# - Checks if song exists (via The Graph)
# - Auto-creates artist if needed (via 10-auto-create-artist.ts)
# - Auto-creates song if needed (via songs/01-create-song.ts)
# - Processes video (download, STT, translate)
# - Uploads to Grove
# - Creates manifest

# 3. (Optional) Mint on Story Protocol
bun modules/creators/06-mint-derivative.ts \
  --tiktok-handle @creator \
  --video-hash <hash>

# 4. (Optional) Post to Lens
bun modules/creators/07-post-lens.ts \
  --tiktok-handle @creator \
  --video-hash <hash>
```

#### Option B: Batch Process All Videos
```bash
bun modules/creators/08-process-all-videos.ts \
  --tiktok-handle @creator \
  --parallel 2
```

### For Manual Song/Segment Creation

#### Create Song → Segment
```bash
# 1. Create song
bun modules/songs/01-create-song.ts \
  --genius-id 10047250 \
  --artist-username beyonce

# 2. Create segment (auto-select iconic part)
bun modules/segments/auto-create-segment.ts \
  --genius-id 10047250 \
  --spotify-id 0V3wPSX9ygBnCm8psDIegu
```

---

## Architecture Summary

### V2 Event-Driven Architecture (Current)
```
Frontend/Backend
    ↓
Emit Event (Lens Chain EventRegistry)
    ↓
The Graph (Indexes events)
    ↓
Query via GraphQL
    ↓
Frontend displays data
```

**Storage:**
- Metadata: Grove (IPFS)
- Media: Grove (IPFS)
- On-chain: Events only (no contract state)

### V1 Direct Contract Architecture (Obsolete)
```
Frontend/Backend
    ↓
Write to Contract (Base Sepolia)
    ↓
Query Contract directly
    ↓
Frontend displays data
```

**Storage:**
- Metadata: Contract storage (expensive)
- Media: External URIs
- On-chain: Full state in contracts

---

## File Inventory

### Total TypeScript Files (excluding node_modules):
- **lib/**: 30 files (shared utilities, schemas, services)
- **modules/**:
  - accounts: 1
  - artists: 5 (2 obsolete)
  - creators: 11 (1 test)
  - lens: 0 (directory empty or merged)
  - segments: 7 (1 obsolete)
  - songs: 4 (possible duplicate)
- **services/**: 20 files (2 test)
- **scripts/**: 2 (both one-time utilities)
- **workflows/**: 1 (obsolete)
- **tests/**: 13 files (consolidation needed)
- **setup/**: 1

**Total**: ~95 production files + tests

---

## Next Steps

1. ✅ Delete confirmed dead code (Phase 1)
2. ✅ Archive utilities (Phase 2)
3. ⚠️  Investigate song module duplicates (Phase 3)
4. ⚠️  Test video processing flow end-to-end
5. ✅ Create single comprehensive README
6. ⚠️  Consolidate Story Protocol tests

---

## Questions to Answer

1. **Song modules**: Is `01-create-song.ts` or `01-register-song.ts` the canonical way? Do both need to exist?
2. **Video processing**: Does the auto-artist/auto-song creation work correctly in 05-process-video.ts?
3. **Story Protocol**: Which test files are actually useful vs experimental?
4. **Build segment metadata**: Why are there both `build-segment-metadata.ts` and `build-segment-metadata-v2.ts`?

---

Generated: 2025-10-24
