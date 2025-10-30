# Segment Selection & fal.ai Enhancement

**Steps 9-10: Post-Separation Processing**

After audio separation (Step 8), these steps prepare karaoke-ready instrumentals.

---

## 📊 Database Schema

### `karaoke_segments` Table (13 columns)
```sql
CREATE TABLE karaoke_segments (
  spotify_track_id TEXT PRIMARY KEY,

  -- AI-selected optimal 190s segment (songs ≥190s only)
  optimal_segment_start_ms INTEGER,
  optimal_segment_end_ms INTEGER,
  optimal_segment_selected_at TIMESTAMPTZ,

  -- AI-selected best clip (20-50s, ALL songs)
  clip_start_ms INTEGER,
  clip_end_ms INTEGER,
  clip_selected_at TIMESTAMPTZ,

  -- fal.ai enhanced instrumental
  fal_enhanced_grove_cid TEXT,
  fal_enhanced_grove_url TEXT,
  fal_processing_duration_seconds NUMERIC,
  fal_enhanced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Points:**
- ✅ No Demucs duplication (references `song_audio` instead)
- ✅ No vendor lock-in (no `gemini_` prefixes)
- ✅ Clean separation of concerns

---

## 🔧 Services Created

### 1. `segment-selector.ts`
AI service (via OpenRouter/Gemini) that analyzes lyrics with word-level timing to select:
- **Optimal 190s segment** for songs ≥190s (most karaoke-worthy continuous section)
- **Best 20-50s clip** for ALL songs (viral-worthy moment)

**Criteria:**
- Melodic hooks, chorus placement
- Singability and energy
- Natural phrase boundaries
- Completeness of musical phrases

### 2. `fal-audio.ts`
fal.ai Stable Audio 2.5 enhancement service:
- Cloudflare Workers compatible (no fs operations)
- Fetches from Grove URLs directly
- Polls for completion (up to 6 minutes)
- Cost: ~$0.20 per track

### 3. `karaoke-segments.ts` (DB helpers)
Clean database operations for the new schema:
- `ensureKaraokeSegment()` - Create record
- `updateSelectedSegments()` - Save AI selections
- `updateFalEnhancement()` - Save fal.ai results
- `getTracksNeedingSegmentSelection()` - Query pipeline
- `getTracksNeedingFalEnhancement()` - Query pipeline

---

## 🔄 Processing Pipeline

### Step 9: AI Segment Selection
**File:** `processors/09-select-segments.ts`

**Processes:**
```
song_audio (has instrumental)
  + elevenlabs_word_alignments
  → AI analysis
  → karaoke_segments updated
```

**Run:**
```typescript
import { processSegmentSelection } from './processors/09-select-segments';
await processSegmentSelection(env, 50); // Process 50 tracks
```

**Requirements:**
- `OPENROUTER_API_KEY` env var
- Tracks must have:
  - `song_audio.instrumental_grove_url`
  - `elevenlabs_word_alignments.words`

**Output:**
- For songs <190s: Only `clip_start_ms`, `clip_end_ms`
- For songs ≥190s: All fields populated

---

### Step 10: fal.ai Enhancement
**File:** `processors/10-enhance-audio.ts`

**Processes:**
```
karaoke_segments (has segment selection)
  + song_audio.instrumental_grove_url
  → fal.ai enhancement
  → Upload to Grove
  → karaoke_segments updated
```

**Run:**
```typescript
import { processFalEnhancement } from './processors/10-enhance-audio';
await processFalEnhancement(env, 10); // Process 10 tracks
```

**Requirements:**
- `FAL_API_KEY` env var
- `IRYS_PRIVATE_KEY` env var (for Grove upload)
- Tracks must have:
  - `karaoke_segments.clip_start_ms` (segment selection complete)
  - `song_audio.instrumental_grove_url`

**Output:**
- `fal_enhanced_grove_cid`, `fal_enhanced_grove_url` populated
- Enhanced instrumental uploaded to Grove

**Note:** Currently enhances the FULL instrumental for all songs. The segment selection is metadata that tells the app which part to play.

**TODO:** Add cropping step for songs ≥190s (requires external service with FFmpeg)

---

## 📝 Example Usage

### Test with a single track
```typescript
// Step 9: Select segments
const tracks = await getTracksNeedingSegmentSelection(env.DATABASE_URL, 1);
if (tracks.length > 0) {
  const track = tracks[0];
  const selector = new SegmentSelectorService(env.OPENROUTER_API_KEY);

  const words = track.word_alignments.map(w => ({
    text: w.text,
    start: w.start,
    end: w.end
  }));

  const result = await selector.selectSegments(words, track.duration_ms);
  console.log('Selected segments:', result);

  await updateSelectedSegments(env.DATABASE_URL, track.spotify_track_id, {
    optimalSegmentStartMs: result.optimalSegment?.startMs,
    optimalSegmentEndMs: result.optimalSegment?.endMs,
    clipStartMs: result.clip.startMs,
    clipEndMs: result.clip.endMs
  });
}

// Step 10: Enhance
const tracksForFal = await getTracksNeedingFalEnhancement(env.DATABASE_URL, 1);
if (tracksForFal.length > 0) {
  const track = tracksForFal[0];
  const falService = new FalAudioService(env.FAL_API_KEY);

  const result = await falService.enhanceInstrumental({
    audioUrl: track.instrumental_grove_url,
    prompt: 'instrumental',
    strength: 0.3
  });

  console.log('Enhanced:', result.audioUrl);

  // Download and upload to Grove...
}
```

---

## 🚀 Integration Points

These steps are **separate** from the main orchestrator (steps 2-7.5) and should be run independently:

1. **After Step 8** (Demucs separation completes)
2. **After Step 6.5** (ElevenLabs alignment completes)

**Run them via:**
- Cron jobs (scheduled)
- Manual scripts
- Separate webhook/queue system

They do NOT update `song_pipeline` status - they operate on `karaoke_segments` independently.

---

## 📈 Current Stats

Run this to check progress:

```sql
-- Check segment selection progress
SELECT
  COUNT(*) as total,
  COUNT(clip_start_ms) as has_clip_selection,
  COUNT(optimal_segment_start_ms) as has_optimal_segment,
  COUNT(fal_enhanced_grove_cid) as has_fal_enhancement
FROM karaoke_segments;

-- Find songs needing segment selection
SELECT COUNT(*)
FROM song_audio sa
JOIN elevenlabs_word_alignments ewa ON sa.spotify_track_id = ewa.spotify_track_id
LEFT JOIN karaoke_segments ks ON sa.spotify_track_id = ks.spotify_track_id
WHERE sa.instrumental_grove_url IS NOT NULL
  AND (ks.clip_start_ms IS NULL OR ks.spotify_track_id IS NULL);

-- Find songs needing fal.ai enhancement
SELECT COUNT(*)
FROM karaoke_segments ks
JOIN song_audio sa ON ks.spotify_track_id = sa.spotify_track_id
WHERE ks.clip_start_ms IS NOT NULL
  AND ks.fal_enhanced_grove_cid IS NULL;
```

---

## 💰 Cost Estimates

**Segment Selection (Gemini via OpenRouter):**
- ~$0.001 per track (2 AI calls × ~500 tokens each)
- 1,000 tracks = ~$1

**fal.ai Enhancement:**
- ~$0.20 per track (Stable Audio 2.5 pricing)
- 1,000 tracks = ~$200

**Grove Upload:**
- ~$0.01 per MB
- Typical enhanced instrumental: ~5MB = ~$0.05
- 1,000 tracks = ~$50

**Total: ~$251 per 1,000 tracks**
