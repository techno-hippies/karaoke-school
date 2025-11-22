# Question Generation Fix - Implementation Summary

**Date**: 2025-11-13
**Status**: ✅ Implemented (5/5 layers)

## Problem Statement

Translation/trivia multiple-choice questions were being skipped for 71% of tracks (12 out of 17 'ready' tracks). This caused study sessions to show only SAY_IT_BACK cards with no variety.

### Root Causes

1. **Parallel Branch Architecture**: Questions were on a separate optional branch from the main audio pipeline
2. **No Task Seeding**: Question tasks were never auto-created after translation
3. **Stage-Based Queries**: Question generators only processed `stage='translated'`, missing tracks that advanced
4. **No Validation Gates**: Contracts could be emitted without questions
5. **No Recovery Mechanism**: No way to backfill existing broken tracks

## Solution: 5-Layer Defense-in-Depth

### ✅ Layer 1: Fix Stage Requirements (Architecture)

**File**: `src/db/task-stages.ts:117-121`

**Change**: Made TranslationQuiz + Trivia required prerequisites for Separated/Ready stages.

```typescript
// BEFORE (broken - parallel branches):
[TrackStage.Separated]: [Download, Align, Translate, Separate],  // ❌ Bypasses questions

// AFTER (fixed - sequential gates):
[TrackStage.Separated]: [Download, Align, Translate, TranslationQuiz, Trivia, Separate],  // ✅
```

**Impact**: Tracks **cannot** advance past `Translated` without completing questions.

---

### ✅ Layer 2: Auto-Seed Tasks (Prevention)

**File**: `src/tasks/audio/translate-lyrics.ts:31,192-196`

**Change**: Auto-create question tasks when translation completes.

```typescript
// Added import
import { ensureAudioTask } from '../../db/audio-tasks';

// Added after translation (line 192-196)
await ensureAudioTask(track.spotify_track_id, AudioTaskType.TranslationQuiz);
await ensureAudioTask(track.spotify_track_id, AudioTaskType.Trivia);
console.log(`   ✓ Seeded question generation tasks (translation_quiz, trivia)`);
```

**Impact**: Every translated track automatically gets question tasks queued.

---

### ✅ Layer 3: Fix Generator Queries (Detection)

**Files**:
- `src/tasks/content/generate-translation-quiz.ts:225-254`
- `src/tasks/content/generate-trivia.ts:239-273`

**Change**: Query by pending tasks instead of stage, enabling retroactive processing.

```sql
-- BEFORE (broken - stage filter):
WHERE t.stage = 'translated'  -- ❌ Misses 'ready' tracks

-- AFTER (fixed - task filter):
WHERE EXISTS (
  SELECT 1 FROM audio_tasks at
  WHERE at.spotify_track_id = t.spotify_track_id
    AND at.task_type = 'translation_quiz'  -- or 'trivia'
    AND at.status = 'pending'  -- ✅ Works at any stage
)
```

**Impact**: Can process tracks at ANY stage (including `ready`) as long as they have pending tasks.

---

### ✅ Layer 4: Add Validation Gate (Enforcement)

**File**: `src/tasks/content/emit-clip-events.ts:105-112`

**Change**: Block contract emission until questions exist.

```sql
WHERE ks.clip_start_ms IS NOT NULL
  AND ks.fal_enhanced_grove_url IS NOT NULL
  AND ks.encrypted_full_url IS NOT NULL
  AND ks.encryption_accs IS NOT NULL
  AND gw.grc20_entity_id IS NOT NULL
  AND EXISTS (  -- ✅ VALIDATION GATE
    SELECT 1 FROM song_translation_questions q
    WHERE q.spotify_track_id = t.spotify_track_id
  )
  AND EXISTS (  -- ✅ VALIDATION GATE
    SELECT 1 FROM song_trivia_questions tq
    WHERE tq.spotify_track_id = t.spotify_track_id
  )
```

**Impact**: Hard enforcement - contracts **cannot** be emitted without questions.

---

### ✅ Layer 5: Backfill Script (Recovery)

**File**: `src/scripts/backfill-question-tasks.ts` (NEW)

**Purpose**: Repair existing broken tracks by seeding tasks and optionally downgrading stage.

```bash
# Usage
bun src/scripts/backfill-question-tasks.ts --downgrade-stage
```

**What it does**:
1. Finds tracks at `separated`/`segmented`/`enhanced`/`ready` without questions
2. Seeds `translation_quiz` and `trivia` tasks
3. Downgrades stage to `translated` (if `--downgrade-stage` flag used)
4. Allows question generators to reprocess tracks

**Impact**: All 12 existing broken tracks can be repaired.

---

## Implementation Checklist

