# XState Unlock Flow - Integration Analysis

## Summary

The XState unlock machine is **partially ready** for integration but has **critical parameter mismatches** with the actual Lit Action functions. The architecture is sound but needs updates to match the real function signatures.

## ✅ What Works

### 1. Core Architecture
- State machine structure is correct (idle → credit check → match → tx → parallel processing)
- Credit checking logic matches CreditsContext
- CreditFlowDialog integration points are correct
- Test coverage is comprehensive (17/17 passing)

### 2. Frontend Components Exist
- ✅ `CreditsContext` - provides `credits` number and `loadCredits()` function
- ✅ `CreditFlowDialog` - has correct props (`open`, `onOpenChange`, `onPurchaseCredits`)
- ✅ All 3 Lit action files exist:
  - `executeAudioProcessor` in `/lib/lit/actions/audio-processor.ts`
  - `executeBaseAlignment` in `/lib/lit/actions/base-alignment.ts`
  - `executeTranslate` in `/lib/lit/actions/translate.ts`
- ✅ `useKaraokeGeneration` hook shows the correct usage patterns

### 3. Credit Flow
- Guard logic (`isFree`, `hasCredits`) matches contract behavior
- State machine correctly shows dialog when credits are missing
- `CREDITS_ACQUIRED` event properly transitions to unlock

## ❌ What Doesn't Work

### Critical Issue: Function Signature Mismatches

The state machine actors assume simplified function signatures, but the real functions need more parameters:

#### 1. Audio Processor Actor

**State machine expects:**
```typescript
executeAudioProcessor(geniusId, pkpAuthContext)
```

**Actual function signature:**
```typescript
executeAudioProcessor(
  geniusId: number,
  sectionIndex: number,          // ❌ Missing!
  sections: Section[],            // ❌ Missing!
  soundcloudPermalink: string,    // ❌ Missing!
  userAddress: string,            // ❌ Missing!
  songDuration: number,           // ❌ Missing!
  authContext: any
)
```

**Where to get missing data:**
- `sectionIndex` - Which segment? (default to 1, or process all?)
- `sections` - From match-and-segment result ✓
- `soundcloudPermalink` - From match-and-segment result ✓
- `userAddress` - From `pkpAddress` in AuthContext ✓
- `songDuration` - Calculate from `Math.max(...sections.map(s => s.endTime))` ✓

#### 2. Base Alignment Actor

**State machine expects:**
```typescript
executeBaseAlignment(geniusId, pkpAuthContext)
```

**Actual function signature:**
```typescript
executeBaseAlignment(
  geniusId: number,
  soundcloudPermalink: string,    // ❌ Missing!
  plainLyrics: string,            // ❌ Missing! (needs API call)
  authContext: any
)
```

**Where to get missing data:**
- `soundcloudPermalink` - From match-and-segment result ✓
- `plainLyrics` - **Requires separate LRClib API call** (see lines 211-236 in useKaraokeGeneration.ts)

#### 3. Translation Actor

**State machine expects:**
```typescript
executeTranslateLyrics(geniusId, targetLanguage, pkpAuthContext)
```

**Actual function:**
```typescript
executeTranslate(  // ❌ Wrong function name!
  geniusId: number,
  targetLanguage: string,
  authContext: any
)
```

**Fix needed:**
- Rename import: `executeTranslateLyrics` → `executeTranslate`
- Function signature is otherwise correct ✓

### Secondary Issues

#### 1. Match Result Not Stored in Context

The state machine stores `matchResult` in context but doesn't use it. The parallel processing actors need data from this result:
- `soundcloudPermalink` (for audio-processor and base-alignment)
- `sections` array (for audio-processor)

#### 2. Missing "runOnce" Logic

The existing code checks the contract BEFORE running alignment/translation to avoid duplicate work:

```typescript
// From useKaraokeGeneration.ts:197-206
const songData = await publicClient.readContract({
  address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
  abi: KARAOKE_CATALOG_ABI,
  functionName: 'getSongByGeniusId',
  args: [song.geniusId],
})

if (songData.metadataUri && songData.metadataUri !== '') {
  console.log('[KaraokeGen] Base alignment already exists:', songData.metadataUri)
  return true // Skip processing
}
```

The state machine doesn't have this optimization. It will re-run alignment/translation even if already done.

#### 3. No Progress Tracking

The state machine has `audioProgress`, `alignmentProgress`, `translationProgress` in context but never updates them. The Lit Actions run asynchronously via webhooks, so progress needs to be polled.

## 🔧 Required Fixes

### Fix 1: Update State Machine Context

Add fields needed by parallel processing:

```typescript
export interface UnlockContext {
  // ... existing fields ...

  // Match-and-segment result data (needed by parallel actors)
  soundcloudPermalink: string | null;
  sections: Array<{ type: string; startTime: number; endTime: number; duration: number }> | null;
  songDuration: number | null;
  plainLyrics: string | null; // Fetched from LRClib

  // User data (needed by audio-processor)
  pkpAddress: string | null;
}
```

