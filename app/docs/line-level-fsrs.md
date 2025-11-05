# ✅ App Updates Complete - Line-Level FSRS Ready

**Date:** 2025-11-05  
**Status:** App code updated and backward compatible

---

## ✅ Changes Made

### 1. StudyCard Interface Updated ✓

**File:** `/app/src/hooks/useStudyCards.ts`

**Changes:**
```typescript
export interface StudyCard {
  id: string // lineId (UUID) or segmentHash (fallback)
  lineId?: string // NEW: UUID from karaoke_lines table
  lineIndex: number // NEW: Position within segment (0-based)
  segmentHash: string
  grc20WorkId: string
  spotifyTrackId: string
  // ... rest of fields
}
```

**Impact:**
- ✅ Adds line-level tracking support
- ✅ Backward compatible (lineId is optional)
- ✅ lineIndex defaults to 0 for segment-level cards

---

### 2. StudySessionPage Updated ✓

**File:** `/app/src/pages/StudySessionPage.tsx`

**Changes:**
```typescript
// OLD: Hardcoded to first line
exerciseText = translationData.lines[0].originalText

// NEW: Uses current card's lineIndex
const lineIndex = currentCard?.lineIndex ?? 0
exerciseText = translationData.lines[lineIndex].originalText
```

**Impact:**
- ✅ Now displays correct line based on card
- ✅ Supports line-level progression (when line cards are available)
- ✅ Falls back to line 0 for segment-level cards

---

## 🔄 Current Behavior (Segment-Level)

Since the subgraph doesn't have LineCard entities yet, the app uses the old segment-level architecture:

**What happens now:**
```
1. User visits /song/{workId}/study
2. useStudyCards queries segments (not lineCards)
3. Returns 1 card per song (segment-level)
4. Card has lineIndex = 0 (hardcoded)
5. StudySessionPage shows line 0
6. After practice: session complete (only 1 card)
```

**This is expected!** LineCards will be created when the first `LinePerformanceGraded` event is emitted.

---

## 🎯 Future Behavior (Line-Level)

When you update useStudyCards to query lineCards from the subgraph:

**What will happen:**
```
1. User visits /song/{workId}/study
2. useStudyCards queries lineCards (from subgraph)
3. Returns N cards per song (one per line)
4. Each card has unique lineId and lineIndex
5. StudySessionPage shows line 0, then line 1, then line 2, etc.
6. After 15 lines: "Daily limit reached!"
7. ✅ Proper line-level FSRS!
```

---

## ⏳ Missing Piece: LineCard Query

To enable line-level FSRS, you need to update useStudyCards to query `lineCards` instead of `segments`:

**Required change in `/app/src/hooks/useStudyCards.ts`:**

```typescript
// Add this new query
const GET_LINE_CARDS_WITH_PERFORMANCES = gql`
  query GetLineCardsWithPerformances($grc20WorkId: String!, $performer: String!) {
    lineCards(
      where: { segment_: { grc20WorkId: $grc20WorkId } }
      orderBy: lineIndex
      orderDirection: asc
    ) {
      id
      lineId
      lineIndex
      segmentHash
      segment {
        grc20WorkId
        spotifyTrackId
        metadataUri
        instrumentalUri
        alignmentUri
        segmentStartMs
        segmentEndMs
        translations {
          languageCode
          translationUri
        }
      }
      performances(where: { performer: $performer }, orderBy: gradedAt, orderDirection: desc) {
        id
        score
        gradedAt
      }
    }
  }
`

// Update the queryFn to use line cards
const data = await graphClient.request(GET_LINE_CARDS_WITH_PERFORMANCES, {
  grc20WorkId: songId,
  performer: pkpAddress.toLowerCase(),
})

// Map lineCards to StudyCards
const studyCards = data.lineCards.map((lineCard: any): StudyCard => ({
  id: lineCard.lineId,
  lineId: lineCard.lineId,
  lineIndex: lineCard.lineIndex,
  segmentHash: lineCard.segmentHash,
  grc20WorkId: lineCard.segment.grc20WorkId,
  spotifyTrackId: lineCard.segment.spotifyTrackId,
  metadataUri: lineCard.segment.metadataUri,
  instrumentalUri: lineCard.segment.instrumentalUri,
  alignmentUri: lineCard.segment.alignmentUri,
  segmentStartMs: lineCard.segment.segmentStartMs,
  segmentEndMs: lineCard.segment.segmentEndMs,
  translations: lineCard.segment.translations || [],
  fsrs: calculateFSRSState(lineCard.performances || []),
}))
```

