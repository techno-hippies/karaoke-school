# AI Agent Instructions - Karaoke Pipeline v2

**For Claude Code and other AI assistants working on this codebase**

---

## 🎯 Project Overview

Building a robust karaoke content processing pipeline that:
1. Ingests music from TikTok videos
2. Enriches metadata from multiple sources
3. Processes audio into dual-format karaoke tracks:
   - **Full song (encrypted)** - Lit Protocol + Unlock NFT access control
   - **Short clip (public)** - 40-60s AI-selected preview
4. Stores immutable content on load.network (decentralized IPFS)
5. Emits events to blockchain for subgraph indexing

---

## 📊 Current State

**Database**: `flat-mode-57592166` (Neon PostgreSQL, EU region)
**Status** (2025-01-07):
- ✅ 8 tracks with audio + synced lyrics ready
- ✅ All enrichment processors migrated
- ✅ PKP/Lens/GRC20 tables migrated (34 total tables)
- ✅ Storage abstraction created (Grove + load.network)
- ⏳ Karaoke processing IN PROGRESS (1/6 audio tasks migrated)
- ⏳ Ready to test alignment processor

---

## 🚨 Critical Rules

### Database Queries
**ALWAYS use MCP tools. NEVER use inline scripts or dotenvx.**

✅ **CORRECT**:
```typescript
// Use MCP run_sql tool
call_mcp_tool("run_sql", {
  params: {
    projectId: "flat-mode-57592166",
    databaseName: "neondb",
    sql: "SELECT * FROM tracks WHERE stage = 'audio_ready'"
  }
})
```

❌ **FORBIDDEN**:
```bash
# Never do this
dotenvx run bun -e "import { query } from './src/db'; ..."
bun -e "import { query } from './src/db/neon'; ..."
```

**Why**: MCP tools handle authentication via `.claude/settings.local.json`. Manual imports fail.

### Schema Changes

**Column naming convention**: Column names MUST match what they store.

✅ **CORRECT**:
```sql
ALTER TABLE karaoke_segments
  ADD COLUMN full_song_loadnetwork_cid TEXT,
  ADD COLUMN full_song_loadnetwork_url TEXT,
  ADD COLUMN clip_loadnetwork_cid TEXT,
  ADD COLUMN clip_loadnetwork_url TEXT;
```

❌ **WRONG**:
```sql
-- Don't use generic provider column
ADD COLUMN storage_provider TEXT; -- Error-prone!
```

### Contract/Subgraph Updates

**WAIT until pipeline is complete before updating contracts or subgraph.**

Reason: We need to finalize the karaoke processing pipeline and schema before touching blockchain infrastructure.

---

## 🏗️ Architecture

### Storage Strategy

**Grove** (temporary):
- Processing intermediate files
- Quick uploads during development
- Will be phased out

**load.network** (final):
- All immutable karaoke content
- Encrypted full songs
- Public clip previews
- Line-level metadata

### Dual-Format Processing

Every track generates TWO outputs:

**Format 1: Full Song**
- Complete enhanced instrumental (all chunks merged)
- Stored in 3 places:
  1. `full_song_loadnetwork_url` - Unencrypted (backup)
  2. `full_song_encrypted_loadnetwork_url` - Lit Protocol encrypted
  3. `full_song_lit_access_conditions` - JSONB access control rules
- Access: Requires Unlock Protocol subscription ($1.99/month per creator)

**Format 2: Short Clip**
- 40-60s segment (AI-selected verse + chorus)
- Stored: `clip_loadnetwork_url` - Unencrypted
- Access: Public, free

### Task Dependencies

**Enrichment Tasks** (parallel - can run simultaneously):
- `iswc_discovery`
- `musicbrainz`
- `genius_songs`
- `genius_artists`
- `wikidata_works`
- `wikidata_artists`
- `quansic_artists`
- `lyrics_discovery`

**Audio Tasks** (sequential - strict ordering):
1. `download` - yt-dlp + Soulseek → Grove
2. `align` - ElevenLabs word-level timing
3. `translate` - Gemini multi-language
4. `separate` - Demucs instrumental extraction
5. `enhance` - fal.ai quality improvement (chunked if >190s)
6. `select_segments` - AI-powered 40-60s clip selection
7. `generate_lines` - Split aligned lyrics into FSRS cards

---

## 📋 Next Steps (Priority Order)

### Immediate: Schema Updates

1. **Add missing tables from archived pipeline**:
   ```sql
   -- Copy these table definitions:
   - pkp_accounts (PKP wallet data)
   - lens_accounts (Lens + Unlock lock info)
   - grc20_artists (normalized artist entities)
   - grc20_works (normalized work entities)
   ```

2. **Update karaoke_segments for dual-format**:
   ```sql
   ALTER TABLE karaoke_segments
     ADD COLUMN full_song_loadnetwork_cid TEXT,
     ADD COLUMN full_song_loadnetwork_url TEXT,
     ADD COLUMN full_song_encrypted_loadnetwork_cid TEXT,
     ADD COLUMN full_song_encrypted_loadnetwork_url TEXT,
     ADD COLUMN full_song_lit_access_conditions JSONB,
     ADD COLUMN clip_loadnetwork_cid TEXT,
     ADD COLUMN clip_loadnetwork_url TEXT;
   ```