### Fix 2: Update Match-and-Segment Success Handler

Store result data in context:

```typescript
onDone: [
  {
    guard: ({ event }) => event.output.success && event.output.isMatch,
    target: 'waitingForTx',
    actions: assign({
      matchResult: ({ event }) => event.output,
      txHash: ({ event }) => event.output.txHash || null,
      // NEW: Store data needed by parallel actors
      soundcloudPermalink: ({ event }) => event.output.genius?.soundcloudPermalink || null,
      sections: ({ event }) => event.output.sections || null,
      songDuration: ({ event }) =>
        event.output.sections
          ? Math.max(...event.output.sections.map(s => s.endTime))
          : null,
    }),
  },
  ...
]
```

### Fix 3: Add LRClib Fetch Actor

Before parallel processing, fetch plain lyrics:

```typescript
const fetchLyricsLogic = fromPromise<string, { geniusId: number; artist: string; title: string }>(
  async ({ input }) => {
    const resp = await fetch(
      'https://lrclib.net/api/search?' +
      new URLSearchParams({
        artist_name: input.artist,
        track_name: input.title
      })
    );

    const results = await resp.json();
    if (!results || results.length === 0) {
      throw new Error('No lyrics found');
    }

    const syncedLyrics = results[0].syncedLyrics;
    const lines = syncedLyrics.split('\n').filter((l: string) => l.trim());
    return lines
      .map((line: string) => {
        const match = line.match(/\[[\d:.]+\]\s*(.+)/);
        return match ? match[1] : '';
      })
      .filter((l: string) => l)
      .join('\n');
  }
);
```

Add state between `waitingForTx` and `processing`:

```
waitingForTx → fetchingLyrics → processing (parallel)
```

### Fix 4: Update Audio Processor Actor Input

```typescript
audioProcessor: fromPromise(async ({ input }) => {
  const { executeAudioProcessor } = await import('@/lib/lit/actions/audio-processor');

  return executeAudioProcessor(
    input.geniusId,
    1, // sectionIndex - default to first segment
    input.sections,
    input.soundcloudPermalink,
    input.pkpAddress,
    input.songDuration,
    input.pkpAuthContext
  );
}),
```

### Fix 5: Update Base Alignment Actor Input

```typescript
baseAlignment: fromPromise(async ({ input }) => {
  const { executeBaseAlignment } = await import('@/lib/lit/actions/base-alignment');

  return executeBaseAlignment(
    input.geniusId,
    input.soundcloudPermalink,
    input.plainLyrics,
    input.pkpAuthContext
  );
}),
```

### Fix 6: Fix Translation Import

```typescript
translation: fromPromise(async ({ input }) => {
  const { executeTranslate } = await import('@/lib/lit/actions/translate'); // Fixed name

  return executeTranslate(
    input.geniusId,
    input.targetLanguage,
    input.pkpAuthContext
  );
}),
```

### Fix 7: Add "runOnce" Checks (Optional Optimization)

Add pre-check actors before each parallel process:

```
processing:
  - audio: checkAudio → (skip|loading) → success
  - alignment: checkAlignment → (skip|loading) → success
  - translation: checkTranslation → (skip|loading) → success
```

Each check reads contract to see if already done.

## 📋 Integration Checklist

Before integrating into `KaraokeSongPage.tsx`:

- [ ] Update `unlockMachine.ts` context with additional fields
- [ ] Add `fetchLyricsLogic` actor and `fetchingLyrics` state
- [ ] Update parallel actor inputs to pass correct parameters
- [ ] Fix `executeTranslate` import name
- [ ] Pass `song` metadata (artist, title) to machine input for LRClib fetch
- [ ] Pass `pkpAddress` to machine input for audio-processor
- [ ] Update tests to match new signatures
- [ ] (Optional) Add contract pre-check actors for runOnce optimization

## 🎯 Recommended Approach

### Option A: Fix State Machine First (Recommended)
1. Update the state machine to match actual function signatures
2. Update tests to verify correct parameters
3. Then integrate into frontend

**Pros:**
- Ensures state machine is correct before integration
- Tests validate the full flow
- Easier to debug

**Cons:**
- More upfront work before seeing results

### Option B: Keep Current Wrapper Hook
1. Don't integrate XState machine yet
2. Keep using `useKaraokeGeneration` hook with manual state
3. Add XState only for credit flow + match-and-segment
4. Use existing hook for parallel processing

**Pros:**
- Faster integration
- Existing code is proven to work
- Can migrate to full XState gradually

**Cons:**
- Duplicate state management
- Doesn't get XState benefits for parallel processing

## 🚀 Next Steps

**My recommendation: Option A (Fix State Machine First)**

I can update the state machine now with the correct parameters. It will take about 15-20 minutes to:
1. Add missing context fields
2. Add LRClib fetch step
3. Update actor inputs
4. Update tests
5. Verify all tests still pass

Then it will be ready for clean integration into `KaraokeSongPage.tsx`.

**What do you want to do?**
