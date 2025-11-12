# AI Agent Instructions – Karaoke Pipeline v2

Updated guidelines for all assistants working in `new-karaoke-pipeline/`.

---

## 🎯 Mission

Deliver dual-format karaoke content sourced from TikTok:

1. Enrich metadata (Spotify, Genius, Wikidata, …).
2. Process audio into enhanced full tracks + public clips.
3. Secure full-length assets with Lit Protocol encryption gated by Unlock subscription locks per artist, publish manifests, and emit on-chain events.
4. Publish immutable artifacts to load.network once finalized.

---

## 📦 Environment & Data

- **Database**: `flat-mode-57592166` (Neon, EU). Access exclusively via MCP tools (`run_sql`, `run_sql_transaction`, etc.).
- **Storage**:
  - Grove → temporary intermediates (downloads, stems, ciphertexts).
  - load.network → immutable outputs (clips, metadata, future encrypted payloads).
- **Identity tables**: `pkp_accounts`, `lens_accounts` (store PKP/Lens/Unlock metadata). `karaoke_segments` holds encryption columns (`encrypted_full_cid/url`, `encryption_accs`, FK to `lens_accounts`).

---

## 🔧 Required Services

**The pipeline requires these local services to be running:**

1. **Quansic Service** (port 3000)
   - Purpose: Music metadata enrichment (ISNI, ISWC, IPI from Quansic database)
   - Location: `api-services/quansic-service/`
   - Start: `python main.py`
   - Environment: Set `QUANSIC_SERVICE_URL=http://localhost:3000` in pipeline `.env`
   - Mode: Runs headless (no browser windows)

2. **Audio Download Service** (port 3001)
   - Purpose: YouTube/P2P audio extraction for pipeline ingestion
   - Location: `api-services/audio-download-service/`
   - Start: `bun run start`
   - Environment: Configured via service's own `.env`

**Why local?** At small scale, local services are faster, easier to debug, and avoid network latency. Deploy to cloud when scaling.

---

## 🚨 Ground Rules

1. **Use MCP for SQL**. Do not import Neon clients or run inline scripts with DB credentials.
2. **Keep schemas consistent**. Column names describe contents; avoid generic fields like `provider`.
3. **Respect storage split**: temp uploads → Grove, final immutable data → load.network.
4. **Never regress `tracks.stage` manually**. Stages are recalculated by `updateTrackStage()` based on `audio_tasks` completion.
5. **Lens handle suffix**: always `sanitizeHandle(name) + '-ks1'`.
6. **Unlock + Lit**: ACCs must enforce ownership of the artist's lock (`balanceOf(:userAddress) > 0`).
7. **GRC-20 Legitimacy Gate**: Translation task (`translate-lyrics.ts`) blocks tracks without Wikidata, preventing expensive processing of illegitimate content. At 10K scale, saves $890 + 52.7 hours.

---

## 🧱 State Management Cheatsheet

| Layer | Location | Notes |
|-------|----------|-------|
| Track milestone | `tracks.stage` (enum) | Schema-validated: `pending → … → ready`. Identity/encryption milestones are *not* part of the enum. |
| Audio task lifecycle | `audio_tasks` | Use helpers in `src/db/audio-tasks.ts` (`ensureAudioTask`, `startTask`, `completeTask`, `failTask`, `updateTrackStage`). Includes retry metadata. |
| Enrichment jobs | `enrichment_tasks` | Parallel fan-out; each processor marks its own status + payload. |
| Identity/monetization | `pkp_accounts`, `lens_accounts` | PKP data, Lens handles, Unlock lock addresses, pricing, transaction hashes. |
| Encrypted assets | `karaoke_segments` | Enhanced audio URLs, encrypted CIDs, ACC JSON, FK to lens account. |

`TrackStage` definitions live in `src/db/task-stages.ts`. Do not invent new string literals—import enums instead.

---

## 🛠️ Core Workflows

### Enrichment & Ingestion
- Spotify resolution: `src/tasks/ingestion/resolve-spotify.ts`
- Enrichment processors (run as needed):
  ```bash
  bun task:iswc --limit=25
  bun task:spotify-artists --limit=25
  ```
- Verify artist metadata populated before identity tasks.