### Phase 2A: Storage Abstraction

Create `src/services/storage.ts`:
```typescript
interface StorageProvider {
  upload(buffer: Buffer, contentType: string, filename: string): Promise<{
    cid: string;
    url: string;
  }>;
}

class LoadNetworkProvider implements StorageProvider {
  // Upload to IPFS via load.network
}

class GroveProvider implements StorageProvider {
  // Existing Grove logic (temporary)
}
```

### Phase 2B: Migrate Audio Processors

Priority order:
1. **align-lyrics-forced.ts** (ElevenLabs) - CRITICAL (everything depends on timing)
2. **separate-audio.ts** (Demucs) - Can run parallel to alignment
3. **translate-lyrics.ts** (Gemini) - After alignment
4. **enhance-audio.ts** (fal.ai) - After separation, implements chunking
5. **select-segments.ts** - After enhancement, generates BOTH formats
6. **generate-lines.ts** - After segments, creates karaoke_lines

**Migration Pattern**:
```typescript
// src/tasks/audio/{task-name}.ts
export async function processTask(limit: number = 10) {
  const tasks = await getPendingAudioTasks('task_type', limit);

  for (const task of tasks) {
    try {
      // 1. Fetch input data
      // 2. Call external service (Demucs, fal.ai, etc.)
      // 3. Upload result to storage (Grove temporarily, load.network eventually)
      // 4. Update database
      // 5. Mark task completed

      await updateAudioTask(task.id, {
        status: 'completed',
        result_data: { ... }
      });
    } catch (error) {
      await updateAudioTask(task.id, {
        status: 'failed',
        error_message: error.message
      });
    }
  }
}
```

### Phase 3: Encryption & Deployment

**After karaoke pipeline works end-to-end:**
1. Integrate Lit Protocol encryption
2. Deploy Unlock locks per creator (code exists in `archived/`)
3. Update contracts for dual-format events
4. Update subgraph schema
5. Redeploy subgraph

---

## 🔍 Key Files & Locations

### Current Pipeline
```
new-karaoke-pipeline/
├── schema/
│   ├── 01-core.sql          # tracks, tiktok_*
│   ├── 02-tasks.sql         # enrichment_tasks, audio_tasks
│   ├── 03-caches.sql        # API caches
│   └── 04-data.sql          # song_*, karaoke_*
├── src/
│   ├── db/                  # Database layer
│   ├── services/            # External API integrations
│   ├── tasks/
│   │   ├── enrichment/      # ✅ Complete (10 processors)
│   │   ├── audio/           # ⏳ Not migrated yet
│   │   └── ingestion/       # ✅ Complete
```

### Reference (Old Pipeline)
```
archived/karaoke-pipeline/
├── src/
│   ├── processors/          # Old processors (reference)
│   │   ├── align-lyrics-forced.ts
│   │   ├── separate-audio.ts
│   │   ├── enhance-audio.ts
│   │   └── ...
│   ├── services/            # Service integrations to copy
│   │   ├── demucs.ts
│   │   ├── fal-audio.ts
│   │   ├── elevenlabs.ts
│   │   └── ffmpeg.ts
│   └── processors/
│       ├── deploy-artist-unlock-locks.ts  # Unlock deployment
│       └── mint-pkps.ts                   # PKP creation
```

---

## 💡 Common Tasks

### Check Pipeline Status
```bash
# Use MCP tool
call_mcp_tool("run_sql", {
  params: {
    projectId: "flat-mode-57592166",
    sql: "SELECT stage, COUNT(*) FROM tracks GROUP BY stage"
  }
})
```

### Add New Processor
1. Copy old processor from `archived/karaoke-pipeline/src/processors/`
2. Adapt to new task-based pattern (see migration examples)
3. Update to use MCP tools for DB queries
4. Test with `--limit=1` first
5. Add to orchestrator once working

### Test Individual Processor
```bash
# Each processor can run standalone
bun src/tasks/audio/align-lyrics.ts --limit=1
```

---

## 🎯 Success Criteria

**Phase 2 Complete When**:
- [ ] 8 tracks have word-level alignments
- [ ] 8 tracks have multi-language translations
- [ ] 8 tracks have separated audio (instrumental)
- [ ] 8 tracks have enhanced audio
- [ ] 8 tracks have dual-format outputs (full + clip) on load.network
- [ ] 8 tracks have karaoke_lines generated
- [ ] All audio stored on load.network (not grove)

**Phase 3 Complete When**:
- [ ] Full songs encrypted with Lit Protocol
- [ ] Unlock locks deployed for all creators
- [ ] Contracts emit dual-format events
- [ ] Subgraph indexes new schema
- [ ] App can access both formats correctly

---

## 📞 Questions & Debugging

**If stuck on architecture decisions**: Ask user before proceeding

**If processors fail**:
1. Check MCP tool responses
2. Verify external service availability (Demucs, fal.ai, etc.)
3. Check database constraints
4. Review old processor for edge cases

**If unsure about storage**: Use Grove temporarily, migrate to load.network later

---

**Remember**: We're building a production pipeline. Clean architecture now saves weeks of debugging later.
