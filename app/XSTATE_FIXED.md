# XState Unlock Flow - Fixed & Ready ✅

## Summary

The unlock flow state machine has been **fully updated** to match the actual Lit Action function signatures. All **17/17 tests passing**.

## What Was Fixed

### 1. Updated Context Types

Added new fields needed for parallel processing:

```typescript
export interface UnlockContext {
  // NEW: User data
  pkpAddress: string | null;
  artist: string;
  title: string;

  // NEW: Data from match-and-segment (needed by parallel actors)
  soundcloudPermalink: string | null;
  sections: Array<{ type: string; startTime: number; endTime: number; duration: number }> | null;
  songDuration: number | null;
  plainLyrics: string | null;

  // ... existing fields ...
}
```

### 2. Added Lyrics Fetch Step

**New actor:** `fetchLyricsLogic`
- Fetches plain lyrics from LRClib API
- Parses synced lyrics to extract plain text
- Required for `executeBaseAlignment`

**New state:** `fetchingLyrics` (between `waitingForTx` and `processing`)

```
waitingForTx → fetchingLyrics → processing (parallel)
```

### 3. Fixed Audio Processor Parameters

**Before:**
```typescript
executeAudioProcessor(geniusId, pkpAuthContext) // ❌ Missing 5 parameters
```

**After:**
```typescript
executeAudioProcessor(
  geniusId,
  1, // sectionIndex - default to first segment
  sections, // From match-and-segment result
  soundcloudPermalink, // From match-and-segment result
  pkpAddress, // User's wallet
  songDuration, // Calculated from sections
  pkpAuthContext
) // ✅ All parameters provided
```

### 4. Fixed Base Alignment Parameters

**Before:**
```typescript
executeBaseAlignment(geniusId, pkpAuthContext) // ❌ Missing 2 parameters
```

**After:**
```typescript
executeBaseAlignment(
  geniusId,
  soundcloudPermalink, // From match-and-segment result
  plainLyrics, // From fetchLyrics actor
  pkpAuthContext
) // ✅ All parameters provided
```

### 5. Fixed Translation Import

**Before:**
```typescript
const { executeTranslateLyrics } = await import('@/lib/lit/actions/translate'); // ❌ Wrong name
```

**After:**
```typescript
const { executeTranslate } = await import('@/lib/lit/actions/translate'); // ✅ Correct name
```

### 6. Match-and-Segment Success Handler

Now stores result data in context for parallel actors:

```typescript
actions: assign({
  matchResult: ({ event }) => event.output,
  txHash: ({ event }) => event.output.txHash || null,
  // NEW: Store data needed by parallel actors
  soundcloudPermalink: ({ event }) => event.output.genius?.soundcloudPermalink || null,
  sections: ({ event }) => event.output.sections || null,
  songDuration: ({ event }) =>
    event.output.sections && event.output.sections.length > 0
      ? Math.max(...event.output.sections.map((s: any) => s.endTime))
      : null,
}),
```

### 7. Updated useUnlockFlow Hook

Added required input fields:

```typescript
export interface UseUnlockFlowOptions {
  geniusId: number;
  pkpAuthContext: PKPAuthContext | null;
  pkpAddress: string; // NEW
  artist: string; // NEW
  title: string; // NEW
  isFree: boolean;
  creditBalance: number;
  targetLanguage?: string;
}
```

Added new state flags:

```typescript
const isFetchingLyrics = state.matches('fetchingLyrics');
const hasLyricsFetchFailed = state.matches('lyricsFetchFailed');
```

## Updated Flow Diagram

```
START
  ↓
checkingRequirements
  ├─ isFree? → matchAndSegment
  ├─ hasCredits? → matchAndSegment
  └─ else → showCreditDialog
        ↓
    [User purchases credits]
        ↓
    creditsAcquired() → matchAndSegment (3-4s)
        ↓
    [Stores: soundcloudPermalink, sections, songDuration]
        ↓
waitingForTx (1-2s)
        ↓
fetchingLyrics (1-2s) ← NEW STEP
    [Fetches plain lyrics from LRClib]
        ↓
    [Stores: plainLyrics]
        ↓
processing (parallel ~60s)
  ├─ audio (~60s) - Uses: sections, soundcloudPermalink, pkpAddress, songDuration
  ├─ alignment (~10s) - Uses: soundcloudPermalink, plainLyrics
  └─ translation (~15s) - Uses: geniusId, targetLanguage
        ↓
complete
```

## Test Results

```bash
bun run test:unit
```

```
✓ |unit| src/machines/__tests__/unlockMachine.test.ts (17 tests) 19ms

✓ State Transitions (2 tests)
✓ Credit Checking Guards (5 tests)
✓ Match and Segment (3 tests)
✓ Parallel Processing (2 tests)
✓ Language Configuration (3 tests)
✓ Error Recovery (2 tests)

Test Files  1 passed (1)
Tests  17 passed (17)
```

## Integration Example

