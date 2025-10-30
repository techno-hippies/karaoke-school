# ElevenLabs Forced Alignment + Translation Implementation

**Date:** 2025-10-29
**Status:** ✅ Complete - Ready for Testing

---

## Overview

Implemented complete ElevenLabs forced alignment and multi-language translation pipeline for karaoke production. This enables:

1. **Word-level timing** for karaoke display (ElevenLabs API)
2. **Character-level timing** for fine-grained animation (optional)
3. **Multi-language translations** (es, zh, ja, ko) with preserved word timing
4. **Language detection** for mixed-language songs (K-pop, etc.)

---

## Architecture

### Pipeline Flow

```
audio_downloaded
  ↓ Step 6: ElevenLabs Forced Alignment
alignment_complete
  ↓ Step 7b: Lyrics Translation (Multi-Language)
translations_ready
  ↓ (future: stems, enhancement, etc.)
```

### Database Tables (New)

1. **elevenlabs_word_alignments**
   - Word-level timing: `[{text, start, end, loss}, ...]`
   - Character-level timing: `[{text, start, end}, ...]`
   - Quality metrics: `overall_loss`, `alignment_duration_ms`

2. **lyrics_translations**
   - Multi-language support (ISO 639-1 codes)
   - Preserved word timing from alignment
   - Line-level + word-level structure
   - Grove storage ready (grove_cid, grove_url)

3. **song_pipeline** (updated)
   - Added `translations_ready` status

---

## Implementation Details

### 1. ElevenLabs Service (`src/services/elevenlabs.ts`)

**Improvements over archived version:**
- Added character-level timing (from OpenAPI spec)
- Better error handling with detailed messages
- Automatic audio download from Grove/IPFS URLs
- Quality metrics (overall_loss) for monitoring
- OpenAPI-compliant TypeScript types

**API Call:**
```typescript
const alignment = await elevenlabs.forcedAlignment(
  groveUrl,      // Audio file URL
  plainLyrics    // Plain text lyrics
);

// Returns:
// - words: [{text, start, end, loss}, ...]
// - characters: [{text, start, end}, ...]
// - overallLoss: quality score
// - alignmentDurationMs: track duration
```

**Rate Limiting:** 2 seconds between API calls (ElevenLabs processing time)

---

### 2. Translation Service (`src/services/lyrics-translator.ts`)

**Key Features:**
- Uses Gemini Flash 2.5 via OpenRouter (cheap, fast)
- Preserves word-level timing from ElevenLabs alignment
- Supports 14+ languages (expandable):
  - Spanish (es), Chinese (zh), Japanese (ja), Korean (ko)
  - Vietnamese (vi), Indonesian (id), French (fr), German (de)
  - Portuguese (pt), Italian (it), Russian (ru), Arabic (ar)
  - Hindi (hi), Thai (th)
- Auto-detects source language (from song_lyrics.language_data)
- Handles mixed-language songs (K-pop with English)

**Translation Flow:**
```typescript
// 1. Parse lyrics into lines with word timing
const lines = LyricsTranslator.parseLinesFromAlignment(words, plainLyrics);

// 2. Translate to multiple languages
const translations = await translator.translateToMultipleLanguages(
  lines,
  ['es', 'zh', 'ja', 'ko'],
  sourceLanguage
);

// 3. Store with preserved timing
// Each line has: originalText, translatedText, start, end, words[], translatedWords[]
```

**Timing Approximation:**
- Original words keep exact ElevenLabs timing
- Translated words: evenly distributed across line duration
- Future improvement: Word-level alignment for target language

---

### 3. Forced Alignment Processor (`src/processors/06-forced-alignment.ts`)

**Status:** `audio_downloaded` → `alignment_complete`

**Process:**
1. Find tracks with audio + lyrics but no alignment
2. Call ElevenLabs API for word-level timing
3. Store in `elevenlabs_word_alignments` table
4. Update pipeline status
5. Handle retries (max 3) and errors

**Query Logic:**
```sql
-- Tracks needing alignment
FROM song_pipeline sp
JOIN song_audio sa      -- Must have audio on Grove
JOIN song_lyrics sl     -- Must have normalized lyrics
LEFT JOIN elevenlabs_word_alignments ewa
WHERE sp.status = 'audio_downloaded'
  AND ewa.spotify_track_id IS NULL  -- No alignment yet
```