### Audio Pipeline (sequential per track)
1. `download` → `audio_ready` (free: TikTok/YouTube API)
2. `align` → `aligned` (free: ElevenLabs free tier)
3. **🚨 GRC-20 LEGITIMACY GATE** → blocks tracks without Wikidata before paid operations
4. `translate` → `translated` ($0.045/track: Gemini Flash 2.5 Lite × 3 languages)
5. `separate` → `separated` ($0.05/track: Demucs via RunPod, 45s)
6. `enhance` → `enhanced` ($0.35/track: fal.ai Stable Audio 2.5)
7. `segment` → `segmented` (free: local hybrid selection)
8. `clip` / `generate_lines` → `ready` (free: FFmpeg)
9. `encrypt` (on demand after Unlock lock exists) → emits `SegmentEncrypted`

**Gate Logic** (in `translate-lyrics.ts`):
- Query checks: `EXISTS (SELECT 1 FROM wikidata_artists WHERE spotify_id = primary_artist_id AND wikidata_id IS NOT NULL AND name IS NOT NULL AND name != wikidata_id)`
- Blocks tracks without Wikidata BEFORE translation, Demucs, and fal.ai
- Cost savings at 10K scale (20% illegitimate): $890 + 52.7 hours
- Example blocked: Terror Jr (no MusicBrainz → no Wikidata → never GRC-20 eligible)

Each processor must:
- Ensure task row exists.
- Mark `running` at start, `completed` on success (with metadata), `failed` on error.
- Call `updateTrackStage()` once artifacts are safely written.

### Identity & Monetization
1. Mint PKPs: `src/tasks/identity/mint-pkps.ts`
2. Create Lens accounts: `src/tasks/identity/create-lens-accounts.ts`
3. Deploy Unlock locks: `task:deploy-locks`
4. Encrypt segments: `task:encrypt`

Dependency chain: **enhanced audio + lock address → encryption task succeeds**.
Encryption task responsibilities:
- Generate Lit manifest, normalize ACC JSON, upload ciphertext + manifest to Grove.
- Emit `SegmentEncrypted` on Lens testnet with manifest URI + Unlock lock metadata.
- Persist manifest/ciphertext metadata in `karaoke_segments`.

### GRC-20 Metadata Publishing

**Complete Artist Dependency Chain**:
```
mint_pkp → create_lens → populate_grc20 → mint_grc20 → deploy_unlock → encrypt
```

**Why this order?**
- Lens handles are stored IN GRC-20 artist entities (immutable)
- Unlock lock addresses are NOT in GRC-20 - they stay in `lens_accounts` only
- Locks can be deployed after GRC-20 minting without entity updates
- Encryption requires locks, but GRC-20 minting does not

**Commands**:
1. Setup space schema: `bun src/tasks/grc20/setup-space.ts` (creates properties/types/relations)
2. Populate tables: `bun src/tasks/grc20/populate-grc20.ts` (copies enriched data to grc20_* tables)
3. Mint entities: `bun src/tasks/grc20/mint.ts` (new artists/works)
4. Update entities:
   - `bun src/tasks/grc20/update-artist-metadata.ts` (when `needs_update = true`)
   - `bun src/tasks/grc20/update-work-metadata.ts` (when `needs_update = true`)

**Data Standards**:
- Release dates: ISO 8601 date-only (YYYY-MM-DD), no time components
- URLs: Individual properties per platform, no JSON blobs
- Library IDs: Separate properties for VIAF/BNF/GND/LOC, no aggregated JSON
- Removed legacy: `artistExternalIds`, `artistWikipediaUrls`, `artistLibraryIds`

---

## 🔍 Operational Commands

```bash
# Tracks by stage
call_mcp_tool("run_sql", { params: { sql: "SELECT stage, COUNT(*) FROM tracks GROUP BY stage" } })

# Audio task summary per track
call_mcp_tool("run_sql", { params: { sql: "SELECT task_type, status, attempts FROM audio_tasks WHERE spotify_track_id = '<ID>'" } })

# Segments awaiting encryption
call_mcp_tool("run_sql", { params: { sql: "SELECT spotify_track_id FROM karaoke_segments WHERE fal_enhanced_grove_url IS NOT NULL AND encrypted_full_cid IS NULL" } })
```

To reset a failed task, clear the error via MCP and set `status='pending'`, then rerun the processor.

### TikTok Scraper Expectations

