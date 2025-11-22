# Code Quality Fixes Required for Production

**Date**: 2025-11-12
**Status**: Documented, ready for implementation
**Priority Levels**: P0 (blocking), P1 (high impact), P2 (nice-to-have)

---

## Summary Table

| Priority | File | Issue | Impact | Fix Type |
|----------|------|-------|--------|----------|
| P1 | generate-karaoke-lines.ts | Wrong language selection | Only 5 lines instead of 94 | 1-line SQL change |
| P1 | select-segments.ts | Broken task lifecycle | Stage stuck at 'separated' | Add 3 function calls |
| P1 | enhance-audio.ts | Broken task lifecycle | Status stuck at 'running' | Add completeTask call |
| P2 | encrypt-clips.ts | No task tracking | No audit trail for encryption | Add ensureAudioTask/completeTask |
| P2 | manual-track-pipeline.ts | Missing encryption phase | Can't orchestrate full pipeline | Add 1 task to array |
| P2 | encrypt-clips.ts | Missing validation | Could attempt encryption without artist identity | Add pre-check query |

---

## P1: URGENT - Task Lifecycle Issues

### Issue 1: generate-karaoke-lines Selects Wrong Translation

**File**: `src/tasks/audio/generate-karaoke-lines.ts`
**Lines**: 33-64
**Severity**: P1 - Data Corruption
**Impact**: Generates 5 karaoke_lines instead of 94, blocking segment selection

**Current Code**:
```typescript
const lines = await query<any>(
  `SELECT DISTINCT ON (lt.spotify_track_id)
    lt.spotify_track_id,
    lt.language_code,
    lt.lines
  FROM lyrics_translations lt
  WHERE lt.spotify_track_id = $1
    AND lt.lines IS NOT NULL
  ORDER BY lt.language_code,
           lt.created_at DESC
  LIMIT 1`,
  [spotifyId]
);
```

**Problem**: `ORDER BY lt.language_code` means DISTINCT ON selects alphabetically first language (e.g., "en" = English), which may be broken or incomplete. For RATM, English had only 5 lines while Chinese/Vietnamese had 94.

**Fix** (1 line change):
```typescript
// Change this line:
ORDER BY lt.language_code,

// To this:
ORDER BY array_length(lt.lines, 1) DESC NULLS LAST,
```

This selects the translation with the most lines instead of alphabetical order.

**Verification After Fix**:
```sql
-- Should select translation with 94 lines
SELECT language_code, array_length(lines, 1) as count
FROM lyrics_translations
WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp'
ORDER BY count DESC
LIMIT 1;

-- Expected: language_code=zh (or any language with 94 lines), count=94
```

---

### Issue 2: select-segments Doesn't Update Track Stage

**File**: `src/tasks/audio/select-segments.ts`
**Lines**: 405-417 (after segment insertion)
**Severity**: P1 - Task State Inconsistency
**Impact**: Track stage remains 'separated' even after successful segment creation

**Current Code** (lines 405-417):
```typescript
// Store in karaoke_segments
await query(
  `INSERT INTO karaoke_segments (
    spotify_track_id,
    clip_start_ms,
    clip_end_ms
  ) VALUES ($1, $2, $3)
  ON CONFLICT (spotify_track_id)
  DO UPDATE SET
    clip_start_ms = $2,
    clip_end_ms = $3,
    updated_at = NOW()`,
  [track.spotify_track_id, selection.start_ms, selection.end_ms]
);

// Missing: completeTask() and updateTrackStage()
```

**Problem**: Task succeeds but doesn't update task status or track stage, leaving:
- `audio_tasks.status` = 'running'
- `tracks.stage` = 'separated' (should be 'segmented')

**Fix** (add after line 417):
```typescript
// Complete task and advance track stage
const processingTime = Date.now() - startTime;
await completeTask(track.spotify_track_id, 'segment', {
  metadata: {
    clip_start_ms: selection.start_ms,
    clip_end_ms: selection.end_ms,
    clip_duration_ms: selection.duration_ms,
    method: !selection ? 'ai-structure' : 'simple/deterministic'
  },
  duration_ms: processingTime
});

await updateTrackStage(track.spotify_track_id);
```

**Verification After Fix**:
```sql
SELECT stage FROM tracks WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
-- Expected: stage='segmented'

SELECT status FROM audio_tasks
WHERE subject_id = '59WN2psjkt1tyaxjspN8fp' AND task_type = 'segment';
-- Expected: status='completed'
```

---

### Issue 3: enhance-audio Doesn't Call completeTask

**File**: `src/tasks/audio/enhance-audio.ts`
**Lines**: ~280-300 (after FAL enhancement and upload)
**Severity**: P1 - Task State Inconsistency
**Impact**: Task status stuck at 'running', track stage stuck at 'separated'

**Current Code** (missing after upload completes):
```typescript
// After FAL enhancement and crossfade merge, upload completes:
const enhancedUpload = await uploadToGrove(mergedBuffer, ...);

// Missing: completeTask() and updateTrackStage()
// Task status remains 'running' indefinitely
```