**Error Handling:**
- Logs errors to `song_pipeline.error_message`
- Retry count tracked in `song_pipeline.retry_count`
- After 3 failed retries: mark as `failed`

---

### 4. Translation Processor (`src/processors/07-translate-lyrics.ts`)

**Status:** `alignment_complete` → `translations_ready`

**Process:**
1. Find tracks with alignment but incomplete translations
2. Parse ElevenLabs alignment into lyric lines
3. Translate to target languages (default: es, zh, ja, ko)
4. Store each translation with word timing preserved
5. Update status when 3+ languages complete

**Smart Translation:**
- Only translates missing languages (resume support)
- Uses source language from `song_lyrics.language_data`
- Skips source → source translation (e.g., don't translate es → es)
- Batch processes multiple languages per track

**Quality Metrics:**
- Confidence score from Gemini (0.00 to 1.00)
- Tracks missing translations
- Validation flag for human review

---

## Database Schema

### elevenlabs_word_alignments

```sql
CREATE TABLE elevenlabs_word_alignments (
  spotify_track_id TEXT PRIMARY KEY,

  -- Word-level timing (primary for karaoke)
  words JSONB NOT NULL,        -- [{text, start, end, loss}, ...]
  total_words INTEGER,

  -- Character-level timing (optional)
  characters JSONB,            -- [{text, start, end}, ...]
  total_characters INTEGER,

  -- Quality
  alignment_duration_ms INTEGER,
  overall_loss NUMERIC(6,3),   -- Lower = better

  raw_alignment_data JSONB,    -- Full API response
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Views:**
- `alignment_quality_summary`: Quality monitoring (avg_loss, quality distribution)

---

### lyrics_translations

```sql
CREATE TABLE lyrics_translations (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT,
  language_code TEXT,          -- ISO 639-1 (es, zh, ja, ko, ...)

  -- Line-level with word timing
  lines JSONB NOT NULL,        -- [{lineIndex, originalText, translatedText, start, end, words[], translatedWords[]}, ...]

  -- Grove storage
  grove_cid TEXT,
  grove_url TEXT,

  -- Metadata
  translation_source TEXT,     -- 'gemini-flash-2.5'
  confidence_score NUMERIC(3,2),
  validated BOOLEAN,

  -- Source language
  source_language_code TEXT,
  source_language_data JSONB,  -- Mixed language breakdown

  UNIQUE(spotify_track_id, language_code)
);
```

**Views:**
- `translation_coverage_summary`: Languages × tracks coverage
- `translations_ready_to_mint`: Tracks with 3+ translations + Grove CIDs

---

## Integration with Contracts

### TranslationEvents.sol

The implementation is designed to work with `TranslationEvents.sol`:

**Event Structure:**
```solidity
event TranslationAdded(
  bytes32 indexed segmentHash,
  string indexed languageCode,
  string translationUri,        // Grove URI
  string translationSource,     // "gemini-flash-2.5"
  uint16 confidenceScore,       // 0-10000
  bool validated,
  address indexed addedBy,
  uint64 timestamp
);
```

**Grove Upload Format:**
```json
{
  "spotifyTrackId": "...",
  "languageCode": "zh",
  "translationSource": "gemini-flash-2.5",
  "confidenceScore": 0.92,
  "lines": [
    {
      "lineIndex": 0,
      "originalText": "Someone said they left together",
      "translatedText": "有人说他们已双双离去",
      "start": 25.42,
      "end": 29.119,
      "words": [
        {"text": "Someone", "start": 25.42, "end": 26.299},
        {"text": "said", "start": 26.42, "end": 26.84}
      ],
      "translatedWords": [
        {"text": "有人", "start": 25.42, "end": 26.299},
        {"text": "说", "start": 26.42, "end": 26.84}
      ]
    }
  ]
}
```

---

## Orchestrator Integration

Added to `src/processors/orchestrator.ts`:

```typescript
const steps: PipelineStep[] = [
  // Step 6: ElevenLabs Forced Alignment
  {
    number: 6,
    name: 'ElevenLabs Forced Alignment',
    status: 'audio_downloaded',
    nextStatus: 'alignment_complete',
    processor: processForcedAlignment,
    enabled: true
  },

  // Step 7b: Lyrics Translation
  {
    number: 7.5,
    name: 'Lyrics Translation',
    status: 'alignment_complete',
    nextStatus: 'translations_ready',
    processor: processLyricsTranslation,
    enabled: true
  }
];
```

**Run Specific Steps:**
```bash
# Run forced alignment only
bun run-pipeline.ts --step 6

# Run translation only
bun run-pipeline.ts --step 7.5

# Run all steps (includes alignment + translation)
bun run-pipeline.ts
```

---

## Testing

### Manual Testing

1. **Check tracks needing alignment:**
```sql
SELECT COUNT(*)
FROM song_pipeline
WHERE status = 'audio_downloaded';
```

2. **Run forced alignment processor:**
```bash
cd karaoke-pipeline
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- \
  bun run-pipeline.ts --step 6 --limit 5
```

3. **Verify alignment results:**
```sql
SELECT
  spotify_track_id,
  total_words,
  overall_loss,
  alignment_duration_ms
FROM elevenlabs_word_alignments
ORDER BY created_at DESC
LIMIT 10;

-- Quality check
SELECT * FROM alignment_quality_summary;
```

4. **Run translation processor:**
```bash
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- \
  bun run-pipeline.ts --step 7.5 --limit 5
```

5. **Verify translations:**
```sql
SELECT * FROM translation_coverage_summary;

-- Check specific track
SELECT language_code, confidence_score, validated
FROM lyrics_translations
WHERE spotify_track_id = 'TRACK_ID';
```

---

## Next Steps

### Immediate
1. ✅ Run migrations (completed)
2. Test forced alignment with 5-10 tracks
3. Test translation with 3-5 tracks
4. Monitor quality metrics (loss scores, confidence)

### Short-term
1. Add Grove upload for alignment JSON
2. Add Grove upload for translation JSON
3. Emit SegmentProcessed events (alignment URI)
4. Emit TranslationAdded events (translation URIs)

### Long-term
1. Improve translated word timing (word-level alignment for target language)
2. Add validation UI for human review
3. Add more languages based on demand
4. Optimize translation costs (batch processing)

---

## Cost Analysis

### ElevenLabs Forced Alignment
- **Rate:** ~$0.01 per minute of audio
- **Average track:** 3-4 minutes = $0.03-0.04 per track
- **1000 tracks:** ~$30-40

### OpenRouter (Gemini Flash 2.5)
- **Rate:** $0.0000025 per 1K input tokens, $0.00001 per 1K output tokens
- **Average translation:** 500 input + 500 output = $0.000006 per language
- **4 languages per track:** $0.000024 per track
- **1000 tracks × 4 languages:** ~$0.024 total (negligible)

**Total Cost per Track:** ~$0.03-0.04 (mostly ElevenLabs)

---

## Files Created/Modified

### New Files
- `schema/migrations/003-elevenlabs-word-alignments.sql`
- `schema/migrations/004-lyrics-translations.sql`
- `schema/migrations/005-add-translations-ready-status.sql`
- `src/services/elevenlabs.ts`
- `src/services/lyrics-translator.ts`
- `src/processors/06-forced-alignment.ts`
- `src/processors/07-translate-lyrics.ts`
- `ELEVENLABS_IMPLEMENTATION.md` (this file)

### Modified Files
- `src/processors/orchestrator.ts` (added steps 6 and 7b)

---

## Environment Variables Required

```bash
# ElevenLabs API
ELEVENLABS_API_KEY=sk_...

# OpenRouter (for Gemini)
OPENROUTER_API_KEY=sk-or-...

# Neon Database
NEON_DATABASE_URL=postgres://...
```

---

## Monitoring Queries

```sql
-- Pipeline status distribution
SELECT status, COUNT(*)
FROM song_pipeline
GROUP BY status
ORDER BY status;

-- Alignment quality
SELECT * FROM alignment_quality_summary;

-- Translation coverage
SELECT * FROM translation_coverage_summary;

-- Failed tracks
SELECT spotify_track_id, error_message, retry_count
FROM song_pipeline
WHERE status = 'failed' AND error_stage IN ('forced_alignment', 'lyrics_translation');

-- Tracks ready for translation events
SELECT * FROM translations_ready_to_mint LIMIT 10;
```

---

## Success Criteria

- ✅ Migrations run without errors
- ⏳ 90%+ tracks successfully aligned (loss < 5.0)
- ⏳ 3+ languages per track translated
- ⏳ 95%+ translation confidence scores
- ⏳ <5% failure rate
- ⏳ Processing time: <5s per track (alignment + 4 translations)

---

**Implementation Complete! Ready for testing.**
