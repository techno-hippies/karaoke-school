# Complete Pipeline Analysis & E2E Testing Plan

**Date**: 2025-10-12
**Status**: Pipeline Partially Implemented - Missing Integration

---

## 🔍 Current State Analysis

### ✅ **What Works**

1. **match-and-segment-v5.js** (Lit Action 1)
   - ✅ Fetches Genius metadata
   - ✅ Fetches LRClib synced lyrics (gets **full song duration**: `lrcMatch.duration`)
   - ✅ AI matching + segmentation (identifies 5 best segments)
   - ✅ AI translations (Simplified Chinese + Vietnamese)
   - ✅ ElevenLabs forced alignment (word-level timing)
   - ✅ Uploads alignment to Grove
   - ✅ Writes song metadata to KaraokeCatalogV1 via `addFullSong()`
   - ✅ Returns: `{sections, alignment, txHash}`

2. **Demucs Modal API** (`demucs-modal/demucs_api.py`)
   - ✅ `/process-song-async` endpoint ready
   - ✅ Accepts `full_duration` + `segments[]`
   - ✅ Processes up to 190s (trims longer songs)
   - ✅ Demucs mdx_extra separation (full song)
   - ✅ fal.ai enhancement ($0.20 once, not per segment)
   - ✅ FFmpeg segment extraction
   - ✅ Grove upload (all segments)
   - ✅ Calls webhook with ALL segment URIs

3. **Webhook Server** (`webhook-server/server.mjs`)
   - ✅ `/webhook/song-complete` endpoint
   - ✅ Receives segments from Demucs
   - ✅ Triggers Lit Action 2

4. **update-karaoke-contract-batch.js** (Lit Action 2)
   - ✅ Receives ALL segments from webhook
   - ✅ Validates Grove URIs
   - ✅ Calls `processSegmentsBatch()` in single transaction
   - ✅ PKP signs + broadcasts

5. **KaraokeCatalogV2 Contract**
   - ✅ Deployed: `0x40ca9B95AF2d439b37F4019659269574203b34B7`
   - ✅ `processSegmentsBatch()` function (V2 optimization)
   - ✅ Trusted processor: `0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30` (fixed)

---

### ❌ **What's Broken/Missing**

1. **audio-processor-v3.js** (Lit Action - Audio Processing)
   - ❌ Calls **OLD** Spleeter API (segment-based, not song-based)
   - ❌ URL: `techno-hippies--spleeter-karaoke-fastapi-app.modal.run`
   - ❌ Passes `start_time` + `duration` (ONE segment at a time)
   - ❌ Does NOT update contract (only reads segment hash)
   - ❌ Returns Grove URIs but frontend has to do something with them?

2. **No Segments Created in Contract**
   - ❌ `match-and-segment-v5.js` only writes song metadata (`addFullSong`)
   - ❌ Does NOT call `createSegmentsBatch()` to create segment placeholders
   - ❌ Contract has no segment records when audio processing starts

3. **Missing Integration**
   - ❌ Nothing calls Demucs `/process-song-async` endpoint
   - ❌ New song-based pipeline (Demucs → webhook → batch update) not wired up
   - ❌ Frontend still uses segment-based flow (one at a time)

4. **Architecture Mismatch**
   - 🔀 Old flow: User selects 1 segment → process that segment → repeat
   - 🔀 New flow: Process ALL segments at once (song-based optimization)
   - ❌ Frontend UX expects segment-by-segment, but Demucs is song-based

---

## 🎯 The Complete Flow We Need

### **Phase 1: Song Setup** (match-and-segment-v5.js)
```
User selects song (Genius ID)
    ↓
1. Lit Action 1 runs (match-and-segment-v5.js)
    - Fetch Genius + LRClib (get full_duration)
    - AI segmentation (identify 5 segments)
    - ElevenLabs alignment
    - Write song metadata to contract (addFullSong)
    - 🆕 CREATE SEGMENT PLACEHOLDERS (createSegmentsBatch)
    ↓
2. Return to frontend:
    - sections[] (5 segments with timestamps)
    - alignment URI (Grove)
    - full_duration (e.g., 246s)
    - soundcloudPermalink
```

