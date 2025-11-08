# Karaoke Pipeline v2

**Clean task-based architecture for karaoke content processing with dual-format encrypted storage**

## 🎯 Current Status (2025-01-07)

**Database**: `flat-mode-57592166` (Neon PostgreSQL)
**Progress**:
- ✅ 8 tracks with audio + synced lyrics
- ✅ All enrichment processors migrated & complete
- ✅ Storage abstraction created (Grove + load.network)
- ⏳ 1/6 audio processors migrated (align-lyrics.ts ready to test)
- ⏳ 0 karaoke segments generated

## 🎯 What's Different?

### Old Pipeline Problems:
- ❌ Monolithic `song_pipeline` table with ambiguous statuses
- ❌ Boolean flag hell (`has_iswc`, `has_lyrics`, `has_audio`, etc.)
- ❌ "Reconciliation" needed before every run
- ❌ Parallel enrichment forced into linear state machine
- ❌ 66 migrations worth of technical debt
- ❌ Grove for all storage (centralized, proprietary)

### New Architecture:
- ✅ **Separate tables** for state vs. tasks
- ✅ **Clear task status** - no ambiguity
- ✅ **Independent retry** per task
- ✅ **Parallel execution** safe by design
- ✅ **No reconciliation** needed
- ✅ **Dual-format storage**: Encrypted full songs + public clips
- ✅ **load.network**: Decentralized IPFS storage for immutable content
- ✅ **Unlock Protocol**: $1.99/month per creator subscriptions

---

## 📐 Architecture

### Core Concepts

**`tracks` table** - Linear stage progression only:
- `pending` → `enriched` → `lyrics_acquired` → `audio_ready` → ... → `ready`

**`enrichment_tasks` table** - Parallel metadata gathering:
- `iswc_discovery`, `musicbrainz`, `genius_songs`, etc.
- Each task independent, can retry separately

**`audio_tasks` table** - Sequential audio processing:
- `download` → `align` → `translate` → `separate` → etc.
- Dependencies explicit, clear ordering

**Cache tables** - No changes from old pipeline:
- `spotify_tracks`, `quansic_recordings`, `musicbrainz_*`, etc.

---

## 🚀 Quick Start

### 1. Create Neon Database

```bash
# Via Neon Console (https://console.neon.tech)
# Create new project: "karaoke-pipeline-v2"
# Copy connection string
```

### 2. Setup Environment

```bash
cd new-karaoke-pipeline
cp .env.example .env
# Edit .env with your Neon connection string
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Run Migrations

```bash
bun db:migrate
```

### 5. Check Status

```bash
bun db:status
```

---

## 📊 Usage

### Run Enrichment Tasks

```bash
# ISWC Discovery (from pending tracks)
bun task:iswc --limit=50
```

### Monitor Progress

```bash
# View dashboard
bun db:status

# Query specific stage
psql $DATABASE_URL -c "SELECT * FROM tracks WHERE stage = 'pending' LIMIT 10"

