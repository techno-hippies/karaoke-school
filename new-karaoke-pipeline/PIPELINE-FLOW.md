# Pipeline Flow - State Management

**Clear linear stage progression with explicit state transitions**

---

## 🎯 Stage Progression

```
pending → enriched → lyrics_acquired → audio_ready → aligned → translated →
separated → segmented → enhanced → ready
```

Each processor **MUST** update the track stage when completing its work.

---

## 📊 Current State (2025-01-07)

**Tracks by Stage**:
- `audio_ready`: 6 tracks (need alignment)
- `aligned`: 2 tracks (completed alignment)
- `failed`: 1 track

**Completed Processors**:
- ✅ Enrichment (10 processors) - `pending` → `enriched`
- ✅ Lyrics discovery - `enriched` → `lyrics_acquired`
- ✅ Audio download - `lyrics_acquired` → `audio_ready`
- ✅ Forced alignment - `audio_ready` → `aligned` ✅ WORKING

---

## 🔄 Audio Processing Flow

### 1. Download Audio (`audio_ready`)
**Processor**: `src/tasks/audio/download-audio.ts`
**Input**: Spotify track ID
**Output**: Grove URL stored in `song_audio.grove_url`
**Stage transition**: `lyrics_acquired` → `audio_ready`

### 2. Align Lyrics (`aligned`) ✅ COMPLETE
**Processor**: `src/tasks/audio/align-lyrics.ts`
**Input**:
- `song_audio.grove_url` (audio file)
- `song_lyrics.plain_lyrics` or `synced_lyrics`
**Output**: `elevenlabs_word_alignments` table
- `words` JSONB - Word-level timing
- `characters` JSONB - Character-level timing
- `total_words`, `total_characters`, `overall_loss`, `alignment_duration_ms`
**Stage transition**: `audio_ready` → `aligned`
**State management**: Updates track stage after successful alignment

### 3. Translate Lyrics (`translated`)
**Processor**: `src/tasks/audio/translate-lyrics.ts` (NOT YET MIGRATED)
**Input**: `elevenlabs_word_alignments.words` (for timing)
**Output**: `lyrics_translations` table
- Multiple languages (es, fr, de, ja, zh, ko, pt)
- Line-level translations with word timing preserved
**Stage transition**: `aligned` → `translated`

### 4. Separate Audio (`separated`)
**Processor**: `src/tasks/audio/separate-audio.ts` (NOT YET MIGRATED)
**Input**: `song_audio.grove_url`
**Service**: Demucs (RunPod)
**Output**:
- Instrumental stem → Grove (temporary)
- Stored in `song_audio` table or separate stems table
**Stage transition**: `aligned` → `separated` (can run parallel with translation)

### 5. Enhance Audio (`enhanced`)
**Processor**: `src/tasks/audio/enhance-audio.ts` (NOT YET MIGRATED)
**Input**: Separated instrumental
**Service**: fal.ai Stable Audio 2.5
**Special**: Implements chunking for tracks >190s
**Output**: Enhanced instrumental → Grove (temporary)
**Stage transition**: `separated` → `enhanced`

### 6. Select Segments (`segmented`)
**Processor**: `src/tasks/audio/select-segments.ts` (NOT YET MIGRATED)
**Input**:
- Enhanced instrumental
- `elevenlabs_word_alignments` (for timing)
**AI Decision**: Gemini selects best 40-60s clip (verse + chorus)
**Output**: `karaoke_segments` table with DUAL FORMAT (4 uploads to load.network):

**AUDIO** (2 uploads):
1. **Full song** - Complete enhanced instrumental
   - `full_song_loadnetwork_cid` / `_url` (unencrypted backup)
   - `full_song_encrypted_loadnetwork_cid` / `_url` (Lit encrypted - REQUIRED for access)
   - Duration: 0 to min(190s, full_duration)
2. **Clip audio** - 40-60s AI-selected segment
   - `clip_loadnetwork_cid` / `_url` (public, unencrypted)
   - `clip_start_ms` / `clip_end_ms` - Boundaries within full song
   - `clip_reason` - AI explanation