### **Phase 2: Audio Processing** (NEW - Song-Based)
```
Frontend or Lit Action calls Demucs API
    ↓
3. POST /process-song-async
    - genius_id: 378195
    - audio_url: https://sc.maid.zone/_/restream/...
    - full_duration: 246  ← FULL SONG, NOT SEGMENT
    - segments_json: [{id, startTime, endTime}, ...] ← ALL 5 SEGMENTS
    - webhook_url: https://karaoke-webhook-server.onrender.com/webhook/song-complete
    ↓
4. Demucs spawns async job, returns immediately:
    - {job_id: "song-123", status: "processing"}
    ↓
5. Background processing (79s):
    - Download full audio
    - Trim to 190s (if needed)
    - Demucs separation (mdx_extra)
    - fal.ai enhancement ($0.20 once)
    - FFmpeg extract 5 segments
    - Grove upload all segments
    ↓
6. Demucs calls webhook:
    POST /webhook/song-complete
    {
      job_id: "song-123",
      genius_id: 378195,
      segments: [
        {segmentId: "chorus-1", vocalsUri: "lens://...", instrumentalUri: "lens://..."},
        {segmentId: "verse-1", vocalsUri: "lens://...", instrumentalUri: "lens://..."},
        ...all 5 segments
      ]
    }
```

### **Phase 3: Contract Update** (Webhook → Lit Action 2)
```
Webhook receives segment URIs
    ↓
7. Webhook triggers Lit Action 2 (update-karaoke-contract-batch.js)
    - Validates Grove URIs (all lens://)
    - Builds batch transaction (processSegmentsBatch)
    - PKP signs transaction
    - Broadcasts single transaction
    ↓
8. Contract updated (KaraokeCatalogV2)
    - processSegmentsBatch(segmentHashes[], vocalsUris[], drumsUris[], audioSnippetUris[])
    - All 5 segments marked as processed
    - Single transaction, single gas fee
    ↓
9. User can now practice ANY segment
```

---

## 🧪 E2E Testing Plan

### **Test 1: Full Pipeline (Recommended)**

Create: `lit-actions/src/test/test-full-pipeline-e2e.mjs`

```javascript
/**
 * Complete E2E Test: Song Selection → Audio Processing → Contract Update
 *
 * Tests the full song-based karaoke pipeline:
 * 1. match-and-segment-v5 (song metadata + alignment)
 * 2. Create segment placeholders in contract
 * 3. Trigger Demucs /process-song-async (all segments)
 * 4. Monitor job completion
 * 5. Verify webhook called Lit Action 2
 * 6. Verify contract updated with all segments
 *
 * Expected time: ~2 minutes (31s Lit Action + 79s Demucs + 10s contract update)
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { ethers } from 'ethers';

// Test song: Sia - Chandelier (378195)
// - Has SoundCloud link
// - Has synced lyrics
// - Duration: 216s (under 190s fal.ai limit after trimming)

const TEST_SONG = {
  geniusId: 378195,
  name: 'Sia - Chandelier'
};

const CONTRACTS = {
  catalog: '0x40ca9B95AF2d439b37F4019659269574203b34B7', // KaraokeCatalogV2
  credits: '0x6de183934E68051c407266F877fafE5C20F74653'  // KaraokeCreditsV1
};

const ENDPOINTS = {
  demucs: 'https://techno-hippies--demucs-karaoke-fastapi-app.modal.run',
  webhook: 'https://karaoke-webhook-server.onrender.com'
};

async function main() {
  console.log('🎤 Full Pipeline E2E Test\n');
  console.log('━'.repeat(80));

  // Step 1: Run match-and-segment-v5
  console.log('\n[1/5] Running match-and-segment-v5...');
  const matchResult = await runMatchAndSegment(TEST_SONG.geniusId);

  if (!matchResult.success || !matchResult.isMatch) {
    throw new Error('Match and segment failed');
  }

  console.log(`✅ Match complete: ${matchResult.sections.length} segments`);
  console.log(`   Full duration: ${matchResult.lrclib.duration}s`);
  console.log(`   SoundCloud: ${matchResult.genius.soundcloudPermalink}`);
  console.log(`   Alignment URI: ${matchResult.alignment.uri}`);

  // Step 2: Create segment placeholders in contract
  console.log('\n[2/5] Creating segment placeholders...');
  const createResult = await createSegmentPlaceholders(
    TEST_SONG.geniusId,
    matchResult.sections
  );

  console.log(`✅ Created ${createResult.segmentCount} segment placeholders`);

  // Step 3: Trigger Demucs /process-song-async
  console.log('\n[3/5] Triggering Demucs song-based processing...');
  const jobId = `e2e-test-${Date.now()}`;

  const demucsResult = await triggerDemucsProcessing({
    jobId,
    geniusId: TEST_SONG.geniusId,
    audioUrl: `https://sc.maid.zone/_/restream/${matchResult.genius.soundcloudPermalink}`,
    fullDuration: matchResult.lrclib.duration,
    segments: matchResult.sections.map(s => ({
      id: s.type.toLowerCase().replace(/\s+/g, '-'),
      startTime: s.startTime,
      endTime: s.endTime
    }))
  });

  console.log(`✅ Job started: ${demucsResult.job_id}`);
  console.log(`   Processing ${demucsResult.segment_count} segments...`);

  // Step 4: Monitor Demucs completion
  console.log('\n[4/5] Monitoring Demucs processing (max 3 min)...');
  const processResult = await monitorDemucsJob(jobId);

  console.log(`✅ Demucs complete: ${processResult.segments.length} segments processed`);
  console.log(`   Time: ${processResult.timing.total}s`);
  console.log(`   Cost: $${processResult.cost.fal_api} (saved $${processResult.cost.savings_vs_segment_based})`);

  // Step 5: Verify contract updated
  console.log('\n[5/5] Verifying contract update...');
  await new Promise(r => setTimeout(r, 30000)); // Wait 30s for webhook + Lit Action 2

  const verifyResult = await verifyContractSegments(
    TEST_SONG.geniusId,
    matchResult.sections
  );

  console.log(`✅ Contract verification complete`);
  console.log(`   Processed segments: ${verifyResult.processedCount}/${verifyResult.totalCount}`);

  if (verifyResult.processedCount === verifyResult.totalCount) {
    console.log('\n🎉 SUCCESS! Full pipeline working!');
    console.log('\n━'.repeat(80));
    console.log('Pipeline Summary:');
    console.log(`  Song: ${matchResult.genius.artist} - ${matchResult.genius.title}`);
    console.log(`  Segments: ${matchResult.sections.length}`);
    console.log(`  Processing time: ~${Math.floor(processResult.timing.total)}s`);
    console.log(`  Cost savings: $${processResult.cost.savings_vs_segment_based}`);
    console.log(`  Contract: ${CONTRACTS.catalog}`);
    console.log('━'.repeat(80));
  } else {
    console.log('\n⚠️  PARTIAL SUCCESS: Some segments not processed');
    console.log(`   Check webhook logs: https://dashboard.render.com/`);
  }
}