**Problem**: Like select-segments, task succeeds but doesn't mark completion or advance stage.

**Fix** (add after Grove upload completion):
```typescript
const processingTime = Date.now() - startTime;
await completeTask(track.spotify_track_id, 'enhance', {
  metadata: {
    fal_enhanced_grove_cid: enhancedUpload.cid,
    fal_enhanced_grove_url: enhancedUpload.url,
    enhancement_chunks: splitChunks.length,
    processing_time_ms: processingTime
  },
  duration_ms: processingTime
});

await updateTrackStage(track.spotify_track_id);
```

**Verification After Fix**:
```sql
SELECT stage FROM tracks WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
-- Expected: stage='enhanced'

SELECT status FROM audio_tasks
WHERE subject_id = '59WN2psjkt1tyaxjspN8fp' AND task_type = 'enhance';
-- Expected: status='completed'
```

---

## P2: HIGH PRIORITY - Encryption Integration

### Issue 4: Encryption Task Not in Orchestrator

**File**: `src/scripts/manual-track-pipeline.ts`
**Lines**: 32-40 (TASKS_IN_ORDER array)
**Severity**: P2 - Usability
**Impact**: Can't run full pipeline through CLI, encryption must be run manually

**Current Code**:
```typescript
const TASKS_IN_ORDER = [
  { name: "download", phase: "audio", command: "src/tasks/audio/download-audio.ts" },
  { name: "align", phase: "audio", command: "src/tasks/audio/align-lyrics.ts" },
  { name: "translate", phase: "lyrics", command: "src/tasks/audio/translate-lyrics.ts" },
  { name: "separate", phase: "separation", command: "src/tasks/audio/separate-audio.ts" },
  { name: "segment", phase: "separation", command: "src/tasks/audio/select-segments.ts" },
  { name: "enhance", phase: "separation", command: "src/tasks/audio/enhance-audio.ts" },
  { name: "clip", phase: "clip", command: "src/tasks/audio/clip-segments.ts" },
];
```

**Problem**: Missing encryption task, preventing full-pipeline orchestration.

**Fix** (add before clip):
```typescript
{ name: "encrypt", phase: "encryption", command: "src/tasks/audio/encrypt-clips.ts" },
```

**Result**: Users can now run:
```bash
bun src/scripts/manual-track-pipeline.ts --spotifyId=59WN2psjkt1tyaxjspN8fp --phase=encryption
# Or full pipeline:
bun src/scripts/manual-track-pipeline.ts --spotifyId=59WN2psjkt1tyaxjspN8fp
```

---

### Issue 5: encrypt-clips Has No Task Tracking

**File**: `src/tasks/audio/encrypt-clips.ts`
**Lines**: Start of processClip() and end
**Severity**: P2 - Auditability
**Impact**: No audit trail for encryption operations, can't track which clips were processed

**Current Code**:
```typescript
// At start of processing:
console.log(`\n🎵 Processing clip: ${clip.artist_name} - ${clip.spotify_track_id}`);

// ... encryption process ...

// At end, no task tracking:
console.log(`   ✅ Clip encryption complete!`);
// Should have: completeTask() to record what was done
```

**Problem**: Unlike other audio tasks, encrypt-clips doesn't call:
- `ensureAudioTask()` - Create task record
- `startTask()` - Mark as running
- `completeTask()` - Mark as complete

**Fix** (add at start and end of processClip):
```typescript
// At start of processing:
await ensureAudioTask(clip.spotify_track_id, 'encrypt');
await startTask(clip.spotify_track_id, 'encrypt');

try {
  // ... existing encryption code ...

  // At end (after event emission):
  const processingTime = Date.now() - startTime;
  await completeTask(clip.spotify_track_id, 'encrypt', {
    metadata: {
      encrypted_full_cid: encryptedUpload.cid,
      encrypted_full_url: encryptedUpload.url,
      manifest_cid: manifestUpload.cid,
      manifest_url: manifestUpload.url,
      unlock_lock: clip.subscription_lock_address,
      unlock_chain: clip.subscription_lock_chain
    },
    duration_ms: processingTime
  });

  await updateTrackStage(clip.spotify_track_id);

} catch (error) {
  await failTask(clip.spotify_track_id, 'encrypt', 'track', error.message, {
    stack: error.stack
  });
  throw error;
}
```

**Verification After Fix**:
```sql
SELECT id, task_type, status, metadata
FROM audio_tasks
WHERE subject_id = '59WN2psjkt1tyaxjspN8fp' AND task_type = 'encrypt';
-- Expected: status='completed', metadata has encryption details
```

---

### Issue 6: Missing Artist Identity Pre-Check in Encryption

**File**: `src/tasks/audio/encrypt-clips.ts`
**Lines**: 142-166 (findClipsToEncrypt function)
**Severity**: P2 - Robustness
**Impact**: Could attempt encryption on clips without complete artist identity