# Check task status
psql $DATABASE_URL -c "SELECT * FROM task_summary"
```

---

## 🏗️ Schema Overview

### Core Tables
- `tracks` - Main track state
- `tiktok_creators` / `tiktok_videos` - Source data
- `enrichment_tasks` - Parallel enrichment
- `audio_tasks` - Sequential audio processing

### Cache Tables (from old pipeline)
- `spotify_tracks` / `spotify_artists`
- `quansic_recordings` / `quansic_artists`
- `musicbrainz_recordings` / `musicbrainz_works` / `musicbrainz_artists`
- `genius_songs` / `genius_artists`
- `wikidata_works` / `wikidata_artists`
- `mlc_works` / `bmi_works`

### Data Tables
- `song_lyrics` - Normalized lyrics
- `song_audio` - Audio files (Grove CIDs)
- `elevenlabs_word_alignments` - Word-level timing
- `lyrics_translations` - Multi-language
- `karaoke_segments` - Segment metadata
- `karaoke_lines` - Line-level data for FSRS

---

## 🔧 Development

### Adding a New Task

1. Create task processor in `src/tasks/enrichment/` or `src/tasks/audio/`
2. Define task logic (check cache → API → update task status)
3. Add to orchestrator
4. Test independently

Example structure:
```typescript
export async function processMyTask(limit: number = 50) {
  // 1. Get pending tasks
  const tasks = await getPendingEnrichmentTasks('my_task', limit);

  // 2. Process each task
  for (const task of tasks) {
    try {
      // Check cache
      // Call API if needed
      // Update task with result
      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'api_name',
        result_data: { ... }
      });
    } catch (error) {
      await updateEnrichmentTask(task.id, {
        status: 'failed',
        error_message: error.message
      });
    }
  }
}
```

---

## 📝 Migration Progress

### ✅ Phase 1: Infrastructure & Enrichment (COMPLETE)
- [x] Core schema design (4 SQL files)
- [x] Database connection layer
- [x] Task query helpers
- [x] 10 enrichment processors migrated
- [x] Audio download complete (8 tracks)
- [x] Lyrics discovery complete (8 tracks)

### 🚧 Phase 2: Karaoke Processing (IN PROGRESS)
- [x] Add PKP/Lens/GRC20 tables to schema ✅
- [x] Update karaoke_segments for dual-format storage ✅
- [x] Create load.network storage abstraction ✅
- [x] Migrate forced alignment processor (ElevenLabs) ✅ (ready to test)
- [ ] Migrate translation processor (Gemini)
- [ ] Migrate audio separation (Demucs)
- [ ] Migrate enhancement (fal.ai with chunking)
- [ ] Implement dual-format processing (full + clip)
- [ ] Migrate karaoke_lines generation

### ⏳ Phase 3: Infrastructure & Deployment (PENDING)
- [ ] Lit Protocol encryption integration
- [ ] Unlock Protocol lock deployment per creator
- [ ] Update contracts for dual-format events
- [ ] Update subgraph schema
- [ ] Redeploy subgraph
- [ ] End-to-end testing

---

## 🎓 Key Design Decisions

### Dual-Format Storage Architecture

**Problem**: Need both free previews (engagement) and paid access (creator revenue)

**Solution**: Generate TWO versions per track:
1. **Full Song (Encrypted)** - Complete karaoke track
   - Lit Protocol encryption with Unlock NFT access control
   - Stored on load.network (decentralized IPFS)
   - Also stored unencrypted (backup for re-encryption if needed)
   - Requires $1.99/month subscription to creator's Unlock lock

2. **Short Clip (Public)** - 40-60s AI-selected segment
   - Best verse + chorus section selected by Gemini
   - Stored unencrypted on load.network
   - Used for preview, practice, social sharing
   - Free access

**Access Control**:
- One Unlock Protocol lock per creator (not per track)
- Subscription grants access to ALL tracks by that creator
- Payment flows to creator's PKP address
- Lock deployed on Base Sepolia ($1.99 ETH/month)

### Why load.network Instead of Grove?

**Grove Issues**:
- Centralized (single point of failure)
- Proprietary API
- Temporary storage mindset

**load.network Benefits**:
- Decentralized CDN over IPFS
- HTTP-compatible (`https://ipfs.load.network/ipfs/{cid}`)
- Better for immutable content
- More resilient

**Strategy**: Grove for temporary processing files, load.network for final immutable content

### Why Separate `enrichment_tasks` from `tracks`?

- Enrichment is **parallel** (ISWC, MusicBrainz, Genius, Wikidata can run simultaneously)
- Tracks need **linear progression** (audio → alignment → translation → separation)
- Mixing these concepts causes the "umbrella status" problem

### Why No More `reconcile-status.ts`?

- Task status = source of truth
- No reverse-engineering from data presence
- If task says "completed", data exists. Period.

### Why JSONB for `result_data`?

- Each enrichment source returns different structure
- Cache tables still maintain normalized schemas
- JSONB allows flexible storage + easy querying

### Why Separate PKP/Lens/GRC20 Tables?

- **Normalization**: One PKP/Lens account can reference multiple entities (artists, creators)
- **Referential Integrity**: Foreign keys ensure data consistency
- **Unlock Integration**: Lens accounts store subscription lock addresses
- **GRC20 Compatibility**: Separate tables match public music metadata layer structure

---

## 📚 References

- Old pipeline: `../karaoke-pipeline/`
- Service integrations: Copy from old `src/services/`
- Migration scripts: `../karaoke-pipeline/schema/migrations/`

---

**Built with ❤️ for robust, maintainable karaoke processing**
