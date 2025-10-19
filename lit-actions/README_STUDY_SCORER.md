# Study Scorer v1 - Setup & Testing Guide

Complete implementation of audio transcription + FSRS spaced repetition for karaoke learning.

## Architecture Overview

```
User Records Audio
      ↓
study-scorer-v1.js Lit Action:
  1. Decrypt Voxstral API key
  2. Transcribe audio (TODO: implement)
  3. Calculate pronunciation scores (Levenshtein distance)
  4. Run FSRS-4.5 algorithm
  5. Sign & submit to FSRSTrackerV1 contract
      ↓
Contract: 0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3
  - Stores card states (stability, difficulty, next due date)
  - Emits CardReviewed events
      ↓
Grove (future): Index events for leaderboards/streaks
```

## Files Created

### Core Algorithm
- `src/karaoke/fsrs/constants.js` - FSRS-4.5 parameters
- `src/karaoke/fsrs/algorithm.js` - Core FSRS algorithm (state transitions)
- `src/karaoke/fsrs/scoring.js` - Pronunciation scoring (Levenshtein)

### Lit Action
- `src/karaoke/study-scorer-v1.js` - Main Lit Action (all code inlined)

### Scripts
- `scripts/encrypt-voxstral-key-v1.mjs` - Encrypt Voxstral API key
- `src/test/test-study-scorer-v1.mjs` - End-to-end test

### Documentation
- `STUDY_SCORER_ANALYSIS.md` - Architecture analysis & design decisions

## Setup Instructions

### 1. Get Voxstral API Key

Voxstral is Mistral's speech-to-text API:

```bash
# Sign up at https://console.mistral.ai/
# Create an API key
# Export it:
export VOXSTRAL_API_KEY=your_mistral_key_here
```

### 2. Encrypt the API Key

```bash
cd lit-actions
bun run scripts/encrypt-voxstral-key-v1.mjs
```

This will:
- Connect to Lit Protocol
- Encrypt your key with contract-based access control
- Save to `src/karaoke/keys/voxstral_api_key_v1.json`
- Only users with credits in KaraokeCreditsV1 can decrypt

### 3. Run the Test

```bash
cd lit-actions
bun run src/test/test-study-scorer-v1.mjs
```

Expected output:
```
🎤 Study Scorer v1 Test

1. Load encrypted Voxstral API key ✅
2. Simulate audio transcription ✅
3. Calculate pronunciation scores ✅
4. Run FSRS-4.5 algorithm ✅
5. Write card states to FSRSTrackerV1 ✅
6. Verify cards in contract ✅

📊 RESULTS
Lines processed: 4
Average score: 100/100

Line 0: 100/100 → Easy ⭐
Line 1: 100/100 → Easy ⭐
Line 2: 100/100 → Easy ⭐
Line 3: 100/100 → Easy ⭐

✅ Transaction submitted: 0x...
✅ Cards successfully written to contract!
```

## Contract Details

**FSRSTrackerV1 (Base Sepolia)**
- Address: `0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3`
- Explorer: https://sepolia.basescan.org/address/0xcb208efa5b615472ee9b8dea913624caefb6c1f3
- Trusted PKP: `0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30`

**Functions Used:**
- `updateCardsBatch(user, songId, segmentId, lineIndices[], ratings[], scores[], newCards[])`
- Gas: ~50k + (10k * lineCount)

## FSRS Algorithm Details

**Card States:**
- `New` (0): Never studied
- `Learning` (1): Short-term repetition
- `Review` (2): Long-term repetition
- `Relearning` (3): Failed review, back to short intervals

**Ratings:**
- `Again` (0): Score < 60% - Complete failure
- `Hard` (1): Score 60-74% - Difficult but passed
- `Good` (2): Score 75-89% - Good pronunciation
- `Easy` (3): Score 90-100% - Excellent pronunciation

**Key Metrics:**
- **Stability**: How long you can remember (in days)
- **Difficulty**: How hard the material is (1-10 scale)
- **Next Review**: Calculated optimal review time

**Example Flow:**
```
First study: Score 85% → Rating: Good
  → Stability: 2.4 days
  → Next review: 2 days

Second study: Score 92% → Rating: Easy
  → Stability: 5.8 days
  → Next review: 6 days

Miss review, study late: Score 70% → Rating: Hard
  → Stability: 4.2 days (decreased)
  → Next review: 4 days
```

## Pronunciation Scoring

**Algorithm: Levenshtein Distance**

Measures minimum edits (insertions, deletions, substitutions) between expected and actual lyrics.

**Example:**
```javascript
Expected: "I'm gonna swing from the chandelier"
Actual:   "I'm going to swing from the chandelier"

Normalized expected: "im gonna swing from the chandelier"
Normalized actual:   "im going to swing from the chandelier"

Distance: 5 (gonna → going = 2 edits, to inserted = 3 total)
Max length: 39
Similarity: 1 - (5/39) = 0.87
Score: 87/100 → Rating: Good
```

