# Pipeline Status & Roadmap

**Last Updated**: 2025-11-08
**Database**: ep-royal-block (Neon PostgreSQL)
**Total Tracks**: 9

---

## 🎵 Audio Pipeline Progress

| Stage | Complete | Status | Notes |
|-------|----------|--------|-------|
| Download | 8/9 | ✅ 89% | Audio downloaded from YouTube/Spotify |
| Align | 8/9 | ✅ 89% | ElevenLabs word-level timing |
| Translate | 8/9 | ✅ 89% | Lyrics translated to multiple languages |
| Separate | 7/9 | ⚠️ 78% | Demucs stem separation (vocals/instrumental) |
| Segment | 5/9 | ⚠️ 56% | Viral clip selection (40-100s verse+chorus) |
| Enhance | 2/9 | 🔴 22% | fal.ai audio enhancement (2-chunk w/ crossfade) |
| Clip | 2/9 | 🔴 22% | FFmpeg crop to viral boundaries + Grove upload |

**Pipeline Flow**:
```
TikTok/Manual → Download → Align → Translate → Separate → Segment → Enhance → Clip
                                                              ↓          ↓
                                                          Full Song   Viral Clip
                                                          (228s)      (~55s)
```

**Test Track** (fully complete): `3WMj8moIAXJhHsyLaqIIHI` - "Something in the Orange" by Zach Bryan
- Segment: 32.7s - 88.0s (55.3s)
- Enhanced: Grove CID `d2fa6bb...`
- Clip: Grove CID `12e85ef...`

---

## 🚧 Remaining Audio Tasks

### 1. Complete Enhancement Pipeline (5/9 tracks)
- **Task**: `bun task:enhance --limit=10`
- **Time**: ~3-4 min per track (fal.ai processing)
- **Cost**: $0.01-0.02 per track
- **Blocker**: None - ready to run

### 2. Complete Clip Creation (5/9 tracks)
- **Task**: `bun task:clip --limit=10`
- **Time**: ~10s per track (FFmpeg crop + upload)
- **Dependency**: Enhancement must complete first
- **Blocker**: Waiting on task #1

---

## 🎭 Identity & Blockchain Tasks

### PKP Minting (Lit Protocol)
- **Purpose**: WebAuthn-based authentication for artists/creators
- **Network**: Chronicle Yellowstone (Lit Protocol testnet)
- **Schema**: `pkp_accounts` table (polymorphic: artists OR tiktok_creators)
- **Status**: ❌ Not started
- **Eligibility**:
  - **Artists**: Must have `spotify_artist_id` (from enriched tracks)
  - **TikTok Creators**: Must have `tiktok_handle` from scraped videos
- **Implementation**: `src/tasks/identity/mint-pkps.ts` (to be created)
- **Estimate**: ~15-20 PKPs needed (unique artists + creators)

### Lens Account Creation
- **Purpose**: Social graph integration, content distribution
- **Network**: Lens Testnet (37111)
- **Schema**: `lens_accounts` table (links to PKP via `pkp_address`)
- **Status**: ❌ Not started
- **Dependency**: PKP minting must complete first
- **Additional**: Unlock Protocol lock deployment per artist
  - Lock contract address stored in `lens_accounts.unlock_lock_address`
  - Only for artists with `spotify_artist_id` (not TikTok creators)
- **Implementation**: `src/tasks/identity/create-lens-accounts.ts` (to be created)

---

## 🏛️ GRC-20 Tasks

### GRC-20 Artist Population
- **Purpose**: Mint artist entities on Grove's public music metadata layer
- **Schema**: `grc20_artists` table
- **Status**: ❌ Schema exists, no data populated
- **Data Source**: Enriched `spotify_artists`, `musicbrainz_artists`, `wikidata_artists`
- **Eligibility**: Artists from completed tracks (not all Spotify artists)
- **Implementation**: `src/tasks/grc20/populate-artists.ts` (to be created)
- **Estimate**: ~15-20 unique artists across 9 tracks

### GRC-20 Work Population
- **Purpose**: Mint musical work entities (compositions)
- **Schema**: `grc20_works` table
- **Status**: ❌ Schema exists, no data populated
- **Data Source**: Tracks with ISWCs from BMI/MLC/MusicBrainz
- **Dependency**: GRC-20 artist population (works reference artists)
- **Implementation**: `src/tasks/grc20/populate-works.ts` (to be created)

### GRC-20 Recording Population
- **Purpose**: Mint recording entities (specific performances)
- **Schema**: `grc20_recordings` table
- **Status**: ❌ Schema exists, no data populated
- **Data Source**: `tracks` table with completed audio pipeline
- **Dependency**: GRC-20 work population (recordings reference works)
- **Implementation**: `src/tasks/grc20/populate-recordings.ts` (to be created)

