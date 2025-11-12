# Subgraph Emission Blocker - RATM Track Analysis

**Date**: 2025-11-12
**Track**: Rage Against the Machine - "Killing in the Name"
**Issue**: Track not indexed in subgraph despite encryption completion
**Root Cause**: Missing GRC-20 work entity
**Status**: ❌ BLOCKED - Actionable fix identified

---

## The Issue

You asked: **"have you emitted to the subgraph?"**

**Answer**: NO. The track is NOT in the subgraph.

Subgraph query:
```graphql
query {
  clips(where: { spotifyTrackId: "59WN2psjkt1tyaxjspN8fp" }) {
    id
    spotifyTrackId
    encryptedFullUri
  }
}
```

**Result**: `{ "data": { "clips": [] } }`

---

## Root Cause: Missing GRC-20 Work Entity

The pipeline has **three separate event emission stages**:

```
Stage 1: ClipRegistered    ← Creates Clip entity in subgraph
Stage 2: ClipProcessed     ← Updates Clip with instrumental/alignments
Stage 3: SongEncrypted     ← Updates Clip with encryption metadata
```

All three are emitted by the `emit-clip-events.ts` task, which has this prerequisite check (line 86 in emit-clip-events.ts):

```sql
JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
WHERE ...
  AND gw.grc20_entity_id IS NOT NULL
```

**RATM Track Status**:
```sql
SELECT * FROM grc20_works WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
-- Result: (empty)
```

**Because**: The GRC-20 population task was never run.

---

## Pipeline State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ RATM Track: 59WN2psjkt1tyaxjspN8fp                          │
└─────────────────────────────────────────────────────────────┘

AUDIO PIPELINE (✅ COMPLETE)
  pending
    ↓ (download)
  downloaded ✅
    ↓ (align)
  aligned ✅
    ↓ (translate)
  translated ✅
    ↓ (separate)
  separated ✅
    ↓ (segment)
  segmented ✅
    ↓ (enhance)
  enhanced ✅
    ↓ (encrypt)
  [ENCRYPTED] ✅ karaoke_segments fully populated with encryption_accs
    │
    └─────→ ❌ BLOCKER: GRC-20 ENTITY MISSING
            │
            └─ Cannot run: emit-clip-events
                │
                └─ Cannot emit: ClipRegistered event
                    │
                    └─ Cannot index: Clip entity in subgraph
                        │
                        └─ Result: Subgraph returns empty []
```

---

## Why This Matters

### What Should Happen (Full Pipeline)
```
Audio Complete → GRC-20 Populate → Emit Clip Events → Subgraph Indexes
                  ↓
                (creates grc20_works row with grc20_entity_id)
                  ↓
                (emit-clip-events finds track via JOIN)
                  ↓
                (emits ClipRegistered + ClipProcessed + SongEncrypted)
                  ↓
                (subgraph handlers index Clip entity with encryption data)
                  ↓
                APP SEES: Clip with encryptedFullUri + encryptedManifestUri
```

### What Actually Happened (RATM)
```
Audio Complete → [GRC-20 SKIPPED] → Emit Clip Events [FAILS SILENTLY]
                                      ↓
                                    (query finds 0 rows - no grc20_works)
                                      ↓
                                    (never executes, no ClipRegistered)
                                      ↓
                                    (never emitted to contract)
                                      ↓
                                    (subgraph has nothing to index)
                                      ↓
                                    APP SEES: Empty subgraph []
```

---

## The Missing Step: GRC-20 Population

This task creates the `grc20_works` row:

```bash
bun src/tasks/grc20/populate-grc20.ts --artist=ARTIST_ID
```

**What It Does** (from populate-grc20.ts lines 1-9):
```
1. Refresh source facts (artist & work staging tables)
2. Resolve definitive values using SQL helpers
3. Upsert rows into grc20_artists / grc20_works with provenance
4. Log discrepancies surfaced during resolution
```

**What Gets Created**:
```sql
INSERT INTO grc20_works (
  spotify_track_id,
  grc20_entity_id,
  primary_title,
  primary_artist_id,
  primary_artist_name,
  ...
)
```

**For RATM**:
```bash
# Identify artist ID
SELECT primary_artist_id FROM tracks WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
-- Result: 6L6HGZhfScNpWu

# Run GRC-20 population
bun src/tasks/grc20/populate-grc20.ts --artist=6L6HGZhfScNpWu

# Verify creation
SELECT grc20_entity_id FROM grc20_works WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';
-- Result: (should now return entity ID, e.g., "grc20_work_123")
```

---

## Complete Missing Pipeline Segment

The manual Spotify ingestion documentation omitted a critical step. The **FULL** pipeline should be:

### Phases 1-5: ✅ Already Documented
- Phase 1: Ingestion
- Phase 2: Lyrics & Translation
- Phase 3: Audio Processing (download, align, translate, separate, segment, enhance)
- Phase 4: Artist Identity (PKP, Lens, Unlock)
- Phase 5: Encryption

### Phase 6: ❌ MISSING FROM RATM - GRC-20 Population

```bash
# Before emit-clip-events can run, must create GRC-20 entities
bun src/tasks/grc20/populate-grc20.ts --artist=ARTIST_ID
```

This creates:
- ✅ `grc20_artists` row (if artist not yet minted)
- ✅ `grc20_works` row linking track to artist
- ✅ Resolves metadata (ISWC, ISNI, Wikidata references)

### Phase 7: ❌ MISSING FROM RATM - Emit to Contracts

```bash
# After GRC-20 population, emit clip events to blockchain
bun src/tasks/content/emit-clip-events.ts --limit=1
```

This emits:
- `ClipRegistered` - Creates Clip entity in subgraph
- `ClipProcessed` - Updates with instrumental/alignment URIs
- `SongEncrypted` - Updates with encryption URIs (if run during encryption)

### Phase 8: ✅ Automatic - Subgraph Indexing

Once events are emitted, subgraph handlers automatically index:
- Clip entity with all metadata
- Translation entities for each language
- Exercise cards for FSRS spaced repetition

---

## Fix for RATM Track

### Step 1: Get Artist ID
```bash
psql $NEON_DATABASE_URL -c "
  SELECT primary_artist_id
  FROM tracks
  WHERE spotify_track_id = '59WN2psjkt1tyaxjspN8fp';"
