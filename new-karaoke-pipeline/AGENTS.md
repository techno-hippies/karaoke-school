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

## 🚨 Ground Rules

1. **Use MCP for SQL**. Do not import Neon clients or run inline scripts with DB credentials.
2. **Keep schemas consistent**. Column names describe contents; avoid generic fields like `provider`.
3. **Respect storage split**: temp uploads → Grove, final immutable data → load.network.
4. **Never regress `tracks.stage` manually**. Stages are recalculated by `updateTrackStage()` based on `audio_tasks` completion.
5. **Lens handle suffix**: always `sanitizeHandle(name) + '-ks1'`.
6. **Unlock + Lit**: ACCs must enforce ownership of the artist’s lock (`balanceOf(:userAddress) > 0`).

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
1. `download` → `audio_ready`
2. `align` → `aligned`
3. `translate` → `translated`
4. `separate` → `separated`
5. `enhance` → `enhanced`
6. `segment` → `segmented`
7. `clip` / `generate_lines` → `ready`
8. `encrypt` (on demand after Unlock lock exists) → emits `SegmentEncrypted`

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

---

## 📁 Key Files

- `README.md` – project overview & runbook (keep aligned with this doc).
- `src/db/audio-tasks.ts` – task helpers, stage recomputation.
- `src/db/task-stages.ts` – enums, derivation logic.
- `src/tasks/audio/encrypt-segments.ts` – Lit encryption template.
- `src/tasks/identity/deploy-unlock-locks.ts` – Unlock deployment workflow.
- `src/services/storage.ts` – Grove/load.network abstraction.

Archived pipeline (legacy reference) lives in `../karaoke-pipeline/`—copy patterns, but conform to new helpers and storage rules.

---

## 🧭 When Updating Docs or Code

- Keep README/AGENTS in sync; other markdown docs should not be introduced unless requested.
- Document new commands/state transitions in both README and here.
- Confirm database schema via MCP before relying on column names.
- Coordinate Lit/Unlock changes with identity tables—FKs must stay consistent.

---

**Build clean, deterministic processors, respect storage segregation, and always gate full-length audio through Unlock + Lit.**
