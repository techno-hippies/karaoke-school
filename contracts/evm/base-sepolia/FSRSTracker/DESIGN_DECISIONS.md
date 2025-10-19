# FSRSTrackerV1 Design Decisions & Trade-Offs

## Optimizations Implemented

### ✅ 1. Split Mastery Functions
**Problem**: Original `isSongMastered()` looped through all lines (1k+ lines = 5M gas)

**Solution**: Split into two functions:
- `isSongMastered()`: Fast check (uses segment stats, ~300k gas)
  - Returns: `fullyStudied`, `segmentsCompleted`, `totalSegments`
  - Use for: Quick badges, "started all segments" check

- `getSongCompletionRate()`: Precise line-by-line count (expensive, 1-5M gas)
  - Returns: `studiedLines`, `totalLines`, `completionRate`
  - Use for: Detailed progress bars, "85% mastered" displays
  - Warning: May hit RPC limits on huge songs

**Gas Comparison**:
```
Song with 15 segments, 100 total lines:
- isSongMastered():       ~300k gas (cheap, always use)
- getSongCompletionRate():  ~2M gas (only when needed)
```

### ✅ 2. Separate "Due" vs "Review" Queries
**Problem**: Users wanted distinction between "new cards to learn" and "reviews due"

**Solution**: Two functions:
- `getDueSongSegments()`: Returns segments with new cards OR overdue reviews
  - Use for: "Practice this song" button (includes everything)

- `getDueReviewSegments()`: Returns ONLY segments with overdue reviews (no new)
  - Use for: "Finish your reviews" (strict Duolingo-style)

**Example**:
```typescript
// Duolingo-style: Show "15 new + 23 reviews"
const dueSegments = await contract.getDueSongSegments(...);     // All study-able
const reviewSegments = await contract.getDueReviewSegments(...); // Only reviews
const newSegments = dueSegments.length - reviewSegments.length;  // Difference = new
```

### ✅ 3. Batch Updates
**Already Implemented**: `updateCardsBatch()` function
- Batch up to 20 lines in one transaction
- Saves ~30% gas vs individual updates
- Use case: User completes 5-line segment → batch update at end

---

## Open Design Questions

### ⚖️ Question 1: On-Chain Streak Tracking?

**Current**: Streaks tracked off-chain (Grove) via event indexing

**Proposal**: Add on-chain `lastStudiedDay` per user/song

**Implementation**:
```solidity
// Add to state
mapping(address => mapping(string => uint40)) public userSongLastStudiedDay;

// Update in updateCard()
function updateCard(...) external {
    // ... existing logic

    uint40 today = uint40(block.timestamp / 1 days);
    userSongLastStudiedDay[user][songId] = today;

    emit CardReviewed(..., today); // Add to event
}

// New query
function getSongStreak(address user, string songId) external view returns (uint16 streak) {
    uint40 today = uint40(block.timestamp / 1 days);
    uint40 lastDay = userSongLastStudiedDay[user][songId];

    // Naive streak calc (better done off-chain with full history)
    if (today - lastDay <= 1) {
        return 1; // Active within last 2 days
    }
    return 0; // Streak broken (need event history for real streak)
}
```

**Trade-Offs**:

| Aspect | On-Chain | Off-Chain (Current) |
|--------|----------|---------------------|
| **Gas Cost** | +5k per update (~+10%) | Free (events) |
| **Trust** | Trustless, verifiable | Requires event indexing |
| **Accuracy** | Limited (needs full history for real streak) | Perfect (has all dates) |
| **Complexity** | Simple storage | Requires indexer/Grove |
| **Query Speed** | Instant (RPC) | Fast (Grove cache) |

**Recommendation**:
- ❌ **Don't add to contract** - streaks need full history (all study dates)
- ✅ **Use events + Grove** - already have `CardReviewed(timestamp)` event
- ✅ **On-chain only needs** last study date for "active today" checks (optional)

**Minimal Addition (if wanted)**:
```solidity
mapping(address => mapping(string => uint40)) public lastSongStudy;
// Updated in updateCard, costs +5k gas, enables "studied today" badge
```

---

### ⚖️ Question 2: Add `geniusId` to Events?

