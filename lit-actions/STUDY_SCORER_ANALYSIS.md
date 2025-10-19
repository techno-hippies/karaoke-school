# Study Scorer v1 - Analysis & Design Plan

## Analysis of Contract Write Pattern (from match-and-segment-v10.js)

### 1. PKP Credentials (Hardcoded in Lit Action)

```javascript
const SYSTEM_PKP = {
  publicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
  address: '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30',
  tokenId: '18495970405190900970517221272825216094387884724482470185691150662171839015831'
};
```

**Key Points:**
- PKP credentials are immutable (IPFS-hosted code can't be spoofed)
- `publicKey`: Uncompressed ECDSA public key (no 0x prefix, 130 chars)
- `address`: Ethereum address derived from public key
- `tokenId`: Optional, not used in signing

### 2. Transaction Signing Flow

**Step-by-step breakdown (lines 640-727):**

```javascript
// 1. Create ABI interface
const abi = [{ /* function definition */ }];
const iface = new ethers.utils.Interface(abi);

// 2. Encode function call
const data = iface.encodeFunctionData('addFullSong', [songData]);

// 3. Setup provider
const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');

// 4. Get nonce and gas price (parallel for speed)
const [nonce, gasPrice] = await Promise.all([
  provider.getTransactionCount(pkpAddress),
  provider.getGasPrice()
]);

// 5. Build unsigned transaction
const unsignedTx = {
  to: contractAddress,
  nonce: nonce,
  gasLimit: 500000,
  gasPrice: gasPrice,
  data: data,
  chainId: 84532 // Base Sepolia
};

// 6. Hash the unsigned transaction
const transactionHash = ethers.utils.keccak256(
  ethers.utils.serializeTransaction(unsignedTx)
);
const toSign = ethers.utils.arrayify(transactionHash);

// 7. Sign with PKP (strip 0x prefix if present)
let publicKeyForSigning = pkpPublicKey;
if (publicKeyForSigning.startsWith('0x')) {
  publicKeyForSigning = publicKeyForSigning.substring(2);
}

const signature = await Lit.Actions.signAndCombineEcdsa({
  toSign: toSign,
  publicKey: publicKeyForSigning,
  sigName: 'addFullSongTx' // Unique name for this signature
});

// 8. Parse signature
const jsonSignature = JSON.parse(signature);
const rHex = jsonSignature.r.startsWith('0x') ? jsonSignature.r : `0x${jsonSignature.r}`;
const sHex = jsonSignature.s.startsWith('0x') ? jsonSignature.s : `0x${jsonSignature.s}`;

// 9. Extract recovery ID and calculate EIP-155 v
let recid = 0;
if (jsonSignature.recid !== undefined) {
  recid = jsonSignature.recid;
} else if (jsonSignature.v !== undefined) {
  recid = jsonSignature.v >= 27 ? jsonSignature.v - 27 : jsonSignature.v;
}

const chainId = 84532;
const v = chainId * 2 + 35 + recid; // EIP-155: v = chainId * 2 + 35 + recid

// 10. Create signature object and serialize
const sigObject = { r: rHex, s: sHex, v: v };
const signedTx = ethers.utils.serializeTransaction(unsignedTx, sigObject);

// 11. Submit transaction (use runOnce to prevent duplicates)
const txHashResult = await Lit.Actions.runOnce(
  { waitForResponse: true, name: "segmentBatchTx" },
  async () => {
    try {
      const hash = await provider.send("eth_sendRawTransaction", [signedTx]);
      return hash;
    } catch (error) {
      return `TX_SUBMIT_ERROR: ${error.message}`;
    }
  }
);
```

**Critical Details:**
- EIP-155 v calculation: `v = chainId * 2 + 35 + recid`
- Use `runOnce` for idempotent operations (3 Lit nodes execute, only 1 should submit)
- Handle both `recid` (0/1) and legacy `v` (27/28) formats
- Always serialize BEFORE signing, then serialize WITH signature

### 3. Key Differences for study-scorer-v1.js

| Aspect | match-and-segment-v10.js | study-scorer-v1.js |
|--------|--------------------------|---------------------|
| **Function** | `addFullSong(SongParams)` | `updateCard()` or `updateCardsBatch()` |
| **Input Data** | Song metadata (16 fields) | Card states (FSRS Card struct) |
| **External API** | Genius + LRClib + OpenRouter | Voxstral (STT) |
| **Computation** | AI matching + segmentation | FSRS algorithm + score calculation |
| **Gas Limit** | 500k (complex write) | 50-200k (simple state update) |
| **Batch Support** | Single song | Up to 20 cards per tx |

---

## Study Scorer v1 Architecture

### Input Flow

```
User Records Audio
      ↓
Frontend sends to Lit Action:
  - audioBlob (base64 or arraybuffer)
  - user address
  - songId
  - segmentId
  - expectedLyrics[] (array of line objects)
      ↓
Lit Action:
  1. Decrypt Voxstral API key
  2. Transcribe audio → actual transcript
  3. Compare with expectedLyrics → calculate scores per line
  4. Run FSRS algorithm on each line
  5. Sign transaction with updated card states
  6. Submit to FSRSTrackerV1 contract
  7. (Optional) Update Grove leaderboards
```

### Expected jsParams

```javascript
{
  // User context
  userAddress: '0x...',

  // Song/segment context
  songId: 'genius-378195', // or custom format
  segmentId: 'chorus-1',

  // Expected lyrics (from alignment data)
  expectedLyrics: [
    { lineIndex: 0, text: 'I\'m gonna swing from the chandelier', startTime: 45.2 },
    { lineIndex: 1, text: 'From the chandelier', startTime: 48.5 },
    // ... more lines
  ],

  // Audio data
  audioBlob: '<base64-encoded-audio>', // or arraybuffer

  // Encrypted API keys
  voxstralKeyAccessControlConditions: [...],
  voxstralKeyCiphertext: '...',
  voxstralKeyDataToEncryptHash: '...',

  // Contract write params
  contractAddress: '0xcB208EFA5B615472ee9b8Dea913624caefB6C1F3', // FSRSTrackerV1
  writeToBlockchain: true,

  // Optional: Previous card states (for updates, not first review)
  previousCards?: Card[] // If updating existing cards
}
```

### FSRS Algorithm Requirements

**Core Functions Needed (Vanilla JS):**

```javascript
// 1. Initialize new card
function initCard() {
  return {
    due: 0,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0, // CardState.New
    lastReview: 0
  };
}

// 2. Next card state after review
function nextCardState(card, rating, now) {
  // rating: 0=Again, 1=Hard, 2=Good, 3=Easy
  // Implements FSRS-4.5 algorithm
  // Returns updated Card object
}

// 3. Calculate new interval
function calculateInterval(stability, desiredRetention = 0.9) {
  // FSRS formula: I = S * (R^(1/(DECAY)) - 1)
  // where S = stability, R = desired retention
}

// 4. Update difficulty
function updateDifficulty(difficulty, rating) {
  // FSRS difficulty adjustment based on rating
}

// 5. Update stability
function updateStability(card, rating) {
  // FSRS stability calculation (complex, depends on state)
}
```

**FSRS-4.5 Constants:**

```javascript
const FSRS_PARAMS = {
  requestRetention: 0.9,
  maximumInterval: 36500, // 100 years in days
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05,
    0.34, 1.26, 0.29, 2.61
  ] // Default FSRS-4.5 weights
};
```

### Pronunciation Scoring Algorithm

**Simple Approach (Levenshtein Distance):**

```javascript
function calculatePronunciationScore(expected, actual) {
  // 1. Normalize both strings
  const normalizedExpected = normalize(expected);
  const normalizedActual = normalize(actual);

  // 2. Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);

  // 3. Convert to percentage (0-100)
  const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
  const similarity = 1 - (distance / maxLen);
  const score = Math.max(0, Math.min(100, Math.round(similarity * 100)));

  return score;
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
}

function levenshteinDistance(a, b) {
  // Standard Levenshtein algorithm
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
```

**Rating Conversion (Score → FSRS Rating):**

```javascript
function scoreToRating(score) {
  if (score >= 90) return 3; // Easy
  if (score >= 75) return 2; // Good
  if (score >= 60) return 1; // Hard
  return 0; // Again
}
```

### Contract Write Functions

**FSRSTrackerV1 ABI (subset needed):**

```javascript
const FSRS_TRACKER_ABI = [
  {
    type: 'function',
    name: 'updateCard',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'songId', type: 'string' },
      { name: 'segmentId', type: 'string' },
      { name: 'lineIndex', type: 'uint8' },
      { name: 'rating', type: 'uint8' },
      { name: 'score', type: 'uint8' },
      {
        name: 'newCard',
        type: 'tuple',
        components: [
          { name: 'due', type: 'uint40' },
          { name: 'stability', type: 'uint16' },
          { name: 'difficulty', type: 'uint8' },
          { name: 'elapsedDays', type: 'uint16' },
          { name: 'scheduledDays', type: 'uint16' },
          { name: 'reps', type: 'uint8' },
          { name: 'lapses', type: 'uint8' },
          { name: 'state', type: 'uint8' },
          { name: 'lastReview', type: 'uint40' }
        ]
      }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'updateCardsBatch',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'songId', type: 'string' },
      { name: 'segmentId', type: 'string' },
      { name: 'lineIndices', type: 'uint8[]' },
      { name: 'ratings', type: 'uint8[]' },
      { name: 'scores', type: 'uint8[]' },
      {
        name: 'newCards',
        type: 'tuple[]',
        components: [
          { name: 'due', type: 'uint40' },
          { name: 'stability', type: 'uint16' },
          { name: 'difficulty', type: 'uint8' },
          { name: 'elapsedDays', type: 'uint16' },
          { name: 'scheduledDays', type: 'uint16' },
          { name: 'reps', type: 'uint8' },
          { name: 'lapses', type: 'uint8' },
          { name: 'state', type: 'uint8' },
          { name: 'lastReview', type: 'uint40' }
        ]
      }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  }
];
```

### Data Type Conversions

**IMPORTANT: Contract uses scaled integers for precision**

```javascript
// Contract storage format (from FSRSTrackerV1.sol):
// - stability: uint16 = real_value * 100 (e.g., 450 = 4.5 days)
// - difficulty: uint8 = real_value * 10 (e.g., 50 = 5.0)
// - elapsedDays: uint16 = real_value * 10 (e.g., 15 = 1.5 days)
// - scheduledDays: uint16 = real_value * 10 (e.g., 10 = 1.0 day)
// - due: uint40 = unix timestamp (seconds)
// - lastReview: uint40 = unix timestamp (seconds)

function encodeCardForContract(card) {
  return {
    due: Math.floor(card.due),
    stability: Math.floor(card.stability * 100), // Scale up
    difficulty: Math.floor(card.difficulty * 10), // Scale up
    elapsedDays: Math.floor(card.elapsedDays * 10), // Scale up
    scheduledDays: Math.floor(card.scheduledDays * 10), // Scale up
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: Math.floor(card.lastReview)
  };
}

function decodeCardFromContract(contractCard) {
  return {
    due: contractCard.due,
    stability: contractCard.stability / 100, // Scale down
    difficulty: contractCard.difficulty / 10, // Scale down
    elapsedDays: contractCard.elapsedDays / 10, // Scale down
    scheduledDays: contractCard.scheduledDays / 10, // Scale down
    reps: contractCard.reps,
    lapses: contractCard.lapses,
    state: contractCard.state,
    lastReview: contractCard.lastReview
  };
}
```

---

## Implementation Plan

### Phase 1: FSRS Algorithm (Vanilla JS)
- [ ] Implement `initCard()`
- [ ] Implement `nextCardState(card, rating, now)`
- [ ] Implement `calculateInterval()`
- [ ] Implement `updateDifficulty()`
- [ ] Implement `updateStability()`
- [ ] Test FSRS calculations against ts-fsrs library

### Phase 2: Scoring Logic
- [ ] Implement `levenshteinDistance()`
- [ ] Implement `calculatePronunciationScore()`
- [ ] Implement `scoreToRating()`
- [ ] Test with sample transcripts

### Phase 3: Lit Action Core
- [ ] Setup PKP credentials
- [ ] Decrypt Voxstral API key
- [ ] Transcribe audio via Voxstral
- [ ] Calculate scores for each line
- [ ] Run FSRS algorithm for each line
- [ ] Prepare card data for contract

### Phase 4: Contract Write
- [ ] Build ABI interface
- [ ] Encode `updateCardsBatch()` call
- [ ] Sign transaction with PKP
- [ ] Submit transaction
- [ ] Handle errors

### Phase 5: Test Script
- [ ] Create test audio file
- [ ] Load PKP credentials
- [ ] Execute Lit Action
- [ ] Verify contract state
- [ ] Test batch updates

---

## Gas Optimization Strategy

**Single Line Review:**
```javascript
// Use updateCard() - ~50k gas
contractCall = 'updateCard';
params = [userAddress, songId, segmentId, lineIndex, rating, score, newCard];
gasLimit = 80000;
```

**Multiple Lines (2-20):**
```javascript
// Use updateCardsBatch() - ~200k gas for 5 lines
contractCall = 'updateCardsBatch';
params = [userAddress, songId, segmentId, lineIndices, ratings, scores, newCards];
gasLimit = 50000 + (lineIndices.length * 10000); // Dynamic based on count
```

**Optimization:**
- Batch updates save ~30% gas vs individual updates
- Use batch for segments with 2+ lines
- Contract enforces max 20 lines per batch

---

## Next Steps

1. **Implement FSRS algorithm** (vanilla JS, no dependencies)
2. **Create study-scorer-v1.js** Lit Action
3. **Create test script** with sample audio
4. **Deploy to IPFS** and get CID
5. **Update frontend** to call Lit Action on study completion

## Files to Create

```
lit-actions/src/karaoke/
  ├── study-scorer-v1.js          # Main Lit Action
  ├── fsrs/
  │   ├── algorithm.js             # FSRS-4.5 implementation
  │   ├── scoring.js               # Pronunciation scoring
  │   └── constants.js             # FSRS parameters
  └── keys/
      └── voxstral_api_key_v1.json # Encrypted API key

lit-actions/src/test/
  └── test-study-scorer-v1.mjs    # Test script

lit-actions/test-audio/
  └── chandelier-chorus-sample.mp3 # Test audio file
```