**When to make this change:**
- After first LinePerformanceGraded event is emitted
- When lineCards query returns data from subgraph
- For now, keep segment-level to avoid breaking the app

---

## 🔑 Missing Piece: Lit Action Update

The Lit Action grader needs to call `gradeLinePerformance()` instead of `gradePerformance()`:

**Current:**
```javascript
const tx = await contract.gradePerformance(
  performanceId,
  segmentHash,
  performer,
  score,
  metadataUri
)
```

**Required:**
```javascript
const tx = await contract.gradeLinePerformance(
  performanceId,
  lineId,        // UUID from currentCard.lineId (need to pass this!)
  segmentHash,
  lineIndex,     // From currentCard.lineIndex (need to pass this!)
  performer,
  score,
  metadataUri
)
```

**Where to update:**
- Find the Lit Action grader file (likely in `/lit-actions/` or `/lit-actions-v2/`)
- Update to accept `lineId` and `lineIndex` parameters
- Update frontend `useLitActionGrader` to pass these values

---

## 🧪 Testing Steps

### 1. Test Current Segment-Level Flow

```bash
# Start the app
cd /media/t42/th42/Code/karaoke-school-v1/app
bun run dev

# Visit a song study page
# Open: http://localhost:5173/song/789efc77-40b5-4c13-b1c5-510419325977/study

# Expected behavior:
# - Shows 1 card (segment-level)
# - Displays line 0 text
# - After practice: "Study session complete!"
```

### 2. Check Console Logs

Look for:
```
[StudySession] Using originalText from translation line 0: <text>
```

This confirms lineIndex is being used (even though it's 0).

### 3. Test After Implementing LineCards

Once you:
1. Update useStudyCards to query lineCards
2. Update Lit Action to call gradeLinePerformance()
3. Practice one line

Then:
```bash
# Check if LineCard was created
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ lineCards(first: 5) { id lineId lineIndex } }"}' | jq '.'

# Expected: 1 LineCard entity
```

Visit the study page again:
```
# Expected behavior:
# - Shows multiple cards (line-level)
# - Displays line 0, line 1, line 2, etc.
# - After 15 lines: "Daily limit reached!"
```

---

## 📊 Summary

### What's Working Now ✓
- ✅ Database: 2,766 lines ready
- ✅ Contract: LinePerformanceGraded event deployed
- ✅ Subgraph: LineCard schema ready, indexing
- ✅ App: StudyCard interface supports lineId + lineIndex
- ✅ App: StudySessionPage uses lineIndex
- ✅ Backward compatible with segment-level cards

### What's Pending ⏳
- ⏳ useStudyCards: Switch to lineCards query (when data available)
- ⏳ Lit Action: Call gradeLinePerformance() instead of gradePerformance()
- ⏳ Frontend: Pass lineId + lineIndex to grader
- ⏳ Test: First LinePerformanceGraded event emission
- ⏳ Verify: LineCard entities created in subgraph

---

## 🚀 Next Steps

**Option 1: Test Current Flow (Recommended)**
1. Start the app: `bun run dev`
2. Visit a study page
3. Confirm segment-level flow works
4. Verify lineIndex=0 is being used correctly

**Option 2: Implement LineCard Query**
1. Update useStudyCards to query lineCards
2. Handle case when lineCards.length === 0 (fallback to segments)
3. Test with songs that have segments

**Option 3: Update Lit Action**
1. Find Lit Action grader file
2. Update to accept lineId + lineIndex
3. Call gradeLinePerformance() on contract
4. Test end-to-end flow

**Recommendation:** Test Option 1 first to ensure nothing broke, then implement Options 2 & 3.

---

## 📁 Files Changed

### Modified:
- `/app/src/hooks/useStudyCards.ts` - Added lineId + lineIndex to StudyCard
- `/app/src/pages/StudySessionPage.tsx` - Uses currentCard.lineIndex

### Ready but not deployed:
- `/subgraph/` - LineCard schema ready, waiting for events
- `/contracts/` - gradeLinePerformance() deployed

### Not modified yet:
- `/app/src/hooks/useLitActionGrader.ts` - Needs lineId + lineIndex params
- Lit Action grader - Needs to call gradeLinePerformance()

---

**Current Status:** App is backward compatible and ready for line-level FSRS. LineCards will be created when first LinePerformanceGraded event is emitted.
