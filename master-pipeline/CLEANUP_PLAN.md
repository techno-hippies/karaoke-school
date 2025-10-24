# Pipeline Cleanup Plan

## Files to DELETE (Outdated/Replaced)

### 1. `scripts/pipeline-artist.ts` ❌
**Status**: OUTDATED - Replaced by unified account system

**Why delete**:
- Calls old separated scripts: `artists/01-mint-pkp.ts`, `artists/02-create-lens.ts`, `artists/03-register-artist.ts`
- These scripts have been replaced by `modules/accounts/01-create-account.ts` (unified system)
- Artist creation now uses `modules/artists/create-artist.ts` wrapper

**Replaced by**: `modules/artists/create-artist.ts`

---

### 2. `scripts/pipeline-full.ts` ❌
**Status**: OUTDATED - References wrong paths and manual workflow

**Why delete**:
- References old script paths like `artists/01-register-artist.ts` (doesn't exist)
- Manual step-by-step execution (we now have workflow orchestrators)
- Doesn't use event-driven architecture (The Graph)
- Song registration now automatic in video workflows

**Replaced by**:
- Song processing: `modules/creators/09-video-upload-flow.ts`
- Batch processing: `modules/creators/08-process-all-videos.ts`

---

### 3. `scripts/process-creator-full.sh` ❌
**Status**: OUTDATED - Uses old workflow without auto-creation

**Why delete**:
- Calls `05-process-video.ts` directly (we fixed this issue)
- No artist auto-creation (we added `10-auto-create-artist.ts`)
- No song auto-registration workflow
- Interactive shell script harder to maintain than TypeScript
- Missing segment processing integration

**Replaced by**: `modules/creators/08-process-all-videos.ts`
- ✅ Calls `09-video-upload-flow.ts` (includes song registration)
- ✅ Auto-creates artists before processing
- ✅ Batch processing with retry/resume
- ✅ Progress tracking
- ✅ TypeScript (type-safe, easier to maintain)

---

### 4. `config/artists.example.json` ❌
**Status**: UNUSED - No code references this

**Why delete**:
- No scripts read from this config
- Artists created via CLI args, not config files
- Configuration approach doesn't fit current architecture

---

## Files to KEEP (Still Useful)

### 1. `setup/01-deploy-spg-nft-contract.ts` ✅
**Status**: KEEP - One-time Story Protocol setup

**Purpose**: Deploy NFT collection contract for Story Protocol IP Asset minting
**Usage**: Run once per environment to set up SPG_NFT_CONTRACT

---

### 2. `scripts/set-metadata-uri.ts` ✅
**Status**: KEEP - Utility for manual updates

**Purpose**: Manually update Lens account metadata URI
**Usage**: Debug/fix metadata issues on existing accounts

---

### 3. `scripts/update-artist-avatar.ts` ✅
**Status**: KEEP - Utility for avatar updates

**Purpose**: Update avatar for existing artist accounts
**Usage**: Fix/update avatars after account creation

---

## Current Architecture (GOOD ✅)

### Modular Scripts (Single Responsibility)
```
modules/
├── accounts/
│   └── 01-create-account.ts          # Unified PKP + Lens + metadata
├── artists/
│   └── create-artist.ts               # Wrapper for verified artists
├── songs/
│   └── 01-register-song.ts            # Register + emit event
├── creators/
│   ├── 03-scrape-videos.ts            # Scrape TikTok
│   ├── 04-identify-songs.ts           # Identify songs
│   ├── 05-process-video.ts            # Process single video
│   ├── 06-mint-derivative.ts          # Story Protocol minting
│   ├── 07-post-lens.ts                # Post to Lens
│   ├── 08-process-all-videos.ts       # Batch orchestrator
│   ├── 09-video-upload-flow.ts        # Single video workflow
│   └── 10-auto-create-artist.ts       # Artist auto-creation
└── segments/
    └── 01-match-and-process.ts        # Segment processing
```

### Workflow Orchestrators
- **Single video**: `09-video-upload-flow.ts`
  - Process → Register song → Process segment → Post Lens

- **Batch videos**: `08-process-all-videos.ts`
  - Auto-create artists → Call 09-video-upload-flow.ts per video

- **Artist creation**: `10-auto-create-artist.ts`
  - Check The Graph → Create if needed

---

## Migration Guide

### Old → New Workflows

**Creating an artist:**
```bash
# ❌ OLD (pipeline-artist.ts)
bun scripts/pipeline-artist.ts --name beyonce --genius-id 498 --handle beyonce

# ✅ NEW
bun modules/artists/create-artist.ts --name beyonce --genius-id 498
```

**Processing creator videos:**
```bash
# ❌ OLD (process-creator-full.sh)
./scripts/process-creator-full.sh @brookemonk_ brookemonk

# ✅ NEW (automatic artist creation included)
bun modules/creators/03-scrape-videos.ts --tiktok-handle @brookemonk_
bun modules/creators/04-identify-songs.ts --tiktok-handle @brookemonk_
bun modules/creators/08-process-all-videos.ts --tiktok-handle brookemonk
```

**Processing single video:**
```bash
# ❌ OLD (manual steps)
bun modules/creators/05-process-video.ts --tiktok-handle @user --video-id 123
bun modules/songs/01-register-song.ts --genius-id 456
bun modules/creators/07-post-lens.ts --tiktok-handle @user --video-hash abc

# ✅ NEW (automatic)
bun modules/creators/09-video-upload-flow.ts --tiktok-handle @user --video-id 123
# This automatically: processes, registers song, processes segment, posts to Lens
```
