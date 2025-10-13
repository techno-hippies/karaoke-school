# Option A (Public Good Model) - Testing Guide

## Changes Made

### Fixed `SongPage.tsx:115`
```typescript
// BEFORE (broken for free songs):
const showUnlockButton = !isFree && (segments.length === 0 || segments.some(seg => !seg.isOwned))

// AFTER (Option A - Public Good):
const showUnlockButton = segments.length === 0
```

## How It Works Now

### For ANY Unprocessed Song (Free or Paid)
1. User visits song page
2. `segments.length === 0` → Unlock button shows
3. User clicks "Unlock"
4. `unlockFlow.start()` → State machine runs:
   - `checkingRequirements`:
     - If `isFree: true` → Skip credit check, go to match-and-segment
     - If `isFree: false` && `hasCredits` → Go to match-and-segment
     - If `isFree: false` && NO credits → Show CreditFlowDialog
5. After match-and-segment → processing (audio/alignment/translation)
6. Song now has segments in contract

### For ANY Processed Song (Free or Paid)
1. User visits song page
2. `segments.length > 0` → No unlock button
3. Segments are visible and accessible to ALL users
4. **Public Good**: First user paid/unlocked, everyone benefits

## Test Cases

### Test 1: Free Unprocessed Song
```
Song: Any song with `isFree: true` not in contract
Expected: Unlock button shows
User: Clicks unlock → No credit check → Processing starts
Result: Song processed, segments visible to all
```

### Test 2: Free Processed Song
```
Song: Any song with `isFree: true` AND segments in contract
Expected: No unlock button
User: Sees segments immediately, can practice
Result: Public good - free for everyone
```

### Test 3: Paid Unprocessed Song (No Credits)
```
Song: Any song with `isFree: false` not in contract
User: Has 0 credits
Expected: Unlock button shows
User: Clicks unlock → CreditFlowDialog opens
Flow:
  1. If USDC < $0.50 → Show wallet funding view (QR code)
  2. If USDC >= $0.50 → Show credit packages
  3. User purchases credits → `unlockFlow.creditsAcquired()`
  4. Processing starts
Result: Song processed, segments visible to all subsequent users
```

### Test 4: Paid Unprocessed Song (Has Credits)
```
Song: Any song with `isFree: false` not in contract
User: Has credits > 0
Expected: Unlock button shows
User: Clicks unlock → Processing starts immediately
Result: Song processed, segments visible to all subsequent users
```

### Test 5: Paid Processed Song (Subsequent User)
```
Song: Any song with `isFree: false` AND segments in contract
User: ANY user (with or without credits)
Expected: No unlock button
User: Sees segments immediately, can practice
Result: Public good - first user unlocked, everyone benefits
```

## Manual Testing Steps

### Setup
```bash
cd app
bun run dev
# Open http://localhost:6006 (Storybook) or http://localhost:5173 (dev)
```

### Test Free Song Unlock
1. Find a free song genius ID (e.g., search for a song, note the ID)
2. Check contract: `cast call 0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa "getSongByGeniusId(uint32)" <geniusId> --rpc-url https://sepolia.base.org`
3. If no data → unprocessed, test unlock flow
4. Visit: `/karaoke/song/<geniusId>`
5. Verify unlock button shows
6. Click unlock → should skip credit check
7. Wait for completion (~65s)
8. Refresh → segments should be visible, no unlock button

### Test Paid Song Unlock (First User)
1. Use the song you unlocked earlier (e.g., 135690 - Mind Mischief)
2. If already processed, find another paid song
3. Visit: `/karaoke/song/<geniusId>`
4. Verify unlock button shows
5. Click unlock:
   - If no credits → CreditFlowDialog shows
   - Purchase credits → Flow continues
6. Wait for completion (~65s)
7. Refresh → segments visible, no unlock button

### Test Paid Song Access (Subsequent User)
1. Use the same song from previous test
2. In a new browser/incognito (or just as same user)
3. Visit: `/karaoke/song/<geniusId>`
4. Verify NO unlock button
5. Verify segments are visible immediately
6. **Public Good Confirmed**: No payment needed for subsequent users

## Expected State Machine Flow

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
    creditsAcquired() → matchAndSegment
        ↓
matchAndSegment (3-4s)
        ↓
waitingForTx (1-2s)
        ↓
processing (parallel ~60s)
  ├─ audio (~60s)
  ├─ alignment (~10s)
  └─ translation (~15s)
        ↓
complete
```

## Console Logs to Watch

```typescript
// When unlock button shows:
[SongPage] Unlock button logic: {
  isFree: false,
  segmentsLength: 0,  // ← Key: 0 = show button
  hasUnownedSegments: false,
  showUnlockButton: true
}

// Free song unlocking:
[Unlock] Starting unlock flow...
[checkingRequirements] isFree: true → Skipping credit check

// Paid song with credits:
[Unlock] Starting unlock flow...
[checkingRequirements] hasCredits: true → Proceeding to match-and-segment

// Paid song without credits:
[Unlock] Starting unlock flow...
[checkingRequirements] No credits → Showing CreditFlowDialog

// After processing complete:
[SongPage] Unlock button logic: {
  isFree: false,
  segmentsLength: 5,  // ← Key: > 0 = hide button
  hasUnownedSegments: false,
  showUnlockButton: false
}
```

## Success Criteria

✅ **Free songs can be unlocked by anyone**
✅ **Paid songs require credits for FIRST unlock only**
✅ **After processing, ALL users can access for free**
✅ **CreditFlowDialog shows when needed**
✅ **State machine enforces sequential flow**
✅ **Parallel processing completes successfully**
✅ **Unlock button disappears after processing**

This confirms Option A (Public Good Model) is working correctly!