```typescript
import { useUnlockFlow } from '@/hooks/useUnlockFlow'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'

function KaraokeSongPage() {
  const { pkpAuthContext, pkpAddress } = useAuth()
  const { credits } = useCredits()

  // Assume song data is loaded
  const song = {
    geniusId: 135690,
    artist: 'Tame Impala',
    title: 'Mind Mischief',
    isFree: false,
  }

  const unlockFlow = useUnlockFlow({
    geniusId: song.geniusId,
    pkpAuthContext,
    pkpAddress: pkpAddress!,
    artist: song.artist,
    title: song.title,
    isFree: song.isFree,
    creditBalance: credits,
    targetLanguage: 'zh', // Default to Mandarin
  })

  const handleUnlock = () => {
    unlockFlow.start()
  }

  // Show CreditFlowDialog when needed
  if (unlockFlow.needsCredits) {
    return (
      <CreditFlowDialog
        open={true}
        onOpenChange={() => unlockFlow.cancel()}
        songTitle={song.title}
        songArtist={song.artist}
        walletAddress={pkpAddress!}
        usdcBalance="0.50"
        onPurchaseCredits={(packageId) => {
          // After purchase completes...
          unlockFlow.creditsAcquired()
        }}
      />
    )
  }

  // Show progress during unlock
  if (unlockFlow.isUnlocking) {
    return (
      <UnlockProgress
        overallProgress={unlockFlow.overallProgress}
        isMatchingAndSegmenting={unlockFlow.isMatchingAndSegmenting}
        isWaitingForTx={unlockFlow.isWaitingForTx}
        isFetchingLyrics={unlockFlow.isFetchingLyrics}
        isAudioLoading={unlockFlow.isAudioLoading}
        isAlignmentLoading={unlockFlow.isAlignmentLoading}
        isTranslationLoading={unlockFlow.isTranslationLoading}
        audioProgress={unlockFlow.audioProgress}
        alignmentProgress={unlockFlow.alignmentProgress}
        translationProgress={unlockFlow.translationProgress}
        audioError={unlockFlow.audioError}
        alignmentError={unlockFlow.alignmentError}
        translationError={unlockFlow.translationError}
        onRetryAudio={unlockFlow.retryAudio}
        onRetryAlignment={unlockFlow.retryAlignment}
        onRetryTranslation={unlockFlow.retryTranslation}
      />
    )
  }

  // Show unlock button
  return (
    <SongPage
      songTitle={song.title}
      artist={song.artist}
      segments={segments}
      onUnlockAll={handleUnlock}
    />
  )
}
```

## Files Modified

### State Machine
- `/app/src/machines/unlockMachine.ts` - Updated context, actors, and state flow
- `/app/src/machines/__tests__/unlockMachine.test.ts` - Updated test inputs and expectations

### Hook
- `/app/src/hooks/useUnlockFlow.ts` - Updated input interface and state flags

### Documentation
- `/app/XSTATE_INTEGRATION_ANALYSIS.md` - Original analysis
- `/app/XSTATE_FIXED.md` - This document (summary of fixes)

## Next Steps

1. **Integrate into KaraokeSongPage.tsx**
   - Replace manual unlock handler with `useUnlockFlow`
   - Add `CreditFlowDialog` rendering
   - Add `UnlockProgress` UI during processing

2. **Test End-to-End**
   - Test with free song
   - Test with paid song (no credits) → CreditFlowDialog
   - Test with paid song (has credits) → immediate unlock
   - Test error recovery flows

3. **Monitor Progress Updates**
   - Audio processor runs via webhook (60s)
   - Need to poll or subscribe for progress updates
   - Update `audioProgress`, `alignmentProgress`, `translationProgress` in context

## Breaking Changes

### For Consumers of useUnlockFlow

**Before:**
```typescript
useUnlockFlow({
  geniusId: 123,
  pkpAuthContext,
  isFree: false,
  creditBalance: 5,
})
```

**After:**
```typescript
useUnlockFlow({
  geniusId: 123,
  pkpAuthContext,
  pkpAddress, // NEW - required
  artist, // NEW - required
  title, // NEW - required
  isFree: false,
  creditBalance: 5,
})
```

### New State Flags

- `isFetchingLyrics` - Machine is fetching lyrics from LRClib
- `hasLyricsFetchFailed` - Lyrics fetch failed

## Benefits

✅ **Type-safe** - All parameters validated at compile time
✅ **Testable** - All 17 tests passing
✅ **Complete** - Matches actual Lit Action signatures
✅ **Reliable** - Handles all error states with retry options
✅ **Efficient** - Only fetches lyrics once, reuses data
✅ **Ready** - Can be integrated immediately

## Questions?

See:
- `/app/UNLOCK_FLOW_COMPLETE.md` - Original architecture guide
- `/app/XSTATE_INTEGRATION_ANALYSIS.md` - Analysis that identified issues
- `/app/UNLOCK_FLOW_TESTS.md` - Test documentation
