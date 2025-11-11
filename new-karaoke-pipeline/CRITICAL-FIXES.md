# Critical Fixes to BaseTask Refactoring

## Overview

After thorough code audit, three critical issues were identified in the BaseTask refactoring that would prevent production deployment. All have been fixed.

---

## Issue 1: Missing audio_tasks Scheduling/Retry Logic ⚠️ CRITICAL

### Problem

The refactored tasks no longer respect `audio_tasks` retry semantics:

- Original tasks filtered by:
  - `status IN ('pending', 'failed')`
  - `attempts < max_attempts`
  - `next_retry_at IS NULL OR next_retry_at <= NOW()`

- Refactored tasks selected straight from `tracks.stage` without checking audio_tasks

**Consequences**:
- Tracks that exhausted retries would be reprocessed indefinitely
- Exponential backoff ignored → hammering expensive APIs (ElevenLabs, fal.ai, RunPod, OpenRouter)
- No max_attempts enforcement → infinite retry loops

### Fix

Added `buildAudioTasksFilter()` helper to `src/lib/base-task.ts`:

```typescript
export function buildAudioTasksFilter(taskType: string): string {
  return `
    AND (
      -- No task record yet (pending)
      NOT EXISTS (
        SELECT 1 FROM audio_tasks
        WHERE spotify_track_id = t.spotify_track_id
          AND task_type = '${taskType}'
      )
      -- Or task is pending/failed and ready for retry
      OR EXISTS (
        SELECT 1 FROM audio_tasks
        WHERE spotify_track_id = t.spotify_track_id
          AND task_type = '${taskType}'
          AND status IN ('pending', 'failed')
          AND attempts < max_attempts
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      )
    )
  `;
}
```

**Usage**: Each `selectTracks()` implementation should append this filter to respect retry logic.

**File**: `src/lib/base-task.ts:73-97`

---

## Issue 2: Clip Creation Stage Filter Bug 🐛 BLOCKING

### Problem

`ClipSegmentsTask` selected tracks with:
```typescript
WHERE t.stage = TrackStage.Segmented
```

But `updateTrackStage()` promotes tracks to `TrackStage.Enhanced` after enhancement completes. The stage never returns to `Segmented`, so clip creation would always find 0 tracks.

**Consequences**:
- Clip creation task would never run
- Pipeline stuck at "enhanced" stage
- No clips generated for FSRS/TikTok distribution

### Fix

Changed `clip-segments-refactored.ts` to select from correct stage:

```typescript
WHERE t.stage = TrackStage.Enhanced  // NOT Segmented!
```

**File**: `src/tasks/audio/clip-segments-refactored.ts:85`

---

## Issue 3: Clip Duration Config Mismatch 📐 SPEC VIOLATION

### Problem

`select-segments-refactored.ts` reused `CONFIG.audio.segment` for viral clip selection:
```typescript
const maxDur = CONFIG.audio.segment.maxDurationMs;  // Was 190000ms
const minDur = CONFIG.audio.segment.minDurationMs;  // Was 30000ms
```

But that config was designed for fal.ai's 190-second chunk limit, not the product requirement of **40-100 second clips** for TikTok/FSRS.

**Consequences**:
- Could generate 30-second clips (too short for engagement)
- Could generate 190-second clips (breaks TikTok 3-minute limit, FSRS assumptions)
- Downstream impact: clip events, Lit encryption windows, FSRS card timing

### Fix

Split config into two separate sections in `src/config/index.ts`:

```typescript
/** Segment selection (viral clip bounds - 40-100s for TikTok/FSRS) */
segment: {
  maxDurationMs: 100000, // 100 seconds (product requirement)
  minDurationMs: 40000, // 40 seconds (product requirement)
},

/** fal.ai chunking (separate from clip selection) */
falChunking: {
  maxDurationMs: 190000, // 3min 10s (190 seconds - fal.ai hard limit)
  overlapMs: 2000, // 2 seconds overlap for crossfade
},
```

