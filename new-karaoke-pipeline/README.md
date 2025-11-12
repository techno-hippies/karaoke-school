# Karaoke Pipeline v2

Dual-format karaoke processing with encrypted full songs, public clips, and Web3 identity.

---

## 📍 Snapshot (2025-11-10)

- **Database**: `flat-mode-57592166` (Neon Postgres)
- **Tracks**: 9 imported
  - `ready`: 5 tracks (enhanced audio + clips complete)
  - All stages complete through `clip` generation
- **Identity & Minting**:
  - PKPs minted: 9 artists
  - Lens accounts created: 9 artists (format: `artist-name-ks1`)
  - GRC-20 entities minted: 10 artists + 10 works ✅
  - Unlock locks deployed: 1 artist (Eminem `0x6b39…ca7d`, 0.0006 ETH / 30 days)
  - **Blocker**: 4 artists need Unlock lock deployment before full song encryption
- **Events**:
  - `ClipRegistered` + `ClipProcessed`: 1 emitted ✅
  - `SongEncrypted`: 0 emitted (blocked by missing Unlock locks)

---

## 🏗️ System Overview

### State & Task Separation

| Layer | Table | Purpose |
|-------|-------|---------|
| Track stage | `tracks.stage` | Linear milestone (`pending → … → ready`) enforced by schema. |
| Track tasks | `audio_tasks` | Per-track processor lifecycle (`pending/running/completed/failed`) with retries + metadata. |
| Artist tasks | `artist_tasks` | Per-artist operations (enrichment → identity → monetization) with explicit state tracking. |
| Enrichment | `enrichment_tasks` | Parallel metadata jobs (ISWC, Genius, Spotify, etc.). |
| Content | `karaoke_segments` | Dual-format audio (enhanced + clip) plus Lit encryption outputs. |
| Identity | `pkp_accounts`, `lens_accounts` | PKPs, Lens handles, Unlock lock addresses, pricing, chain. |

#### Two-Tier State Model

**Track-Level** (`audio_tasks`):
- Operations: download → align → translate → separate → segment → enhance → clip → encrypt
- Granularity: Per-track (each track processed independently)
- Updates `tracks.stage` via `updateTrackStage()` by analyzing completed audio_tasks