// Helper functions (to be implemented)
async function runMatchAndSegment(geniusId) { /* ... */ }
async function createSegmentPlaceholders(geniusId, sections) { /* ... */ }
async function triggerDemucsProcessing(params) { /* ... */ }
async function monitorDemucsJob(jobId) { /* ... */ }
async function verifyContractSegments(geniusId, sections) { /* ... */ }

main().catch(console.error);
```

### **Test 2: Quick Smoke Test**

Create: `lit-actions/src/test/test-pipeline-smoke.mjs`

```bash
#!/usr/bin/env node
# Quick test: Just trigger Demucs with known segments
# Use this when you just want to test Demucs → webhook → contract flow

curl -X POST https://techno-hippies--demucs-karaoke-fastapi-app.modal.run/process-song-async \
  -F "job_id=smoke-test-$(date +%s)" \
  -F "user_address=0x0C6433789d14050aF47198B2751f6689731Ca79C" \
  -F "genius_id=378195" \
  -F "audio_url=https://filesamples.com/samples/audio/mp3/sample3.mp3" \
  -F "full_duration=30" \
  -F 'segments_json=[{"id":"chorus-1","startTime":5,"endTime":20}]' \
  -F "webhook_url=https://karaoke-webhook-server.onrender.com/webhook/song-complete"

