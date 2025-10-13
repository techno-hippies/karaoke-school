# Testing Option A (Public Good Model)

## Current Unlock Button Logic
```typescript
// From SongPage.tsx:115
const showUnlockButton = !isFree && (segments.length === 0 || segments.some(seg => !seg.isOwned))
```

## Test Scenarios

### Scenario 1: Free Song, Unprocessed
- `isFree: true`
- `segments: []` (no segments)
- **Unlock button shows?** `!true && true` = **FALSE** ❌
- **Expected:** TRUE (someone needs to trigger processing!)
- **ISSUE**: Free songs can never be processed!

### Scenario 2: Free Song, Processed
- `isFree: true`
- `segments: [...]` (has segments)
- **Unlock button shows?** `!true && false` = **FALSE** ✓
- **Expected:** FALSE (correct - free for everyone)

### Scenario 3: Paid Song, Unprocessed (First User)
- `isFree: false`
- `segments: []`
- **Unlock button shows?** `!false && true` = **TRUE** ✓
- **Expected:** TRUE (correct - first user pays to unlock)

### Scenario 4: Paid Song, Processed (Subsequent Users)
- `isFree: false`
- `segments: [...]` (has segments)
- **Unlock button shows?** `!false && segments.some(...)` = depends on ownership
- For Option A (Public Good): Should be **FALSE** (free once processed)
- Current logic checks ownership, which enables per-segment purchases

## Issue Found

**Free songs (`isFree: true`) can never be unlocked!**

The unlock button logic assumes all free songs are already processed. But someone needs to trigger the FIRST unlock to run match-and-segment.

## Proposed Fix

```typescript
// Option A (Public Good Model)
const showUnlockButton =
  segments.length === 0 ||  // Always show for unprocessed songs
  (!isFree && segments.some(seg => !seg.isOwned)) // Show for paid songs with unowned segments

// Breakdown:
// - Unprocessed song (free or paid): TRUE (someone must unlock it first)
// - Processed free song: FALSE (free for all)
// - Processed paid song: FALSE for Option A (free once unlocked by first user)
```

## Testing Steps

### Test 1: Unlock a Free Unprocessed Song
1. Find a free song (`isFree: true`) not in contract
2. **Current behavior:** No unlock button shows
3. **Expected:** Unlock button shows, first user can process for free
4. Trigger: `unlockFlow.start()` → should skip credit check

### Test 2: View a Free Processed Song
1. Find a free song with segments in contract
2. **Current behavior:** No unlock button
3. **Expected:** No unlock button (correct)
4. Segments are visible and playable

### Test 3: Unlock a Paid Unprocessed Song
1. Find paid song (`isFree: false`) not in contract
2. **Current behavior:** Unlock button shows if no credits
3. **Expected:** CreditFlowDialog → purchase → unlock → process
4. After: Song has segments, next user can access for free

### Test 4: View a Paid Processed Song
1. Find paid song with segments in contract
2. For Option A: No unlock button should show
3. **Current behavior:** Unlock button shows if segments have `isOwned: false`
4. **Issue:** This enables per-segment purchases (Option B behavior)

## Recommendation

Update `SongPage.tsx:115` to:
```typescript
const showUnlockButton = segments.length === 0
```

This means:
- ✅ Unprocessed songs (free or paid) → show unlock button
- ✅ Processed songs (free or paid) → hide unlock button (public good)
- ✅ State machine handles credit gating (`isFree` check)
- ✅ Option A: First user unlocks, everyone benefits

Then in the state machine, the `isFree` guard ensures:
- Free songs skip credit check
- Paid songs require credits for first unlock
- After processing, segments exist, button disappears
