# Code Cleanup Plan

**Created**: 2025-11-08
**Status**: In Progress

## Overview

Systematic refactoring to eliminate duplication, improve type safety, and reduce injection risks before scaling to full audio pipeline processing.

---

## ✅ Completed

### 1. Unified Stage & Status Enums (`src/db/task-stages.ts`)

**Created**: Centralized type system for pipeline progression

- ✅ `AudioTaskType` enum: download, align, translate, separate, segment, enhance, clip
- ✅ `TaskStatus` enum: pending, running, completed, failed
- ✅ `TrackStage` enum: Complete pipeline stages (discovered → published)
- ✅ `STAGE_REQUIREMENTS`: Map of stages to required completed tasks
- ✅ `deriveStageFromTasks()`: Automatic stage calculation from completed tasks
- ✅ Type guards: `isAudioTaskType()`, `isTaskStatus()`, `isTrackStage()`
- ✅ Helper functions: `getStageDescription()`, `isAudioPipelineStage()`

**Impact**: Single source of truth for all stage/status values across codebase

### 2. Deduplicated Stage Tracking Logic

**Fixed**: `src/db/audio-tasks.ts::updateTrackStage()`

- ✅ Removed manual if/else stage derivation
- ✅ Now uses centralized `deriveStageFromTasks()` function
- ✅ Automatic calculation from completed audio tasks

**Next**: Remove duplicate from `src/db/queries.ts` (line 44-53)

---

## 🔄 In Progress

### 3. Storage Service Consolidation

**Problem**: Duplicate `uploadToGrove()` exports causing import confusion

**Current State**:
- `src/services/grove.ts:212`: Legacy direct export
- `src/services/storage.ts:259`: Wrapper calling Grove service
- `src/tasks/audio/enhance-audio.ts:27-28`: Imports from BOTH modules (conflict!)
- `src/tasks/audio/clip-segments.ts:25`: Imports from storage.ts

**Solution**:

1. **Delete** `uploadToGrove()` standalone function from `grove.ts` (line 212+)
2. **Keep** GroveService class methods only (used by StorageService internally)
3. **Standardize** all tasks to import from `services/storage.ts`:
   - Update `enhance-audio.ts:28` - remove `grove` import
   - Update `clip-segments.ts:25` - verify using storage.ts
4. **Document** storage strategy in storage.ts header:
   - Grove: All audio files (temp + final)
   - load.network: Small metadata only (<100KB)

**Files to modify**:
- `src/services/grove.ts` - Remove standalone `uploadToGrove()` export
- `src/tasks/audio/enhance-audio.ts` - Fix double import
- `src/tasks/audio/clip-segments.ts` - Verify import

---

## 🔜 Pending

### 4. Remove Duplicate `updateTrackStage()` from queries.ts

**Problem**: Two implementations of same function

- `src/db/audio-tasks.ts:187` - ✅ Refactored (uses centralized logic)
- `src/db/queries.ts:44` - ❌ Old manual implementation (to be deleted)

**Solution**:

1. **Delete** lines 42-53 from `src/db/queries.ts`
2. **Export** `updateTrackStage` from `audio-tasks.ts` for external use
3. **Update** any imports to use `audio-tasks.ts` version

**Command**: `grep -rn "updateTrackStage" src/ --include="*.ts" | grep -v audio-tasks.ts`

---

### 5. Extract Typed SQL Helpers (Injection Risk Mitigation)

**Problem**: Raw SQL scattered across processors

**Current**: Every processor has inline SQL:
- `src/tasks/audio/translate-lyrics.ts` - Manual UPDATE statements
- `src/tasks/audio/separate-audio.ts` - Raw INSERT/UPDATE
- `src/tasks/audio/enhance-audio.ts` - Hand-written queries

**Solution**: Create typed helper functions in `src/db/audio-queries.ts`:

```typescript
// Example typed helpers
export async function updateSongAudioStems(
  spotifyTrackId: string,
  stems: {
    vocals?: string;
    instrumental?: string;
    drums?: string;
    bass?: string;
  }
): Promise<void> {
  // Parameterized query with proper escaping
}

export async function upsertKaraokeSegment(
  data: {
    spotifyTrackId: string;
    clipStartMs: number;
    clipEndMs: number;
    vocals?: string;
    instrumental?: string;
  }
): Promise<void> {
  // UPSERT with conflict handling
}

export async function updateTranslation(
  spotifyTrackId: string,
  translationData: {
    lines: Array<{ original: string; translated: string }>;
    targetLanguage: string;
  }
): Promise<void> {
  // JSONB update with validation
}
```