- [x] **Layer 1**: Updated `STAGE_REQUIREMENTS` in `task-stages.ts`
- [x] **Layer 2**: Added auto-seeding to `translate-lyrics.ts`
- [x] **Layer 3**: Fixed queries in `generate-translation-quiz.ts` and `generate-trivia.ts`
- [x] **Layer 4**: Added validation gates in `emit-clip-events.ts`
- [x] **Layer 5**: Created `backfill-question-tasks.ts` script

---

## Migration Plan

### Phase 1: Backfill Existing Tracks (10 min)

```bash
# 1. Run backfill script
cd new-karaoke-pipeline
bun src/scripts/backfill-question-tasks.ts --downgrade-stage

# Expected output:
# Found 12 track(s) needing question tasks
# Success: 12 track(s)
```

### Phase 2: Generate Questions (30-60 min)

```bash
# 2. Run translation quiz generator
bun src/tasks/content/generate-translation-quiz.ts --limit=20

# 3. Run trivia generator
bun src/tasks/content/generate-trivia.ts --limit=20
```

### Phase 3: Verification (5 min)

```bash
# 4. Verify all ready tracks have questions
psql $NEON_DATABASE_URL -c "
  SELECT COUNT(*) as tracks_without_questions
  FROM tracks t
  WHERE t.stage = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM song_translation_questions
      WHERE spotify_track_id = t.spotify_track_id
    );
"
# Should return: tracks_without_questions = 0

# 5. Test study session for "Guantanamera"
# Navigate to: /song/{grc20WorkId}/study
# Should now show mixed SAY_IT_BACK + translation + trivia cards
```

---

## Expected Database State After Migration

### Before Fix

```sql
-- Tracks at 'ready' stage: 17
-- Tracks with questions: 5
-- Broken tracks: 12 (71%)
```

### After Fix

```sql
-- Tracks with questions: 17 (100%)
-- Tracks with translation_quiz tasks: 17
-- Tracks with trivia tasks: 17
-- Broken tracks: 0 (0%)
```

---

## Why This Fix is Robust

**1. Prevention (Layers 1-2)**
- Stage requirements **force** questions before audio processing
- Auto-seeding **guarantees** tasks are created

**2. Detection (Layer 3)**
- Query fix allows **retroactive** processing of any track with translations
- Works regardless of current stage

**3. Enforcement (Layer 4)**
- Contract emission **validates** questions exist before publishing
- Hard gate prevents future bypasses

**4. Recovery (Layer 5)**
- Backfill script **repairs** existing broken tracks
- Idempotent - safe to run multiple times

**5. Self-Healing**
- Multiple redundant layers prevent single-point-of-failure
- Tracks auto-correct when question tasks run
- Observable via `audio_tasks` table

---

## Future-Proofing

This fix ensures:

1. ✅ **New tracks** automatically get question tasks (Layer 2)
2. ✅ **Stage progression** blocks on questions (Layer 1)
3. ✅ **Contract emission** validates questions (Layer 4)
4. ✅ **Existing tracks** can be repaired (Layers 3 + 5)
5. ✅ **No manual intervention** required going forward

---

## Testing Checklist

- [ ] Run backfill script on production database
- [ ] Verify 12 tracks downgraded to `translated` stage
- [ ] Run question generators successfully
- [ ] Confirm all `ready` tracks have questions in both tables
- [ ] Test study session shows mixed card types
- [ ] Verify new translations auto-seed question tasks
- [ ] Confirm tracks cannot advance past `translated` without questions
- [ ] Test contract emission blocked without questions

---

## Monitoring

Watch for:
- Tracks stuck at `translated` stage (indicates question generation failures)
- Failed `translation_quiz`/`trivia` tasks in `audio_tasks` table
- Study sessions with only SAY_IT_BACK cards (indicates missing questions)

Query to monitor health:
```sql
-- Check for broken tracks
SELECT
  t.stage,
  COUNT(*) as total_tracks,
  COUNT(tq.spotify_track_id) as has_translation_quiz,
  COUNT(triv.spotify_track_id) as has_trivia
FROM tracks t
LEFT JOIN (SELECT DISTINCT spotify_track_id FROM song_translation_questions) tq
  ON tq.spotify_track_id = t.spotify_track_id
LEFT JOIN (SELECT DISTINCT spotify_track_id FROM song_trivia_questions) triv
  ON triv.spotify_track_id = t.spotify_track_id
WHERE t.stage IN ('translated', 'translation_quiz_ready', 'trivia_ready', 'separated', 'segmented', 'enhanced', 'ready')
GROUP BY t.stage
ORDER BY t.stage;
```

---

## Rollback Plan

If issues arise, rollback is simple:

1. **Revert code changes**: `git revert <commit-hash>`
2. **Re-advance tracks**: Update stage manually via SQL
3. **Clean up tasks**: Delete seeded tasks if needed

But rollback is **not recommended** because the fix addresses a critical bug affecting user experience.