**Artist-Level** (`artist_tasks`):
- Operations: enrichment (Spotify, Quansic, Wikidata, Genius) → identity (mint_pkp, create_lens) → monetization (deploy_unlock)
- Granularity: Per-artist (one PKP, one Lens account, one Unlock lock serves all artist's tracks)
- Dependencies: Lens requires PKP; Unlock requires Lens; segment encryption requires Unlock

This architecture reflects the natural lifecycle difference:
- **Audio processing** is per-track: each song goes through the pipeline independently
- **Identity & monetization** is per-artist: one subscription lock gates all karaoke content from that artist

### Storage Strategy

- **Grove** – temporary intermediates (downloaded audio, fal.ai chunks, encryption ciphertext).
- **load.network** – immutable artifacts (final clips, metadata, lyrics, future encrypted payloads once promoted).

### Access Control Flow

1. Enhanced instrumental stored in `fal_enhanced_grove_url`.
2. Unlock lock deployed per artist; address/chain saved in `lens_accounts`.
3. `task:encrypt` downloads the instrumental, encrypts with Lit Protocol using ACC = “own any key from this lock”, uploads the ciphertext + manifest to Grove, persists `encrypted_full_cid/url` alongside the serialized ACC payload, and emits `SegmentEncrypted` on Lens testnet with the manifest URI.
4. The subgraph indexes `SegmentEncrypted`, exposing Unlock lock metadata to the app.
5. Client decrypts by proving key ownership through Lit’s auth context and fetching the manifest.

---

## 🚀 Getting Started

### Prerequisites

**Required Services** (must be running locally):

1. **Quansic Service** (port 3000) – Music metadata enrichment via headless browser automation
   ```bash
   cd api-services/quansic-service
   python main.py
   # Health check: curl http://localhost:3000/health
   ```

2. **Audio Download Service** (port 3001) – YouTube/P2P audio extraction
   ```bash
   cd api-services/audio-download-service
   bun run start
   # Health check: curl http://localhost:3001/health
   ```

**Environment Setup**:
```bash
# 1. Configure environment
cp .env.example .env
# Set QUANSIC_SERVICE_URL=http://localhost:3000
# Fill NEON_DATABASE_URL, SPOTIFY credentials, PRIVATE_KEY, GROVE API key…

# 2. Install dependencies
bun install

# 3. Database setup
bun db:migrate
bun db:status

# 4. Seed Spotify data (if tracks exist but artists are empty)

```

---

## 🔄 Core Pipelines

### Ingestion & Enrichment

1. **Resolve Spotify metadata**: `bun src/tasks/ingestion/resolve-spotify.ts --limit=10`
2. **Enrichment fan-out**: `enrichment_tasks` entries created automatically.
3. **Processor examples**:
   ```bash
   bun task:iswc --limit=25
   bun task:spotify-artists --limit=25
   ```

### TikTok Scraper (tt2dsp-aware)

Use the consolidated scraper to capture creator metadata, raw `tt2dsp` payloads, and canonical Spotify IDs in a single Playwright session.

```bash
DISPLAY=:0 TIKTOK_HEADLESS=false bun src/tasks/ingestion/scrape-tiktok.ts @creator_username [maxVideos]
```

- CAPTCHA solving: run with `TIKTOK_HEADLESS=false` so you can complete any challenges once per session.
- Storage: `tiktok_videos` now includes a `tt2dsp` JSONB column plus `spotify_track_id_source = 'tiktok_metadata'` for every Spotify match extracted from `tt_to_dsp_song_infos`.
- Validation query (MCP only):
  ```sql
  SELECT video_id,
         spotify_track_id,
         spotify_track_id_source,
         CASE WHEN tt2dsp IS NULL THEN 'missing'
              WHEN tt2dsp::text = '{}' THEN 'empty'
              ELSE 'present'
         END AS tt2dsp_status
  FROM tiktok_videos
  WHERE creator_username = 'idazeile'
  ORDER BY created_at DESC
  LIMIT 10;
  ```
- Debugging helpers:
  - `bun src/scripts/debug-tiktok-video.ts <video_id> [@creator]` – re-scrapes a creator and dumps normalized video data (including `tt2dsp` + `music.original`).
  - `bun src/scripts/test-music-original-hypothesis.ts` – batch-checks the `music.original` flag for recently scraped videos while reusing scraper sessions per creator.

When scraping multiple creators back-to-back, keep the Playwright window open and cycle through usernames to amortize CAPTCHA solves. Queue support for batching creators can be added later, but always prefer one long-lived browser session over repeated launches.

### Manual Spotify Ingestion (No TikTok Required)

Add songs directly from Spotify without needing TikTok discovery. Useful for:
- Songs you want to teach that don't have TikTok videos
- Testing specific track processing
- Batch imports of curated content

**Single Track**:
```bash
bun src/tasks/ingestion/add-track-from-spotify.ts --spotifyId=3n3Ppam7vgaVa1iaRUc9Lp
```

**Batch from File** (newline-separated Spotify IDs, `#` comments supported):
```bash
bun src/tasks/ingestion/add-track-from-spotify.ts --file=spotify_ids.txt
```

**Batch from stdin**:
```bash
cat spotify_ids.txt | bun src/tasks/ingestion/add-track-from-spotify.ts --batch
```

**How it works**:
1. Validates track exists on Spotify API
2. Inserts into `tracks` table with `source_type='manual_spotify'` and `tiktok_video_id=NULL`
3. Seeds initial `download` audio task (so download worker picks it up immediately)
4. Spawns enrichment task fan-out (ISWC, Genius, Wikidata, etc.)
5. Logs submission metadata for audit trail

**Schema Changes** (Migration 017, 2025-11-12):
- `tiktok_video_id` is now nullable: TikTok tracks have a value, manual Spotify tracks have NULL
- New `source_type` column: `'tiktok'` (TikTok-discovered) or `'manual_spotify'` (manual submission)
- New `metadata` JSONB column: stores audit trail (submission timestamp, notes, etc.)
- Partial unique index `idx_tracks_tiktok_not_null` protects TikTok uniqueness while allowing multiple NULLs
- Additional indexes: `idx_tracks_source_type`, `idx_tracks_manual_stage` for efficient queries

**Query to monitor manual tracks**:
```sql
SELECT source_type, stage, COUNT(*)
FROM tracks
GROUP BY source_type, stage
ORDER BY source_type, stage;
```

**Note**: Manual tracks follow the same enrichment → audio processing pipeline as TikTok tracks. No code changes needed downstream; the polymorphic `audio_tasks` design handles both sources seamlessly.

### Audio Processing (sequential per track)

**Dual-Format Output**:
- **Full songs**: Enhanced instrumental, encrypted with Lit Protocol, gated by Unlock locks, emitted via `SongEncrypted`
- **Clips**: 40-100s public preview, emitted via `ClipRegistered`/`ClipProcessed`, no encryption

**Clip Selection**: Simple deterministic algorithm accumulates natural sections from song start until reaching 40-100s duration. Includes intro if lyrics start within 15s. Fast (1s vs 10s+ for AI), reliable, captures iconic openings.

| Stage | Command | Notes |
|-------|---------|-------|
| download | `src/tasks/audio/download-audio.ts` | Fills `song_audio` + sets `tracks.stage = audio_ready`. |
| align | `src/tasks/audio/align-lyrics.ts` | ElevenLabs timings. |
| **normalize** | `src/tasks/lyrics/discover-lyrics-enhanced.ts` | **AI lyrics cleaning (Gemini Flash 2.5 Lite) - populates `normalized_lyrics` required by translate step.** |
| translate | `src/tasks/audio/translate-lyrics.ts` | Gemini, multi-language. **Requires `normalized_lyrics` from normalize step.** |
| separate | `src/tasks/audio/separate-audio.ts` | Demucs via RunPod. |
| segment | `src/tasks/audio/select-segments.ts` | Chooses 40–60s clip, populates `karaoke_segments`. |
| enhance | `src/tasks/audio/enhance-audio.ts` | fal.ai chunk merge, writes enhanced Grove URL. |
| clip | `src/tasks/audio/clip-segments.ts` | Final clip audio & metadata. |
| encrypt | `src/tasks/audio/encrypt-segments.ts` | Encrypt full track, upload manifest, emit `SegmentEncrypted`. |

Each task uses the helpers in `src/db/audio-tasks.ts` to set `audio_tasks.status` and then calls `updateTrackStage()`.

### Identity & Monetization

1. **Mint PKPs**
   ```bash
   export PRIVATE_KEY=0x...
    bun src/tasks/identity/mint-pkps.ts --type=artist --limit=5
   ```
2. **Create Lens accounts**
   ```bash
   bun src/tasks/identity/create-lens-accounts.ts --type=artist --limit=5
   ```
3. **Deploy Unlock locks**
   ```bash
   bun task:deploy-locks --artist=<spotify_artist_id>
   ```
4. **Encrypt segments**
   ```bash
   bun task:encrypt --limit=5
   ```

   - Emits `SegmentEncrypted` with manifest URI + Unlock lock metadata.
   - Persists Grove ciphertext + manifest URLs in `karaoke_segments`.

Resulting data lands in `pkp_accounts`, `lens_accounts`, and the encryption columns on `karaoke_segments`.

### GRC-20 Space & Minting

GRC-20 (Geo Resource Catalog) is a decentralized metadata standard for music entities. All artist and work metadata is published to IPFS and stored on-chain via the Geo Browser space.

**Core Files**:
- `src/config/grc20-space.ts` – Space ID, contract addresses, property/type/relation UUIDs, legacy properties list
- `src/tasks/grc20/setup-space.ts` – Idempotent schema bootstrap (creates properties, types, relations)
- `src/tasks/grc20/mint.ts` – Mints new artists and works from `grc20_artists` and `grc20_works` tables
- `src/tasks/grc20/update-artist-metadata.ts` – Updates existing artist entities (use when `needs_update = true`)
- `src/tasks/grc20/update-work-metadata.ts` – Updates existing work entities (use when `needs_update = true`)
- `src/tasks/grc20/utils/artist-values.ts` – Artist metadata value builder with all property mappings
- `src/tasks/grc20/utils/work-values.ts` – Work metadata value builder with all property mappings

**Prerequisites**

1. `.env` (or the parent env) must expose the Neon connection string (`NEON_DATABASE_URL`) and the Geo wallet `PRIVATE_KEY` used for the space.
2. If you have multiple Neon configs loaded, prefer overriding the URL per invocation to avoid stale credentials:
   ```bash
   NEON_DATABASE_URL='postgresql://neondb_owner:***@ep-royal-block-a4s10rvi-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' \ 
   bun run src/tasks/grc20/mint.ts
   ```

**Provision / Sync the Space Schema**

```bash
bun run src/tasks/grc20/setup-space.ts
```

This script uploads each missing property/type via `Ipfs.publishEdit` and submits personal-space edits through the space plugin. It is safe to re-run; existing entities are skipped.

**Mint Artists & Works**

```bash
bun run src/tasks/grc20/mint.ts
```

1. Reads unminted rows from `grc20_artists` and `grc20_works`.
2. Generates cover images (via Geo image entities) and entity ops.
3. Publishes a single edit for all artists, then another for all works.
4. Updates `grc20_entity_id`, `minted_at`, and clears `needs_update` locally once the transaction confirms.

The script prints both IPFS CIDs and transaction hashes so they can be cross-checked on Geo Testnet.

**Update Existing Entities**

When artist or work metadata changes in the database, flag entities for update and run the updater:

```bash
# Update all artists with new/changed metadata
bun run src/tasks/grc20/update-artist-metadata.ts

# Update all works with new/changed metadata
bun run src/tasks/grc20/update-work-metadata.ts
```

These scripts:
1. Query entities where `needs_update = true`
2. Build property values using the utils functions
3. Unset any properties that are now empty
4. Remove legacy properties (defined in `GRC20_LEGACY_ARTIST_PROPERTIES` / `GRC20_LEGACY_WORK_PROPERTIES`)
5. Update all property values in a single transaction
6. Clear the `needs_update` flag after successful update

**Data Formatting Standards**:
- **Release Dates**: ISO 8601 date-only format (YYYY-MM-DD). No time components. Example: `2020-03-20`
- **URLs**: Individual properties for each platform (Spotify, Genius, Wikidata, etc.). No JSON blobs.
- **Library IDs**: Separate properties for VIAF, BNF, GND, LOC. No aggregated JSON.
- **Aliases**: Flattened from JSONB `aliases->en` into TEXT `alternate_names` for backward compatibility.

**Removed Legacy Properties** (too large or redundant):
- `artistExternalIds` – redundant with individual URL fields
- `artistWikipediaUrls` – 70+ languages, queryable from Wikidata instead
- `artistLibraryIds` – redundant with separate VIAF/BNF/GND/LOC properties
- `workIsrc` / `workSpotifyTrackId` / `workSpotifyUrl` / `workImageSource` – moved to separate tracking

---

## 🧭 Operational Playbook

### Checking Progress

```bash
# Tracks by stage
call_mcp_tool("run_sql", { params: { projectId: "flat-mode-57592166", databaseName: "neondb", sql: "SELECT stage, COUNT(*) FROM tracks GROUP BY stage" } })

# Audio task status for a track
call_mcp_tool("run_sql", { params: { sql: "SELECT task_type, status, attempts FROM audio_tasks WHERE spotify_track_id = '3WMj8moIAXJhHsyLaqIIHI'" } })

# Segments awaiting encryption
call_mcp_tool("run_sql", { params: { sql: "SELECT spotify_track_id FROM karaoke_segments WHERE fal_enhanced_grove_url IS NOT NULL AND encrypted_full_cid IS NULL" } })
```

### Retrying Failures

- Inspect `audio_tasks.error_message` and `next_retry_at`.
- Fix upstream issue (API credentials, quota, etc.).
- Manually reset with `UPDATE audio_tasks SET status='pending', error_message=NULL WHERE id = …` (via MCP) and rerun the processor.

### Storage Rules

| Artifact | Location | Why |
|----------|----------|-----|
| Raw downloads / Demucs stems / Lit ciphertext | Grove | Cheap, mutable, good for intermediates. |
| Enhanced full track & clip audio | load.network (future) | Immutable distribution artifact. |
| Lyrics timing & metadata | load.network | Needed by dApp & subgraph. |

---

## 🧱 State Management Notes

### Two-Tier Design Principles

**Track-Level State** (`audio_tasks`):
- `tracks.stage` is constrained to audio milestones (`pending → ready`)
- Audio processors must use helpers in `src/db/audio-tasks.ts`:
  - `ensureAudioTask()` - Create task if doesn't exist
  - `startTask()` - Mark as in_progress
  - `completeTask()` - Mark as completed with result data
  - `failTask()` - Mark as failed with error and increment retry counter
  - `updateTrackStage()` - Recalculate track.stage based on completed tasks

**Artist-Level State** (`artist_tasks`):
- Separate lifecycle from tracks (one artist → many tracks)
- Identity/monetization processors must use helpers in `src/db/artist-tasks.ts`:
  - `createArtistTask()` - Queue a new task or reset failed task to pending
  - `startArtistTask()` - Mark as in_progress
  - `completeArtistTask()` - Mark as completed with result_data (PKP address, Lens handle, etc.)
  - `failArtistTask()` - Mark as failed with error and increment retry_count
  - `skipArtistTask()` - Mark as skipped when not applicable (e.g., no MusicBrainz match)
- Query functions for pipeline orchestration:
  - `findArtistsForTask()` - Find artists needing a specific task (never attempted or failed with retries remaining)
  - `findArtistsReadyForLens()` - PKP minted, Lens not created (dependency check)
  - `findArtistsReadyForUnlock()` - Lens created, Unlock not deployed (dependency check)

### Dependencies

**Sequential artist pipeline**:
1. Enrichment tasks (optional, parallel): spotify_enrichment, quansic_enrichment, wikidata_enrichment, genius_enrichment
2. Identity tasks (required, sequential):
   - `mint_pkp` → `create_lens` → `populate_grc20` → `mint_grc20` → `deploy_unlock`
3. Track encryption (requires `deploy_unlock` completed):
   - Segment encryption uses artist's Unlock lock for Lit Protocol ACCs

**Why GRC-20 comes BEFORE Unlock deployment**:
- Lens handles are stored in GRC-20 artist entities (immutable once minted)
- Unlock lock addresses are NOT in GRC-20 entities - they stay in `lens_accounts` only
- Locks can be deployed after GRC-20 minting without requiring entity updates
- Encryption depends on locks, but GRC-20 minting does not

### Integration Pattern

```typescript
// Artist task example (identity/mint-pkps.ts)
import { createArtistTask, startArtistTask, completeArtistTask, failArtistTask } from '../db/artist-tasks';

const artistId = '...';
await createArtistTask(artistId, 'mint_pkp');
await startArtistTask(artistId, 'mint_pkp');

try {
  const pkpAddress = await mintPkp(artistId);
  await completeArtistTask(artistId, 'mint_pkp', { pkp_address: pkpAddress });
} catch (error) {
  await failArtistTask(artistId, 'mint_pkp', error.message);
}

// Track task example (audio/download-audio.ts)
import { ensureAudioTask, startTask, completeTask, updateTrackStage } from '../db/audio-tasks';

const trackId = '...';
await ensureAudioTask(trackId, 'download');
await startTask(trackId, 'download');

try {
  const audioUrl = await downloadFromSpotify(trackId);
  await completeTask(trackId, 'download', { audio_url: audioUrl });
  await updateTrackStage(trackId); // Recalculates tracks.stage
} catch (error) {
  await failTask(trackId, 'download', error.message);
}
```

---

## 🛠️ Development Guidelines

1. **Use MCP for SQL** – never import the Neon client directly in ad-hoc scripts.
2. **Keep storage consistent** – Grove for transient data, load.network for immutable deliverables.
3. **Preserve handle suffix** – Lens handles are `sanitizeHandle(name) + '-ks1'`.
4. **Access control** – Lit ACCs must reference the artist’s Unlock lock (`balanceOf(:userAddress) > 0`).
5. **No manual stage edits** – let `updateTrackStage()` derive the stage from task completion.

---

## 📚 Reference

### State Management
- Track-level tasks: `src/db/audio-tasks.ts`
- Artist-level tasks: `src/db/artist-tasks.ts`
- Task enums & descriptions: `src/db/task-stages.ts`

### Identity & Access Control
- Identity helpers: `src/db/identity-queries.ts`
- PKP minting: `src/tasks/identity/mint-pkps.ts`
- Lens account creation: `src/tasks/identity/create-lens-accounts.ts`
- Unlock deployment: `src/tasks/identity/deploy-unlock-locks.ts`

### Storage & Encryption
- Storage abstraction: `src/services/storage.ts`
- Lit integration template: `src/tasks/audio/encrypt-segments.ts`

---

**Built for resilient karaoke processing with verifiable access control.**

---

## Current Pipeline Status (2025-01-11)
- **Tracks**: 20 total — 15 `ready`, 5 `pending`
- **Identity**: 15/15 PKPs, Lens handles, and Unlock locks deployed
- **GRC-20**: 15 artists + 15 works minted on Grove
- **Clips**: 15/15 created with 40–100s duration; encrypted full tracks available for all ready songs
- **Events**: `ClipRegistered`, `ClipProcessed`, and `SegmentEncrypted` emitted for ready tracks; `SongEncrypted` gated by Unlock deployment

## Audio Task Refactoring Snapshot
All stage-driven audio processors now share `BaseTask` with centralized config and strict metadata types.

- **7/7 core tasks migrated** (`align`, `translate`, `separate`, `select-segments`, `enhance`, `clip`, `generate-karaoke-lines`)
- **373 lines** of lifecycle boilerplate removed (~19% reduction)
- **100%** retry logic coverage via `buildAudioTasksFilter()`
- **Config** references replace magic numbers (e.g., 40–100s clip bounds, fal.ai chunk sizes)

### Task Status
| Task | Stage | Status | Notes |
|------|-------|--------|-------|
| `align-lyrics` | audio_ready → aligned | ✅ refactored | ElevenLabs, rate-limited hook |
| `translate-lyrics` | aligned → translated | ✅ **deployed** | Gemini Flash 2.5 Lite, Wikidata gate |
| `separate-audio` | translated → separated | ✅ refactored | Demucs via RunPod |
| `select-segments` | separated → segmented | ✅ refactored | Hybrid deterministic/AI with strict clip config |
| `enhance-audio` | segmented → enhanced | ✅ refactored | fal.ai Stable Audio 2.5 with chunk merge |
| `clip-segments` | enhanced → ready | ✅ refactored | FFmpeg clip + Grove upload |
| `generate-karaoke-lines` | n/a | ✅ refactored | Line-level FSRS data with working `--trackId` |
| `download-audio` | trigger | ⏭️ legacy | Delegates to download service; BaseTask not required |
| `encrypt-clips` | on-demand | ⏭️ deferred | Requires dedicated encryption workflow |

## Critical Fixes & Safeguards
- **Retry logic**: all refactored tasks append `buildAudioTasksFilter(this.taskType)` so `status`, `attempts < max_attempts`, and `next_retry_at` gates are respected.
- **Stage correctness**: `clip-segments` now queries `TrackStage.Enhanced`, matching `updateTrackStage()` progression.
- **Clip duration spec**: config split between `segment` (40–100s clips) and `falChunking` (190s fal.ai limit); selectors enforce spec ranges.
- **Metadata accuracy**: `select-segments` records `metadata.method` as either `deterministic` or `ai` for downstream analytics.
- **CLI overrides**: every refactored task parses `--trackId=<spotify_track_id>` and forwards it through `task.run({ trackId })`.
- **Backlog visibility**: `schema/06-audio-tasks-trigger.sql` installs `populate_audio_tasks()` so pending rows exist as soon as `tracks.stage` advances, restoring monitoring dashboards and manual reset tooling.

### Verify Backlog Trigger
```sql
-- Track count by stage
SELECT stage, COUNT(*) FROM tracks GROUP BY stage;
-- Pending tasks per processor
SELECT task_type, COUNT(*) FROM audio_tasks WHERE status = 'pending' GROUP BY task_type;
```
Values should stay aligned (e.g., tracks at `audio_ready` imply pending `align` tasks).

## Testing & Deployment Checklist
- [ ] Exhausted retry path: set `attempts = max_attempts` for a task, confirm it is skipped.
- [ ] Stage walk-through: process one track end-to-end and watch `tracks.stage` progress.
- [ ] Clip QA: ensure every `karaoke_segments` entry produces 40–100s clips.
- [ ] `--trackId` spot check: run each task with a specific ID and confirm only that track processes.
- [ ] Backlog trigger smoke test: update a track’s stage and confirm a pending `audio_tasks` row appears automatically.
- [ ] Production rollout: swap each `*-refactored.ts` into place after staging validation (keep originals suffixed `-old.ts` for one week).

## TikTok Pipeline (Language Learning)

Complete TikTok→Lens publishing workflow for language learning content.

**Architecture**:
- **STT**: Hybrid Voxtral STT + lyrics matcher + FA lookup (perfect timing segments)
- **Translation**: Gemini Flash 2.5 Lite translating FROM English TO learner languages (zh/vi/id)
- **Storage**: Multi-language schema with composite key `(video_id, language_code)`
- **Publishing**: Lens Protocol posts with preferred language (Chinese - largest demographic)

**Pipeline Tasks**:
```bash
# 1. Scrape TikTok videos
DISPLAY=:0 TIKTOK_HEADLESS=false bun src/tasks/ingestion/scrape-tiktok.ts @creator_username 10

# 2. Upload to Grove
bun src/tasks/tiktok/upload-grove.ts --limit=10

# 3. Transcribe with Voxtral hybrid STT
bun src/tasks/tiktok/transcribe.ts --limit=10

# 4. Translate to zh/vi/id
bun src/tasks/tiktok/translate.ts --limit=10

# 5. Post to Lens Protocol
bun src/tasks/tiktok/post-lens.ts --limit=10
```

**Database Schema**:
- `tiktok_videos` - Video metadata, Grove URLs
- `tiktok_transcripts` - Voxtral STT output with FA-aligned segments (text + language + timings)
- `tiktok_translations` - Multi-language translations with composite key `(video_id, language_code)`
- `lens_posts` - Published Lens posts with translation metadata

**Translation Strategy**:
- Direction: FROM English TO learner languages (zh/vi/id) for language learning
- Model: `google/gemini-2.5-flash-lite-preview-09-2025` via OpenRouter
- Rate limiting: 1s delay between languages
- Idempotent: Skips already-translated languages on re-run

**Post-Lens Selection**:
- Preferred language: Chinese (`zh`) - largest learner demographic globally
- Selects from `tiktok_translations` table filtering by `language_code = 'zh'`
- Posts include translated caption + original description + attribution

## Future Work
1. **encrypt-clips.ts** – introduce a Lit-specific base class or targeted refactor once Unlock/Lit flows stabilize.
2. **download-audio.ts** – document trigger semantics and retry expectations for the external service.
3. **Content pipeline** – apply BaseTask to `generate-translation-quiz`, `translate-trivia`, `emit-clip-events`, etc.
4. **Enrichment pipeline** – design `BaseEnrichmentTask` for the 7 processors currently using `enrichment_tasks`.