- Command: `DISPLAY=:0 TIKTOK_HEADLESS=false bun src/tasks/ingestion/scrape-tiktok.ts @creator_username [limit]`
- Always run visible when solving CAPTCHA; keep the browser open and rotate creators to amortize manual solves.
- Data contract:
  - `tiktok_videos.tt2dsp` stores the raw `tt_to_dsp_song_infos` JSONB payload.
  - `spotify_track_id` only persists when the 22-character pattern matches, and `spotify_track_id_source` must be `tiktok_metadata`.
  - Empty objects (`{}`) mean TikTok responded without DSP matches; use MCP queries to distinguish null vs empty.
- Debug helpers in `src/scripts/`:
  - `debug-tiktok-video.ts <video_id> [@creator]` — dumps the latest scraped payload, including `music.original` and each DSP mapping.
  - `test-music-original-hypothesis.ts` — batches creators and reuses scraper sessions to inspect whether `music.original = true` should nullify Spotify IDs.
- Clean working tree: delete temporary captures such as `captured-tiktok-responses.json` once you have the insights you need (they regenerate easily).

---

## 📁 Key Files

- `README.md` – project overview & runbook (keep aligned with this doc).
- `src/db/audio-tasks.ts` – task helpers, stage recomputation.
- `src/db/task-stages.ts` – enums, derivation logic.
- `src/tasks/audio/encrypt-segments.ts` – Lit encryption template.
- `src/tasks/identity/deploy-unlock-locks.ts` – Unlock deployment workflow.
- `src/services/storage.ts` – Grove/load.network abstraction.

**GRC-20 Metadata Management**:
- `src/config/grc20-space.ts` – Space/contract config, property IDs, legacy property lists
- `src/tasks/grc20/setup-space.ts` – Bootstrap space schema (properties/types/relations)
- `src/tasks/grc20/mint.ts` – Mint new artists and works
- `src/tasks/grc20/update-artist-metadata.ts` – Update existing artist entities
- `src/tasks/grc20/update-work-metadata.ts` – Update existing work entities
- `src/tasks/grc20/utils/artist-values.ts` – Artist property value builder
- `src/tasks/grc20/utils/work-values.ts` – Work property value builder

Archived pipeline (legacy reference) lives in `../karaoke-pipeline/`—copy patterns, but conform to new helpers and storage rules.

---

## 🧭 When Updating Docs or Code

- Keep README/AGENTS in sync; other markdown docs should not be introduced unless requested.
- Document new commands/state transitions in both README and here.
- Confirm database schema via MCP before relying on column names.
- Coordinate Lit/Unlock changes with identity tables—FKs must stay consistent.

---

## 🔁 Refactoring Status & Expectations
- All stage-driven audio tasks now extend `BaseTask`; keep new processors consistent with the existing pattern (`selectTracks`, `processTrack`, optional hooks).
- `buildAudioTasksFilter(this.taskType)` **must** be appended to every refactored task’s `SELECT` to honor `audio_tasks` retries/backoff.
- Every CLI wrapper supports `--trackId=<spotify_track_id>`; pass it through to `task.run({ trackId })` in new scripts.
- `schema/06-audio-tasks-trigger.sql` auto-creates pending rows when `tracks.stage` advances. When adding new stages or tasks, update the trigger & backfill accordingly.

### Operational Checks
- After stage updates, run:
  ```sql
  SELECT stage, COUNT(*) FROM tracks GROUP BY stage;
  SELECT task_type, COUNT(*) FROM audio_tasks WHERE status = 'pending' GROUP BY task_type;
  ```
  Counts should align (e.g., every `audio_ready` track implies a pending `align` task).
- Enforce clip duration spec (40–100 seconds) whenever manipulating `karaoke_segments`.
- Rate-limited services (ElevenLabs, fal.ai, OpenRouter) should use BaseTask hooks for pacing/logging.

### Testing Checklist Before Shipping Changes
1. Exercise the happy path with `--limit=1` and inspect `audio_tasks` + `tracks` rows.
2. Simulate exhausted retries by setting `attempts = max_attempts` and confirm the task is skipped.
3. If a change touches stage logic, validate the backlog trigger still inserts pending rows.
4. Run any new CLI with both batch mode and `--trackId=<id>` to ensure overrides work.

---