**Benefits**:
- Type-safe parameters (no SQL injection)
- Consistent error handling
- Easier testing
- Better logging

**Files to refactor**:
1. `translate-lyrics.ts` - Use `updateTranslation()`
2. `separate-audio.ts` - Use `updateSongAudioStems()`
3. `enhance-audio.ts` - Use `updateKaraokeSegment()`
4. `clip-segments.ts` - Use `updateKaraokeSegment()`

---

### 6. Fix `enhance-audio.ts` Stage Dependencies

**Problem**: Code checks for non-existent `select_segments` stage

**Current** (line ~XX):
```typescript
if (track.stage !== 'select_segments') {
  throw new Error('Track must be at select_segments stage');
}
```

**Issue**: Stage should be `segmented` (from TrackStage enum)

**Solution**:

1. Update stage check to use enum:
   ```typescript
   import { TrackStage } from '../../db/task-stages';

   if (track.stage !== TrackStage.Segmented) {
     throw new Error(`Track must be segmented (current: ${track.stage})`);
   }
   ```

2. Remove double `uploadToGrove` import (see task #3)

3. Ensure uses `StorageService` instead of raw functions

---

### 7. Create Shared Utilities

**Problem**: Polling/logging logic duplicated in Demucs/Fal processors

**Create**: `src/tasks/audio/utils/`
- `polling.ts` - Generic polling with exponential backoff
- `logging.ts` - Structured task logging (with trace IDs)
- `file-handling.ts` - Common file ops (download, buffer conversion)

**Benefits**:
- DRY principle
- Consistent logging format
- Testable utilities

---

### 8. Documentation Updates

**Files to update**:

1. **README.md**
   - Remove psql direct access references
   - Add "MCP tools only" section
   - Update pipeline status (translation/separation exist)

2. **PIPELINE-FLOW.md**
   - Update stage enum references
   - Document StorageService usage
   - Clarify when to use Grove vs load.network

3. **New**: `STORAGE-STRATEGY.md`
   - Grove: Audio files (all sizes, temporary + final)
   - load.network: Metadata only (<100KB, EVM blockchain)
   - Encryption: Lit Protocol for full-length enhanced audio
   - Public: ~55s viral clips remain unencrypted

---

## Execution Order

### Phase 1 - Immediate (Today)
1. ✅ Create stage enum system
2. ✅ Deduplicate audio-tasks.ts stage logic
3. 🔄 Consolidate storage helpers
4. ⏳ Remove queries.ts duplicate
5. ⏳ Fix enhance-audio.ts imports

### Phase 2 - SQL Safety (Next Session)
6. Extract typed SQL helpers
7. Refactor processors to use helpers

### Phase 3 - Code Quality (Next Session)
8. Create shared utilities
9. Update documentation

---

## Testing Strategy

After each phase:

1. **Type Check**: `bun run tsc --noEmit`
2. **Run Sample**: `bun task:enhance --limit=1` (full flow test)
3. **Verify DB**: Check `audio_tasks` and `tracks` stage updates

---

## Success Criteria

### Phase 1 Complete When:
- [ ] No duplicate exports (storage/grove)
- [ ] No duplicate functions (updateTrackStage)
- [ ] All processors use centralized enums
- [ ] enhance-audio.ts imports fixed
- [ ] All type checks pass

### Phase 2 Complete When:
- [ ] All SQL in typed helpers (no inline)
- [ ] Parameterized queries only
- [ ] Consistent error handling

### Phase 3 Complete When:
- [ ] Shared utils extracted
- [ ] Documentation updated
- [ ] MCP-only DB access documented

---

## Notes

- **Don't break existing functionality** - this is refactoring only
- **Test after each file change** - catch regressions early
- **Commit frequently** - small atomic changes
- **Keep STATUS.md updated** - track overall pipeline progress

---

**Next Action**: Continue with Storage Service consolidation (Task #3)