# Expected: Job accepted, check logs
echo "Check Demucs logs: modal app logs demucs-karaoke"
echo "Check webhook logs: https://dashboard.render.com/"
```

---

## 🔧 Implementation Steps

### **Priority 1: Create Segment Placeholders** (CRITICAL)

**Problem**: Segments don't exist in contract before audio processing

**Solution**: Add `createSegmentsBatch()` call to `match-and-segment-v5.js`

**Location**: `lit-actions/src/karaoke/match-and-segment-v5.js:740-744`

```javascript
// After Step 6 (blockchain write), before returning response
if (writeToBlockchain && result.isMatch && sections.length > 0) {
  console.log('[6b/6] Creating segment placeholders in contract...');

  // Build segment data for createSegmentsBatch
  const segmentIds = sections.map(s => s.type.toLowerCase().replace(/\s+/g, '-'));
  const songId = `genius-${geniusId}`;
  const sectionTypes = sections.map(s => s.type);
  const startTimes = sections.map(s => Math.floor(s.startTime));
  const endTimes = sections.map(s => Math.floor(s.endTime));
  const durations = sections.map(s => Math.floor(s.duration));

  // ABI for createSegmentsBatch
  const createSegmentsAbi = [{
    "type": "function",
    "name": "createSegmentsBatch",
    "inputs": [
      {"name": "geniusId", "type": "uint32"},
      {"name": "songId", "type": "string"},
      {"name": "segmentIds", "type": "string[]"},
      {"name": "sectionTypes", "type": "string[]"},
      {"name": "startTimes", "type": "uint32[]"},
      {"name": "endTimes", "type": "uint32[]"},
      {"name": "durations", "type": "uint32[]"}
    ]
  }];

  const createIface = new ethers.utils.Interface(createSegmentsAbi);
  const createData = createIface.encodeFunctionData('createSegmentsBatch', [
    geniusId,
    songId,
    segmentIds,
    sectionTypes,
    startTimes,
    endTimes,
    durations
  ]);

  // Sign and broadcast segment creation transaction
  // (Similar to addFullSong transaction code above)

  console.log(`✅ Created ${sections.length} segment placeholders`);
}
```

### **Priority 2: Trigger Demucs Processing**

**Options**:

**Option A: Add to match-and-segment-v5.js** (Recommended)
- After creating segments, trigger Demucs
- Return jobId to frontend
- Frontend polls Modal `/job/{jobId}` for progress

**Option B: Frontend calls Demucs directly**
- After match-and-segment completes, frontend calls Demucs
- More control, better UX (show progress)

**Option C: Replace audio-processor-v3.js**
- Update to call Demucs `/process-song-async`
- Change from segment-based to song-based

### **Priority 3: Complete E2E Test**

Implement `test-full-pipeline-e2e.mjs` as specified above

---

## 📊 Testing Checklist

### **Pre-flight Checks**
- [ ] PKP has ETH on Base Sepolia (`cast balance 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30`)
- [ ] Webhook server healthy (`curl https://karaoke-webhook-server.onrender.com/health`)
- [ ] Demucs API healthy (`curl https://techno-hippies--demucs-karaoke-fastapi-app.modal.run/health`)
- [ ] Contract trustedProcessor set correctly (`cast call 0x40ca9B95AF2d439b37F4019659269574203b34B7 "trustedProcessor()"`)

### **E2E Test Steps**
1. [ ] Run `match-and-segment-v5` → verify song + alignment written to contract
2. [ ] Run `createSegmentsBatch` → verify 5 segment placeholders created
3. [ ] Trigger Demucs `/process-song-async` → verify job accepted
4. [ ] Monitor Demucs processing → verify completes in ~79s
5. [ ] Check webhook called → verify 200 response
6. [ ] Check Lit Action 2 executed → verify transaction broadcast
7. [ ] Verify contract updated → all 5 segments have Grove URIs

### **Verification Queries**
```bash
# Check segment exists
cast call 0x40ca9B95AF2d439b37F4019659269574203b34B7 \
  "segments(bytes32)" \
  $(cast keccak $(cast abi-encode "f(uint32,string)" 378195 "chorus-1")) \
  --rpc-url https://sepolia.base.org

# Check segment processed
cast call 0x40ca9B95AF2d439b37F4019659269574203b34B7 \
  "isSegmentProcessed(uint32,string,string)" \
  378195 "" "chorus-1" \
  --rpc-url https://sepolia.base.org
```

---

## 🎯 Next Steps

1. **Implement segment creation** in `match-and-segment-v5.js`
2. **Add Demucs trigger** (choose Option A, B, or C)
3. **Write E2E test** (`test-full-pipeline-e2e.mjs`)
4. **Run smoke test** to verify Demucs → webhook → contract
5. **Run full E2E test** to verify complete pipeline
6. **Update frontend** to use new song-based flow

---

## 💰 Cost Comparison

| Flow | Processing | Cost per Song | Time |
|------|-----------|---------------|------|
| **Old (Segment-based)** | 5 segments × $0.20 | **$1.00** | ~250s (5 × 50s) |
| **New (Song-based)** | 1 song × $0.20 | **$0.20** | ~79s (1 × 79s) |
| **Savings** | | **$0.80 (80%)** | **171s (68%)** |

---

## 🏗️ Architecture Decision

**Recommended**: Option A (Lit Action triggers Demucs)

**Why**:
- Single user action ("process this song")
- All segments processed together (optimal)
- Trustless execution (Lit Network verifies)
- Frontend just polls for completion

**Flow**:
```
User clicks "Process Song"
  ↓
match-and-segment-v5 runs
  ↓
Creates segments + triggers Demucs
  ↓
Returns jobId to frontend
  ↓
Frontend shows progress (polling)
  ↓
79s later: all segments ready
```

Alternative: Frontend calls Demucs directly after match-and-segment (more control, better UX)
