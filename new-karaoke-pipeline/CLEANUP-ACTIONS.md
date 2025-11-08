# Immediate Cleanup Actions

**Based on code review feedback - 2025-11-08**

## Critical Issues to Fix NOW

### 1. ✅ FIXED: Translation Provider Comment
- **Issue**: Enum claimed "DeepL translation"
- **Reality**: Using Gemini Flash 2.5 Lite via OpenRouter
- **Status**: ✅ Committed in 9baf811

---

### 2. Hardcoded Stage Strings → Enum Migration

**Problem**: Processors bypass the new enum system with string literals

#### Files to Fix:

**`src/tasks/audio/separate-audio.ts:55`**
```typescript
// BEFORE (hardcoded string)
WHERE t.stage = 'translated'

// AFTER (use enum)
import { TrackStage } from '../../db/task-stages';
WHERE t.stage = $${TrackStage.Translated}
```

**`src/tasks/audio/enhance-audio.ts:34`**
```typescript
// BEFORE
if (track.stage !== 'segmented')

// AFTER
import { TrackStage } from '../../db/task-stages';
if (track.stage !== TrackStage.Segmented)
```

**Search command**:
```bash
grep -rn "stage = '" src/tasks/audio/ --include="*.ts"
grep -rn 'stage !== "' src/tasks/audio/ --include="*.ts"
```

**Files needing enum imports**:
- `src/tasks/audio/separate-audio.ts`
- `src/tasks/audio/enhance-audio.ts`
- `src/tasks/audio/select-segments.ts`
- `src/tasks/audio/clip-segments.ts`

---

### 3. Storage Service Duplication

**Problem**: `uploadToGrove()` exported from TWO places

#### Current Exports:
- `services/grove.ts:212` - Direct export (legacy)
- `services/storage.ts:259` - Wrapper calling GroveService

#### Conflict:
```typescript
// enhance-audio.ts:26-28
import { uploadToGrove } from '../../services/storage';   // Line 27
import { uploadToGrove, downloadFromGrove } from '../../services/grove';  // Line 28
// ❌ Bun treats this as duplicate declaration
```

#### Solution:

**Step 1**: Remove export from `services/grove.ts`
```typescript
// grove.ts - Make function private/internal
async function uploadToGroveInternal(...) {  // or just don't export
  // ... implementation
}

// Keep GroveService class (used by StorageService)
export class GroveService {
  // ...
}
```

**Step 2**: Update `enhance-audio.ts`
```typescript
// Remove line 28 entirely
// Keep only:
import { uploadToGrove } from '../../services/storage';

// Remove unused import:
// ❌ downloadFromGrove - not used anywhere in file
```

**Step 3**: Verify all processors import from `storage.ts` only
```bash
grep -rn "from.*grove" src/tasks/ --include="*.ts"
# Should show ZERO imports from '../../services/grove'
```

---

### 4. Database Project Reference Consistency

**Issue**: Documentation mentions multiple project IDs

#### Current State:
- **.env**: `ep-royal-block-a4s10rvi` ✅ (actual DB)
- **STATUS.md:2**: `ep-royal-block` ✅ (correct)
- **Other docs**: May reference old `flat-mode-57592166` ❌

#### Action:
Search and replace any old references:
```bash
grep -rn "flat-mode\|frosty-smoke" . --include="*.md" --include=".env.example"
```

Update to consistently use: **ep-royal-block-a4s10rvi**

---

### 5. Raw SQL Inline (Future: Extract to Helpers)

**Not blocking immediate work, but document locations**:

Files with inline SQL that need typed helpers:
- `enhance-audio.ts:214-239` - UPDATE karaoke_segments
- `translate-lyrics.ts:143-174` - UPDATE lyrics_translations
- `separate-audio.ts` - UPDATE song_audio

**Plan**: Create `src/db/audio-queries.ts` with:
```typescript
export async function updateKaraokeSegment(
  spotifyTrackId: string,
  data: {
    vocalGroveUrl?: string;
    instrumentalGroveUrl?: string;
    enhancedVocalUrl?: string;
    clipStartMs?: number;
    clipEndMs?: number;
  }
): Promise<void> {
  // Parameterized query
}
```

---

### 6. Documentation Updates (After Code Changes)

**Files to update AFTER above fixes**:

1. **README.md**
   - Remove direct `psql` usage instructions
   - Add "MCP tools only" section
   - Update DB project reference

2. **PIPELINE-FLOW.md**
   - Update stage references to use enum names
   - Document StorageService pattern

3. **STATUS.md**
   - Verify DB project ID
   - Add source SQL queries for pipeline counts

4. **CLEANUP-PLAN.md**
   - Mark completed items
   - Update priorities

---

## Execution Order

### Phase 1 (This Session):
1. ✅ Fix translation provider comment
2. ⏳ Replace hardcoded strings with TrackStage enum (4 files)
3. ⏳ Remove duplicate uploadToGrove export
4. ⏳ Fix enhance-audio.ts double import
5. ⏳ Verify DB project references

### Phase 2 (Next Session):
6. Extract SQL helpers (`audio-queries.ts`)
7. Refactor processors to use helpers
8. Update documentation

---

## Validation Commands

After each fix, run:

```bash
# Type check
bun run tsc --noEmit

# Search for remaining hardcoded stages
grep -rn "stage = '" src/tasks/audio/ --include="*.ts"

# Check for duplicate imports
grep -rn "uploadToGrove" src/tasks/ --include="*.ts"

# Test end-to-end
bun task:enhance --limit=1
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Zero hardcoded stage strings in processors
- [ ] Zero duplicate storage imports
- [ ] `bun run tsc --noEmit` passes
- [ ] `bun task:enhance --limit=1` succeeds
- [ ] All DB references consistent

### Code Quality Wins:
- ✅ Compile-time safety for stage values
- ✅ Single source of truth for storage
- ✅ No import conflicts
- ✅ Consistent documentation

---

**Next**: Start with hardcoded string replacement (highest impact for type safety)