# Result: 6L6HGZhfScNpWu
```

### Step 2: Populate GRC-20
```bash
bun src/tasks/grc20/populate-grc20.ts --artist=6L6HGZhfScNpWu
```

### Step 3: Emit Clip Events
```bash
export PRIVATE_KEY=0x...
bun src/tasks/content/emit-clip-events.ts --limit=1
```

**Expected Output**:
```
📋 Clip Event Emission
   Found 1 clip to emit
   🎵 RATM - Killing in the Name
   ⏳ Emitting ClipRegistered...
   📝 TX: 0xAbCd...
   ✅ Confirmed in block 12345678
   ⏳ Emitting ClipProcessed...
   📝 TX: 0xDef0...
   ✅ Confirmed in block 12345679
   ⏳ Emitting SongEncrypted...
   📝 TX: 0x1234...
   ✅ Confirmed in block 12345680
```

### Step 4: Verify Subgraph
```bash
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "{ clips(where: { spotifyTrackId: \"59WN2psjkt1tyaxjspN8fp\" }) { id clipHash spotifyTrackId encryptedFullUri } }"
  }'
```

**Expected Result**:
```json
{
  "data": {
    "clips": [
      {
        "id": "0xabcd...",
        "clipHash": "0xabcd...",
        "spotifyTrackId": "59WN2psjkt1tyaxjspN8fp",
        "encryptedFullUri": "https://api.grove.storage/ef9a4d5c..."
      }
    ]
  }
}
```

---

## Updated Complete Pipeline for Manual Spotify Songs

```bash
# Phase 1: Ingestion
bun src/tasks/ingestion/add-track-from-spotify.ts --spotifyId=SPOTIFY_ID

# Phase 2-3: Audio Processing
bun src/scripts/manual-track-pipeline.ts --spotifyId=SPOTIFY_ID

# Phase 4: Artist Identity (once per artist)
export PRIVATE_KEY=0x...
bun src/tasks/identity/mint-pkps.ts --type=artist --limit=1
bun src/tasks/identity/create-lens-accounts.ts --type=artist --limit=1
bun src/tasks/identity/deploy-unlock-lock.ts --artist=ARTIST_ID

# Phase 5: Encryption (when enhance completes)
bun src/tasks/audio/encrypt-clips.ts --limit=1

# ⭐ Phase 6: GRC-20 POPULATION (NEW - WAS MISSING)
bun src/tasks/grc20/populate-grc20.ts --artist=ARTIST_ID

# ⭐ Phase 7: EMIT TO CONTRACTS (NEW - WAS MISSING)
export PRIVATE_KEY=0x...
bun src/tasks/content/emit-clip-events.ts --limit=1

# Phase 8: Verify Subgraph (automatic after events)
curl -s http://localhost:8000/subgraphs/name/subgraph-0 -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"query\": \"{ clips(where: { spotifyTrackId: \\\"$SPOTIFY_ID\\\" }) { id spotifyTrackId encryptedFullUri } }\"}"
```

---

## Why This Was Missed

The documentation (manual-spotify-ingestion.md) correctly listed all phases **conceptually** but:

1. ❌ **Phases 6-7 were incomplete** - GRC-20 population and event emission not explicitly commanded
2. ❌ **RATM execution skipped these steps entirely** - Went straight from encryption to trying to verify
3. ❌ **No validation check** - Should have caught missing grc20_works before claiming success

---

## Architecture Lesson

The subgraph emission is **NOT a separate optional step** - it's a **critical pipeline stage** that must occur BEFORE the content appears in the app.

Pipeline Dependency Chain:
```
Encryption ✅
    ↓
GRC-20 Population (CREATES ENTITY ID)
    ↓
Emit Clip Events (EMITS BLOCKHAIN EVENTS)
    ↓
Subgraph Index (CREATES CLIP IN QUERYABLE INDEX)
    ↓
APP QUERY (RETURNS DATA TO USERS)
```

Breaking ANY link in this chain prevents the entire downstream flow from working.

---

## Verification Checklist Before Claiming "Complete"

- [ ] Track has `tracks.stage = 'enhanced'` or higher
- [ ] Track has `karaoke_segments.encrypted_full_cid` populated
- [ ] Track has `grc20_works` row with `grc20_entity_id IS NOT NULL`
- [ ] `emit-clip-events` task finds track in its query (JOIN grc20_works succeeds)
- [ ] ClipRegistered event emitted to ClipEvents contract
- [ ] Subgraph query returns non-empty Clip entity
- [ ] Clip entity has `encryptedFullUri` and `encryptedManifestUri` populated

---

## Summary

| Step | RATM Status | Blocker |
|------|------------|---------|
| Audio Processing | ✅ Complete | None |
| Encryption | ✅ Complete | None |
| **GRC-20 Population** | ❌ Skipped | **YES** ← This blocks everything |
| **Emit to Contracts** | ❌ Skipped | Consequence of above |
| **Subgraph Indexing** | ❌ Empty | Consequence of above |

**The Fix**: Run GRC-20 population + emit-clip-events, then subgraph will automatically index.

**Time to Complete**: ~2 minutes for both commands + verification.