**Current Code**:
```typescript
const clips = await query<ClipToEncrypt>(`
  SELECT ... FROM karaoke_segments ks
  JOIN tracks t ON ...
  JOIN lens_accounts la ON la.spotify_artist_id = t.primary_artist_id
  WHERE ks.encrypted_full_cid IS NULL
    AND la.subscription_lock_address IS NOT NULL
  ORDER BY ks.created_at DESC
  LIMIT $1
`);
```

**Problem**: Only checks for `subscription_lock_address`, doesn't verify:
- `pkp_address` exists
- `lens_account_id` exists
- All three are linked

**Fix** (replace WHERE clause):
```sql
WHERE ks.encrypted_full_cid IS NULL
  AND ks.fal_enhanced_grove_url IS NOT NULL
  AND la.subscription_lock_address IS NOT NULL
  AND la.pkp_address IS NOT NULL
  AND la.lens_account_id IS NOT NULL
  AND la.lens_account_address IS NOT NULL
```

**Verification After Fix**:
```sql
-- Should only return clips where artist has complete identity
SELECT ks.spotify_track_id
FROM karaoke_segments ks
JOIN tracks t ON t.spotify_track_id = ks.spotify_track_id
JOIN lens_accounts la ON la.spotify_artist_id = t.primary_artist_id
WHERE ks.encrypted_full_cid IS NULL
  AND ks.fal_enhanced_grove_url IS NOT NULL
  AND la.subscription_lock_address IS NOT NULL
  AND la.pkp_address IS NOT NULL
  AND la.lens_account_id IS NOT NULL
  AND la.lens_account_address IS NOT NULL;
```

---

## Implementation Checklist

### Before Production Deployment

- [ ] **P1.1**: Fix generate-karaoke-lines language selection (1-line change)
- [ ] **P1.2**: Add completeTask + updateTrackStage to select-segments
- [ ] **P1.3**: Add completeTask + updateTrackStage to enhance-audio
- [ ] **P2.1**: Add encryption task to manual-track-pipeline orchestrator
- [ ] **P2.2**: Add task tracking (ensureAudioTask/startTask/completeTask) to encrypt-clips
- [ ] **P2.3**: Add artist identity pre-check to encrypt-clips findClipsToEncrypt()

### Testing After Each Fix

```bash
# Test generate-karaoke-lines fix
bun src/tasks/audio/generate-karaoke-lines.ts --limit=1
# Verify: karaoke_lines count = 94 (not 5)

# Test select-segments fix
bun src/tasks/audio/select-segments.ts --limit=1
# Verify: track stage = 'segmented', audio_tasks.status = 'completed'

# Test enhance-audio fix
bun src/tasks/audio/enhance-audio.ts --limit=1
# Verify: track stage = 'enhanced', audio_tasks.status = 'completed'

# Test full pipeline with orchestrator
bun src/scripts/manual-track-pipeline.ts --spotifyId=NEW_TRACK_ID --phase=encryption
# Verify: Runs through all phases including encryption
```

---

## Impact Analysis

### Current State (Before Fixes)
- ❌ Manual track processing requires file cleanup after each task
- ❌ Stage progression is unreliable
- ❌ Encryption has no audit trail
- ❌ Pipeline orchestration incomplete

### After All Fixes
- ✅ Automatic stage progression
- ✅ Full task tracking and audit trail
- ✅ Complete pipeline orchestration
- ✅ Pre-validation prevents encryption failures
- ✅ Production-ready for automated batch processing

---

## Risk Assessment

### Low Risk Changes
- ✅ Reordering SQL ORDER BY clause (no data modification)
- ✅ Adding function calls (no logic changes to existing code)

### Medium Risk Changes
- ⚠️ Adding validation in encryption (could skip clips in rare edge cases, but correctly)

### Testing Strategy
1. Test each fix individually with debug logging
2. Run full pipeline on test track (non-production)
3. Verify database state matches expected progression
4. Monitor for any regressions in existing functionality

---

## Estimated Implementation Time

| Fix | Effort | Priority |
|-----|--------|----------|
| P1.1 (language selection) | 5 min | Do immediately |
| P1.2 (select-segments) | 10 min | Do immediately |
| P1.3 (enhance-audio) | 10 min | Do immediately |
| P2.1 (orchestrator) | 5 min | Do before production |
| P2.2 (encrypt tracking) | 15 min | Do before production |
| P2.3 (encrypt validation) | 10 min | Do before production |

**Total**: ~55 minutes for all production-ready fixes

---

## References

**See also**:
- `docs/manual-spotify-ingestion.md` - Complete operational guide with these issues documented
- `docs/ratm-pipeline-status.md` - Current status of RATM track showing all issues
- `src/db/audio-tasks.ts` - Task management functions (ensureAudioTask, completeTask, failTask)
- `src/db/task-stages.ts` - Track stage constants
