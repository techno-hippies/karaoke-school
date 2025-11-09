# Karaoke Pipeline v2

Dual-format karaoke processing with encrypted full songs, public clips, and Web3 identity.

---

## 📍 Snapshot (2025-11-08)

- **Database**: `flat-mode-57592166` (Neon Postgres)
- **Tracks**: 9 imported
  - `ready`: 1
  - `segmented`: 4
  - `aligned` / `audio_ready`: remaining
- **Identity**:
  - PKP minted: Eminem (`0x9a36…Bc9`)
  - Lens handle format: `artist-name-ks1`
  - Unlock lock deployed: Eminem (`0x6b39…ca7d`, 0.0006 ETH / 30 days)
- **Content Security**: Lit Protocol encryption task wired to Unlock locks; schema columns live in `karaoke_segments`.

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

```bash
# 1. Configure environment
cp .env.example .env
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
   - `mint_pkp` → `create_lens` → `deploy_unlock`
3. Track encryption (requires `deploy_unlock` completed):
   - Segment encryption uses artist's Unlock lock for Lit Protocol ACCs

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