Updated `enhance-audio-refactored.ts` to use `CONFIG.audio.falChunking`:
```typescript
const CHUNK_SIZE_MS = CONFIG.audio.falChunking.maxDurationMs;
const OVERLAP_MS = CONFIG.audio.falChunking.overlapMs;
```

**Files**:
- `src/config/index.ts:97-107`
- `src/tasks/audio/enhance-audio-refactored.ts:74-75`

---

## Files Modified

1. `src/lib/base-task.ts`
   - Added `buildAudioTasksFilter()` helper (lines 73-97)
   - Updated documentation to require its use

2. `src/config/index.ts`
   - Split `segment` (40-100s clips) from `falChunking` (190s fal.ai)
   - Lines 97-107

3. `src/tasks/audio/clip-segments-refactored.ts`
   - Changed stage filter: `Segmented` → `Enhanced`
   - Line 85

4. `src/tasks/audio/enhance-audio-refactored.ts`
   - Uses `CONFIG.audio.falChunking` instead of `segment`
   - Lines 74-75

---

## Testing Recommendations

Before deploying refactored tasks:

### Issue 1 (Retry Logic)
```sql
-- Create a task that should be blocked by retry logic
INSERT INTO audio_tasks (spotify_track_id, task_type, status, attempts, max_attempts)
VALUES ('test_track_id', 'align', 'failed', 3, 3);

-- Run refactored task
bun src/tasks/audio/align-lyrics-refactored.ts --limit=10

-- Verify: test_track_id should NOT be reprocessed
SELECT * FROM audio_tasks WHERE spotify_track_id = 'test_track_id';
```

### Issue 2 (Stage Filter)
```sql
-- Find a track at 'enhanced' stage
SELECT spotify_track_id FROM tracks WHERE stage = 'enhanced' LIMIT 1;

-- Run clip task
bun src/tasks/audio/clip-segments-refactored.ts --limit=10

-- Verify: Should process enhanced tracks, not "0 tracks ready"
```

### Issue 3 (Clip Duration)
```sql
-- Check clip durations after selection
SELECT
  spotify_track_id,
  (clip_end_ms - clip_start_ms) / 1000.0 as duration_seconds
FROM karaoke_segments
WHERE clip_start_ms IS NOT NULL;

-- All should be between 40-100 seconds
```

---

## Impact Assessment

| Issue | Severity | Impact | Fixed |
|-------|----------|--------|-------|
| Missing retry logic | 🔴 Critical | API abuse, infinite retries | ✅ |
| Wrong stage filter | 🔴 Blocking | Pipeline stuck, no clips | ✅ |
| Config mismatch | 🟡 High | Spec violation, downstream breaks | ✅ |

---

## Deployment Checklist

Before replacing originals with refactored versions:

- [x] Add `buildAudioTasksFilter(this.taskType)` to all `selectTracks()` queries (commit 327af86)
- [ ] Test retry logic with exhausted tasks
- [ ] Verify clip creation runs on 'enhanced' tracks
- [ ] Confirm all clips are 40-100 seconds
- [ ] Run full pipeline end-to-end on staging
- [ ] Monitor API rate limits (ElevenLabs, fal.ai, RunPod)

## Integration Status

**All 6 refactored tasks now include retry logic** (commit 327af86):
1. ✅ `align-lyrics-refactored.ts`
2. ✅ `separate-audio-refactored.ts`
3. ✅ `enhance-audio-refactored.ts`
4. ✅ `select-segments-refactored.ts`
5. ✅ `clip-segments-refactored.ts`
6. ✅ `translate-lyrics.ts`

Each task now:
- Imports `buildAudioTasksFilter` from `base-task.ts`
- Calls `const retryFilter = buildAudioTasksFilter(this.taskType)` in `selectTracks()`
- Appends `${retryFilter}` to SQL WHERE clause
- Documents retry logic with comment

---

## Credit

Issues identified by: AI code audit (parallel review)
Fixes implemented by: Claude Code
Date: 2025-01-11
