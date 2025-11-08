# Segment Selection Approaches

**Goal**: Select 40-100 second viral karaoke clips that capture the most engaging parts of songs.

## Current Approach: Simple/Deterministic ✅

**File**: `select-segments-simple.ts`
**Status**: Active (default in package.json)

### Algorithm

1. **Split normalized_lyrics** by double newlines (`\n\n`) to get natural sections
2. **Accumulate sections** from the beginning until reaching 40-100s duration
3. **Match text to karaoke_lines** to get precise timestamps
4. **Start at 0** if first lyrics begin within 15 seconds (includes intro)

### Why This Works

- **No AI subjectivity** - uses objective section breaks from lrclib
- **Consistent behavior** - always starts from beginning, accumulates naturally
- **Fast** - 1 second vs 10+ seconds for AI approaches
- **Captures iconic openings** - starts where the song actually begins

### Test Results

**Time is Running Out** by Muse (52 lines, 236.6s):
```
Sections found: 13
Section 1: 26.8s
Section 2: 41.6s
✓ Found segment in range at section 2
✓ Selected: 0.0s - 41.6s (41.6s)
✓ Completed (1.0s)
```

Result: Successfully captures iconic opening "I think I'm drowning" that AI approaches missed.

### Running

```bash
# Via package.json (recommended)
bun task:segment --limit=10

# Direct
bun src/tasks/audio/select-segments-simple.ts 10
```

---

## Alternative Approach: Structure-Based

**File**: `select-segments-structured.ts`
**Status**: Archived (not default)

### Algorithm

1. **AI labels song structure** (intro/verse/chorus/bridge/outro)
2. **Deterministically select** first verse + first chorus
3. **Validate** 40-100s duration

### Why This Was Abandoned

- **AI makes subjective mistakes** about what is "verse" vs "intro"
- **Slower** (10+ seconds for API call)
- **Inconsistent** - missed iconic opening on "Time is Running Out"

**Example failure**: Selected 17.0s - 73.5s, missing the iconic "I think I'm drowning" opening at 9.47s by labeling it as "intro" instead of "verse".

### Test Results

**Lose Yourself** by Eminem (115 lines, 326.5s):
```
Structure: intro → verse → chorus → chorus → verse → chorus → chorus → verse → chorus → chorus → outro
✓ Selected: 52.7s - 109.8s (57.1s)
✓ Completed (5.7s)
```

Result: Good on this song, but unreliable across catalog.

---

## Original Approach: AI "Most Viral"

**File**: `select-segments.ts`
**Status**: Archived (not default)

### Algorithm

1. **AI analyzes all lyrics** to identify "most viral" 40-100s segment
2. **Fully subjective** decision

### Why This Was Abandoned

- **Too subjective** - AI makes arbitrary decisions about "virality"
- **Inconsistent** across similar songs
- **Missed iconic openings** in favor of choruses

**Example failure**: Selected 23.2s - 69.5s for "Time is Running Out", completely missing the iconic opening.

---

## Summary

| Approach | Speed | Reliability | Captures Openings |
|----------|-------|-------------|-------------------|
| **Simple/Deterministic** ✅ | 1.0s | High | Yes |
| Structure-Based | 10.3s | Medium | Sometimes |
| AI "Most Viral" | 3.1s | Low | Rarely |

**Recommendation**: Use simple/deterministic approach (current default) for all production processing.