**Current Event**:
```solidity
event CardReviewed(
    address indexed user,
    string indexed songId,        // "heat-of-the-night-scarlett-x"
    string segmentId,
    uint8 lineIndex,
    uint8 rating,
    uint8 score,
    uint40 nextDue,
    uint8 newState,
    uint64 timestamp
);
```

**Proposed**: Add `geniusId` for cross-referencing with KaraokeCatalog

```solidity
event CardReviewed(
    address indexed user,
    string indexed songId,
    uint32 indexed geniusId,      // NEW: Index by Genius ID
    string segmentId,
    uint8 lineIndex,
    uint8 rating,
    uint8 score,
    uint40 nextDue,
    uint8 newState,
    uint64 timestamp
);
```

**Trade-Offs**:

| Aspect | With geniusId | Without |
|--------|--------------|---------|
| **Gas Cost** | +800 gas per event (~2%) | Current |
| **Indexing** | Can filter by geniusId directly | Must join with KaraokeCatalog |
| **Artist Queries** | "All reviews for artist X" (via geniusId → artistId) | Need songId → geniusId lookup |
| **Event Size** | 32 bytes larger | Smaller |
| **Complexity** | Lit Action needs to fetch geniusId | Simpler |

**Use Cases Enabled**:
```sql
-- Artist-level leaderboards (requires geniusId)
SELECT user, COUNT(*) FROM CardReviewed
WHERE geniusId IN (SELECT geniusId FROM KaraokeCatalog WHERE geniusArtistId = 12345)
GROUP BY user;

-- Without geniusId, need join:
SELECT user, COUNT(*) FROM CardReviewed cr
JOIN KaraokeCatalog kc ON cr.songId = kc.id
WHERE kc.geniusArtistId = 12345;
```

**Recommendation**:
- ✅ **ADD `geniusId`** if you need artist-level analytics (e.g., "Top Scarlett X fans")
- ❌ **Skip** if only song-level matters (songId is enough)
- **Implementation**: Lit Action fetches `geniusId` from KaraokeCatalog before calling `updateCard`

**Cost**: +800 gas per review (~$0.0000008 on Base) = **negligible**

---

### ⚖️ Question 3: Batch Updates Across Segments?

**Current**: `updateCardsBatch()` only for same segment

**Proposal**: Allow batch across different segments?

```solidity
struct MultiSegmentUpdate {
    string segmentId;
    uint8 lineIndex;
    uint8 rating;
    uint8 score;
    Card newCard;
}

function updateCardsMultiSegment(
    address user,
    string calldata songId,
    MultiSegmentUpdate[] calldata updates
) external onlyTrustedPKP whenNotPaused {
    // ... validate and update
}
```

**Use Case**: User studies 3 different segments in one session

**Trade-Off**: Complexity vs savings (~10% gas vs 3 separate calls)

**Recommendation**: ❌ **Not worth it** - segments are natural boundaries, rare to study 3+ in one go

---

## Final Recommendations

### Implement Now:
1. ✅ Split mastery functions (done)
2. ✅ Separate due/review queries (done)
3. ✅ Batch updates within segment (done)
4. ✅ Add `geniusId` to events (+800 gas, enables artist analytics)

### Skip:
1. ❌ On-chain streak tracking (use events + Grove)
2. ❌ Multi-segment batch updates (not needed)

### Optional (Discuss):
1. ⚠️ `lastSongStudy` mapping (+5k gas/update) - only if need "active today" check on-chain
2. ⚠️ `geniusId` in events - depends on artist-level analytics priority

---

## Gas Summary (Base Sepolia)

```
Current costs (without additions):
- updateCard():          50k gas  (~$0.00005)
- updateCardsBatch(5):   200k gas (~$0.0002)
- getSongStats():        300k gas (FREE - view)
- isSongMastered():      300k gas (FREE - view)
- getDueSongSegments():  300k gas (FREE - view)

With geniusId event:
- updateCard():          51k gas  (+2%, negligible)

With lastSongStudy:
- updateCard():          55k gas  (+10%, still cheap)
```

**Conclusion**: All additions are affordable on Base. Choose based on features, not cost.