### GRC-20 Minting (Blockchain)
- **Purpose**: Submit populated entities to Grove blockchain
- **Network**: Grove blockchain (public music metadata layer)
- **Status**: ❌ Not started
- **Dependency**: All population tasks complete
- **Order**: Artists → Works → Recordings
- **Implementation**: Reuse archived scripts from `archived/karaoke-pipeline/scripts/migration/`

---

## 🔐 Unlock Protocol Integration

### Artist Lock Deployment
- **Purpose**: Paywall for encrypted full-length audio access
- **Network**: Base Sepolia (Unlock Protocol supported)
- **Eligibility**: **Only artists with `spotify_artist_id`** (not TikTok creators)
- **Schema**: Lock address stored in `lens_accounts.unlock_lock_address`
- **Status**: ❌ Not started
- **Documentation**: `archived/karaoke-pipeline/UNLOCK-PROTOCOL-INTEGRATION.md`
- **Implementation**: `src/tasks/unlock/deploy-artist-locks.ts` (to be created)
- **Flow**:
  1. For each artist with PKP + Lens account + `spotify_artist_id`
  2. Deploy Unlock lock contract on Base Sepolia
  3. Store lock address in `lens_accounts`
  4. Configure price (e.g., 0.001 ETH per unlock)

### Audio Encryption
- **Purpose**: Encrypt full-length enhanced audio (not viral clips)
- **Target**: Files in `karaoke_segments.fal_enhanced_grove_url` (full song ~228s)
- **Clear**: Viral clips in `karaoke_segments.clip_grove_url` remain unencrypted (~55s)
- **Status**: ❌ Not started
- **Method**: Lit Protocol encryption (access controlled by Unlock lock purchase)
- **Schema**: Add `encrypted_grove_url` column to `karaoke_segments`
- **Implementation**: `src/tasks/unlock/encrypt-full-songs.ts` (to be created)
- **Flow**:
  1. Download full enhanced audio from Grove
  2. Encrypt with Lit Protocol (access condition: owns artist's Unlock key)
  3. Upload encrypted file to Grove
  4. Store encrypted URL in database

---

## 🎮 Trivia Question Generation (NEW)

### Purpose
Generate trivia questions per song using Genius referents and web search for educational/gamification features.

### Data Sources
1. **Genius Referents**:
   - Already cached in `genius_songs.referents` JSONB column
   - Contains annotations/explanations for specific lyric fragments
   - Example: Cultural references, wordplay, hidden meanings

2. **Web Search** (to be integrated):
   - Service: TBD (Brave Search API, Perplexity, or Exa)
   - Query: Song facts, chart performance, awards, production trivia

### Schema (to be created)
```sql
CREATE TABLE song_trivia (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT REFERENCES tracks(spotify_track_id),

  -- Question data
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  incorrect_answers TEXT[] NOT NULL,  -- Array of 3 wrong answers
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('genius_referent', 'web_search', 'lyrics_analysis')),
  source_url TEXT,  -- Link to Genius annotation or source article

  -- Categorization
  category TEXT CHECK (category IN ('lyrics', 'production', 'chart_history', 'artist_fact', 'cultural_reference')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Implementation Plan
1. **Genius Referent Processing** (`src/tasks/trivia/generate-from-genius.ts`):
   - Parse `referents` JSONB from `genius_songs`
   - Extract lyric fragment + annotation
   - Use Gemini Flash to generate multiple-choice questions
   - Category: 'lyrics' or 'cultural_reference'

2. **Web Search Integration** (`src/tasks/trivia/generate-from-web.ts`):
   - Query web search API for song facts
   - Use LLM to extract verifiable facts
   - Generate questions about chart performance, awards, production
   - Category: 'chart_history', 'production', 'artist_fact'

3. **Quality Control**:
   - Verify factual accuracy (compare multiple sources)
   - Ensure incorrect answers are plausible but wrong
   - Flag questions for human review if confidence < 0.8

### Status
- ❌ Not started
- **Dependency**: Genius songs already enriched (8/9 tracks have data)
- **Estimate**: 5-10 questions per song, ~50-90 total

---

## 🧹 Code Quality & Refactoring

### Critical (Before New Features)

1. **Stage Enum Consolidation**:
   - **Issue**: `enhance-audio.ts` references non-existent `select_segments` stage
   - **Fix**: Create `src/db/task-stages.ts` with canonical enum:
     ```typescript
     export const TASK_STAGES = [
       'download', 'align', 'translate', 'separate',
       'segment', 'enhance', 'clip'
     ] as const;
     export type TaskStage = typeof TASK_STAGES[number];
     ```
   - **Impact**: All tasks import from single source of truth

2. **Storage Service Consolidation**:
   - **Issue**: `uploadToGrove()` exported from both `services/storage.ts` and `services/grove.ts`
   - **Fix**: Single `StorageService` class with Grove/load.network selection
   - **Files**: Update `enhance-audio.ts`, `clip-segments.ts`, `separate-audio.ts`

3. **Stage Tracking Deduplication**:
   - **Issue**: `db/audio-tasks.updateTrackStage()` conflicts with `db/queries.updateTrackStage()`
   - **Fix**: Single implementation with monotonic progression validation
   - **Location**: `db/audio-tasks.ts` (canonical)

### Medium Priority

4. **SQL Helper Functions**:
   - **Issue**: Raw SQL in every processor (injection risk, verbosity)
   - **Fix**: Typed helpers:
     ```typescript
     updateSongAudioStems(trackId, { vocals_url, instrumental_url })
     upsertKaraokeSegment(trackId, { start_ms, end_ms, grove_url })
     ```
   - **Files**: `translate-lyrics.ts`, `separate-audio.ts`, `enhance-audio.ts`

5. **Polling Utilities Extraction**:
   - **Issue**: Demucs/Fal polling logic duplicated across tasks
   - **Fix**: Extract to `src/tasks/audio/utils/polling.ts`
   - **Functions**: `pollWithBackoff()`, `exponentialBackoff()`

### Low Priority

6. **Logging Standardization**:
   - **Current**: Console.log everywhere
   - **Fix**: Leveled logger (`pino` or `winston`)
   - **Levels**: debug, info, warn, error
   - **Format**: Structured JSON for production parsing

---

## 📚 Documentation Updates

### README.md
- ✅ Current: Describes new pipeline architecture
- ❌ Needed: Add MCP-only database access warning (remove psql examples)
- ❌ Needed: Update quick-start with task commands (`bun task:enhance`, etc.)

### PIPELINE-FLOW.md
- ✅ Current: Shows 7-stage audio pipeline
- ❌ Needed: Mark translation/separation as implemented (not "planned")
- ❌ Needed: Add identity tasks (PKP, Lens) to flow diagram

### Task-Specific Docs (NEW)
- ✅ `SEGMENT-SELECTION.md`: Hybrid deterministic+AI approach documented
- ❌ `TRANSLATION.md`: Document ElevenLabs word timing, language selection
- ❌ `ENHANCEMENT.md`: Document fal.ai chunking (2x chunks, 2s crossfade, 100s limit)
- ❌ `ENCRYPTION.md`: Unlock Protocol + Lit integration flow

---

## 📋 Recommended Execution Order

### Phase 1: Complete Audio Pipeline (1-2 days)
1. Run enhancement for remaining 7 tracks
2. Run clip creation for remaining 7 tracks
3. Verify all Grove URLs accessible
4. **Deliverable**: 9/9 tracks with viral clips ready

### Phase 2: Code Quality (1 day)
1. Create stage enum in `db/task-stages.ts`
2. Consolidate storage service
3. Extract SQL helpers
4. Fix stage tracking deduplication
5. **Deliverable**: Clean, maintainable codebase

### Phase 3: Identity Layer (2-3 days)
1. Implement PKP minting (15-20 accounts)
2. Implement Lens account creation
3. Deploy Unlock locks (artists only)
4. **Deliverable**: Web3 identity infrastructure

### Phase 4: GRC-20 Population (2 days)
1. Populate artists
2. Populate works (ISWC resolution)
3. Populate recordings
4. Submit to Grove blockchain
5. **Deliverable**: Public music metadata published

### Phase 5: Content Protection (1-2 days)
1. Encrypt full-length enhanced audio
2. Implement Lit access control (Unlock key purchase)
3. Update app to handle encrypted playback
4. **Deliverable**: Monetization layer active

### Phase 6: Trivia Generation (1-2 days)
1. Process Genius referents
2. Integrate web search API
3. Generate 5-10 questions per song
4. **Deliverable**: Educational/gamification features

---

## 🎯 Critical Paths

**For App Launch**:
- Audio pipeline → Identity layer → Content protection
- Minimum: 9 tracks with viral clips + encrypted full songs

**For Public Release**:
- All above + GRC-20 population + Trivia generation
- Requirement: Proper music metadata attribution

**Blockers**:
- None currently - all dependencies resolvable
- API costs: ~$2-3 for remaining audio processing

---

## 📞 Next Steps

**Immediate** (today):
1. Run `bun task:enhance --limit=10` (complete remaining 7 tracks)
2. Run `bun task:clip --limit=10` after enhancement completes
3. Verify all outputs in database

**This Week**:
1. Create stage enum consolidation
2. Implement PKP minting task
3. Start Lens account creation

**Next Week**:
1. Deploy Unlock locks
2. Implement audio encryption
3. Begin GRC-20 population