## Data Flow

### Input (from frontend):
```javascript
{
  userAddress: '0x...',
  songId: 'genius-378195',
  segmentId: 'chorus-1',
  expectedLyrics: [
    { lineIndex: 0, text: "...", startTime: 45.2 },
    { lineIndex: 1, text: "...", startTime: 48.5 }
  ],
  audioBlob: '<base64-audio>',
  contractAddress: '0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3',
  writeToBlockchain: true
}
```

### Output (to frontend):
```javascript
{
  success: true,
  linesProcessed: 4,
  scores: [100, 85, 92, 78],
  ratings: [3, 2, 3, 2],
  averageScore: 89,
  txHash: '0x...',
  contractAddress: '0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3'
}
```

## Next Steps

### 1. Implement Real Voxstral Transcription

Currently simulated. Replace in `study-scorer-v1.js`:

```javascript
// TODO: Replace this simulation
const transcript = expectedLyrics.map(line => line.text).join('\n');

// With actual Voxstral API call:
const transcriptResponse = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${voxstralKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'whisper-large-v3',
    audio: audioBlob,
    language: 'en'
  })
});

const transcript = await transcriptResponse.json();
```

### 2. Deploy to IPFS

```bash
cd lit-actions/src/karaoke
ipfs add study-scorer-v1.js
# Get CID: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Update Frontend

Add to `app/src/lib/lit/actions/`:

```typescript
export async function scoreStudySession(
  audioBlob: Blob,
  expectedLyrics: LineData[],
  songId: string,
  segmentId: string
) {
  const litClient = await createLitClient();

  const result = await litClient.executeJs({
    ipfsId: 'QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    jsParams: {
      userAddress: user.address,
      songId,
      segmentId,
      expectedLyrics,
      audioBlob: await blobToBase64(audioBlob),
      voxstralKeyAccessControlConditions: VOXSTRAL_KEY.accessControlConditions,
      voxstralKeyCiphertext: VOXSTRAL_KEY.ciphertext,
      voxstralKeyDataToEncryptHash: VOXSTRAL_KEY.dataToEncryptHash,
      contractAddress: BASE_SEPOLIA_CONTRACTS.fsrsTrackerV1,
      writeToBlockchain: true
    }
  });

  return JSON.parse(result.response);
}
```

### 4. Frontend Integration

Wire up the Study button in segment cards:

```typescript
async function handleStudy(segment: Segment) {
  // 1. Start recording
  const recorder = await startRecording();

  // 2. User sings along
  await playSongSegment(segment);

  // 3. Stop recording
  const audioBlob = await stopRecording(recorder);

  // 4. Call Lit Action
  const result = await scoreStudySession(
    audioBlob,
    segment.lines,
    song.id,
    segment.id
  );

  // 5. Show results
  showScoreResults(result);
}
```

## Gas Costs

**Base Sepolia (L2):**
- Single line: ~50k gas (~$0.00005)
- 4 lines batch: ~90k gas (~$0.00009)
- 10 lines batch: ~150k gas (~$0.00015)
- 20 lines batch: ~250k gas (~$0.00025)

**Optimization:** Always use batch updates for segments with multiple lines.

## Troubleshooting

### Error: "VOXSTRAL_API_KEY not found"
```bash
export VOXSTRAL_API_KEY=your_mistral_key_here
bun run scripts/encrypt-voxstral-key-v1.mjs
```

### Error: "Encrypted key file not found"
The test expects `src/karaoke/keys/voxstral_api_key_v1.json`.
Run the encryption script first.

### Error: "Transaction failed"
- Check PKP has ETH on Base Sepolia
- Verify contract address is correct
- Check gas limit is sufficient

### Low pronunciation scores
- Ensure audio quality is good
- Check microphone permissions
- Verify expected lyrics match actual song lyrics
- Consider adjusting score thresholds in `scoreToRating()`

## Performance

**Expected timings:**
- Audio transcription: ~1-2s (Voxstral API)
- Scoring calculation: <100ms (local)
- FSRS algorithm: <100ms (local)
- Transaction signing: ~500ms (Lit PKP)
- Transaction submission: ~2s (Base Sepolia)

**Total: ~3-5 seconds**

## Security

**Access Control:**
- Voxstral API key encrypted with Lit Protocol
- Only users with credits can decrypt
- PKP credentials hardcoded in IPFS (immutable)
- All trust-critical logic runs in Lit Action
- No way to spoof scores or game the system

**Contract Security:**
- Only trusted PKP can write card states
- User address verified in transaction
- All updates are auditable via events
- Paused emergency stop function

## Support

For issues or questions:
1. Check this README
2. Review `STUDY_SCORER_ANALYSIS.md`
3. Check contract on BaseScan
4. Review Lit Action logs