**LYRICS** (2 uploads):
3. **Full lyrics** - Complete word-level timing from elevenlabs_word_alignments
   - Stored encrypted on load.network (separate JSON file with all timing)
   - REQUIRED: Copyrighted content must be encrypted
4. **Clip lyrics** - ONLY the lyrics for the 40-60s segment
   - Stored public on load.network (separate JSON file)
   - Filtered word array matching clip_start_ms to clip_end_ms
   - Does NOT expose full copyrighted lyrics

**Storage**: load.network (final immutable) NOT Grove
**Stage transition**: `enhanced` → `segmented`

### 7. Generate Lines (`ready`)
**Processor**: `src/tasks/audio/generate-lines.ts` (NOT YET MIGRATED)
**Input**:
- `karaoke_segments` (segment boundaries)
- `elevenlabs_word_alignments` (word timing)
- `lyrics_translations` (multi-language)
**Output**: `karaoke_lines` table
- One row per lyric line
- Line-level timing for FSRS cards
- UUID per line for tracking
**Stage transition**: `segmented` → `ready`

---

## 🚨 Critical Rules for Processor Development

### 1. Always Update Track Stage
```typescript
// After successful processing
await query(
  `UPDATE tracks
   SET stage = 'next_stage',
       updated_at = NOW()
   WHERE spotify_track_id = $1
     AND stage = 'current_stage'`,
  [spotify_track_id]
);
```

### 2. Always Update Audio Task Status
```typescript
await query(
  `UPDATE audio_tasks
   SET status = 'completed',
       completed_at = NOW(),
       processing_duration_ms = $2,
       metadata = $3::jsonb,
       updated_at = NOW()
   WHERE id = $1`,
  [task.id, processingTime, JSON.stringify(metadata)]
);
```

### 3. Use Correct Storage
- **Grove**: Temporary processing files (audio downloads, stems, intermediates)
- **load.network**: Final immutable content (segments, clips, metadata)

### 4. Precision in Floats
Always use `.toFixed(3)` for loss/confidence values:
```typescript
overall_loss: parseFloat(alignment.overallLoss.toFixed(3))
```

---

## ❓ FAQ

**Q: Do we generate lines then translate?**
**A**: NO. Translation happens AFTER alignment, BEFORE line generation.

Order: `align` → `translate` → `separate` → `enhance` → `segment` → `generate_lines`

**Q: Why translate before generating lines?**
**A**: Translations need word-level timing from alignment. Lines are only generated after we know the final segment boundaries.

**Q: When do we upload to load.network?**
**A**: Only in the `select-segments` processor. Everything before that uses Grove for temporary storage.

**Q: What about the empty columns in elevenlabs_word_alignments?**
**A**: `lines`, `avg_confidence`, `low_confidence_count` were dropped - not used by ElevenLabs API.

---

## 📋 Processor Checklist

When migrating/creating a processor:

- [ ] Check input data availability (previous stage completed)
- [ ] Update `audio_tasks` status to 'running' at start
- [ ] Process data via external service
- [ ] Store results in appropriate table
- [ ] Update `audio_tasks` status to 'completed' with metadata
- [ ] **Update `tracks.stage` to next stage**
- [ ] Use correct storage provider (Grove temp vs load.network final)
- [ ] Round floats with `.toFixed(3)` where appropriate
- [ ] Handle errors with exponential backoff retry
- [ ] Log progress clearly

---

## 🎯 Next Steps

**Immediate**: Run remaining alignments
```bash
bun src/tasks/audio/align-lyrics.ts --limit=10
```

**Phase 2B**: Migrate remaining audio processors
1. `translate-lyrics.ts` - Gemini multi-language
2. `separate-audio.ts` - Demucs stems
3. `enhance-audio.ts` - fal.ai with chunking
4. `select-segments.ts` - Dual-format generation → load.network
5. `generate-lines.ts` - FSRS cards

---

**Pipeline state is now properly managed with explicit stage transitions!**