## 🎬 TikTok Pipeline (Language Learning)

**Mission**: Enable language learning by publishing TikTok videos to Lens Protocol with multi-language translations.

### Pipeline Flow
```
Scrape TikTok → Upload Grove → Transcribe (Voxtral hybrid STT) → Translate (zh/vi/id) → Post to Lens
```

### Key Design Decisions

**Translation Direction**:
- **FROM English TO learner languages** (zh/vi/id), NOT the reverse
- Purpose: Chinese/Vietnamese/Indonesian learners need English content translated to their native language
- Model: `google/gemini-2.5-flash-lite-preview-09-2025` via OpenRouter
- Cost: ~$0.001 per translation × 3 languages = $0.003/video

**Multi-Language Storage**:
- `tiktok_translations` table with composite primary key `(video_id, language_code)`
- Pattern: Mirrors `lyrics_translations` for consistency
- Idempotent: Re-running translate task only processes missing languages
- Migration 015 applied: Old single-language columns dropped from `tiktok_transcripts`

**Hybrid Voxtral STT Integration**:
- Voxtral STT provides multilingual transcripts
- Gemini Flash matches the clip text to full-song lyrics
- FA lookup reuses ElevenLabs timings for perfect segments
- Resulting segments stored in `tiktok_transcripts.transcript_segments`

**Lens Publishing**:
- Preferred language: Chinese (`zh`) - largest learner demographic globally
- Query: JOINs `tiktok_translations` filtering by `language_code = 'zh'`
- Post content: translated text + original description + TikTok attribution
- **CRITICAL SQL Fix**: All queries use table alias `t` (not `v`) to match `buildAudioTasksFilter()` expectations

### Task Files

| Task | File | Purpose |
|------|------|---------|
| Upload | `src/tasks/tiktok/upload-grove.ts` | Upload video/thumbnail to Grove |
| Transcribe | `src/tasks/tiktok/transcribe.ts` | Voxtral STT + lyrics matcher + FA timing |
| Translate | `src/tasks/tiktok/translate.ts` | Translate to ALL target languages (zh/vi/id) |
| Post | `src/tasks/tiktok/post-lens.ts` | Publish to Lens with preferred language |

### Common Pitfalls

1. **SQL Alias Mismatch**: `buildAudioTasksFilter()` hardcodes alias `t` in line 105/112. All queries MUST use `FROM tiktok_videos t`, NOT `FROM tiktok_videos v`.

2. **Translation Direction**: Always translate FROM source language TO target languages. Never assume English is the target.

3. **Transcription Pipeline**: Ensure Voxtral + lyrics matcher output segments before posting (segments drive karaoke overlay).

4. **Multi-Language Iteration**: Task must loop over ALL target languages, not just return first match. Check `existing_languages` array and only translate missing ones.

### Database Queries (MCP Only)

```sql
-- Check translations for a video (all 3 languages)
SELECT language_code, translated_text
FROM tiktok_translations
WHERE video_id = '7565931111373622550'
ORDER BY language_code;

-- Find videos missing translations
SELECT v.video_id, v.creator_username,
  ARRAY_AGG(DISTINCT tr.language_code) as existing_languages
FROM tiktok_videos v
LEFT JOIN tiktok_translations tr ON tr.video_id = v.video_id
WHERE v.video_id IN (SELECT video_id FROM tiktok_transcripts)
GROUP BY v.video_id, v.creator_username
HAVING COUNT(DISTINCT tr.language_code) FILTER (WHERE tr.language_code IN ('zh', 'vi', 'id')) < 3;

-- Verify Lens posts
SELECT tiktok_video_id, target_language, translated_text, lens_post_id
FROM lens_posts
WHERE tiktok_video_id = '7565931111373622550';
```

### End-to-End Test Results (2025-01-11)

**Video**: `7565931111373622550` (@gioscottii)
**Transcript**: "What is it?" (en)

**Translations**:
- zh: "那是什么？" ✅
- vi: "Nó là gì?" ✅
- id: "Apa itu?" ✅

**Lens Post**: `0x328dfb161198f3235cf48675faf55393b24b07e2946f5f60be6646e51be92b5e` ✅
**Published Language**: Chinese (zh) - preferred demographic

---

**Build clean, deterministic processors, respect storage segregation, and always gate full-length audio through Unlock + Lit.**
