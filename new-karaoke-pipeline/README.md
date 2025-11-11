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

### Audio Processing (sequential per track)

**Dual-Format Output**:
- **Full songs**: Enhanced instrumental, encrypted with Lit Protocol, gated by Unlock locks, emitted via `SongEncrypted`
- **Clips**: 40-100s public preview, emitted via `ClipRegistered`/`ClipProcessed`, no encryption

**Clip Selection**: Simple deterministic algorithm accumulates natural sections from song start until reaching 40-100s duration. Includes intro if lyrics start within 15s. Fast (1s vs 10s+ for AI), reliable, captures iconic openings.

| Stage | Command | Notes |
|-------|---------|-------|
| download | `src/tasks/audio/download-audio.ts` | Fills `song_audio` + sets `tracks.stage = audio_ready`. |
| align | `src/tasks/audio/align-lyrics.ts` | ElevenLabs timings. |
| translate | `src/tasks/audio/translate-lyrics.ts` | Gemini, multi-language. |
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