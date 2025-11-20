# Lit Actions - Service Integration Guide

**AI-powered exercise grading for karaoke language learning**

---

## 🏗️ Service Overview

| Component | Type | Status | Network |
|-----------|------|--------|---------|
| **actions/karaoke-grader-v1.js** | Aggregate grader | ✅ Active | Lit Protocol (nagaTest) |
| **actions/exercise-grader-v1.js** | Line-level grader | ✅ Active | Lit Protocol (nagaTest) |
| **Voxtral STT** | Speech transcription | ✅ Active | API (encrypted) |
| **OpenRouter/Gemini** | AI grading | ✅ Active | API (encrypted) |
| **PKP Signing** | Transaction signing | ⚠️ Degraded | Lit Protocol |

---

## 🔗 Integration Points

### Lit Actions Execution

**Karaoke Grader (Aggregate Scoring)**
- **CID**: `QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq`
- **Contract**: KaraokeEvents (`0x51aA6987130AA7E4654218859E075D8e790f4409`)
- **Chain**: Lens Testnet (37111)
- **Purpose**: Transcribe audio, grade pronunciation, submit aggregate score

**Exercise Grader (Line-Level)**
- **CID**: `QmbV3NTurgXwMqkaAD1z8t43iWAPNoBMHW9cMWk1LjTbfB`
- **Contract**: ExerciseEvents (`0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`)
- **Chain**: Lens Testnet (37111)
- **Purpose**: Grade individual line attempts (Say It Back, Multiple Choice)

### API Services

**Voxtral STT**
- **Purpose**: Audio transcription
- **Encryption**: CID-specific access control
- **Key Files**:
  - Exercise: `keys/exercise/voxtral_api_key_exercise.json`
  - Karaoke: `keys/karaoke/voxtral_api_key_karaoke.json`
- **Important**: Spelling is VOXTRAL (no S)

**OpenRouter/Gemini**
- **Purpose**: AI-powered pronunciation grading
- **Model**: `google/gemini-2.0-flash-exp:free`
- **Encryption**: CID-specific access control
- **Key File**: `keys/karaoke/openrouter_api_key_karaoke.json`

### Smart Contracts (Lens Testnet)

```typescript
const LENS_TESTNET_CONTRACTS = {
  KaraokeEvents: "0x51aA6987130AA7E4654218859E075D8e790f4409",
  ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832",
  RPC: "https://rpc.testnet.lens.xyz",
  ChainId: 37111
}
```

**Karaoke Events**:
```solidity
function gradeKaraokePerformance(
  uint256 performanceId,
  bytes32 clipHash,
  string calldata spotifyTrackId,
  address performer,
  uint16 similarityScore,  // Basis points (0-10000)
  uint16 lineCount,
  string calldata grade    // "Excellent", "Good", "Fair", "Needs Practice"
) external;
```

**Exercise Events**:
```solidity
function gradeSayItBackAttempt(
  uint256 attemptId,
  bytes32 lineId,
  bytes32 segmentHash,
  uint16 lineIndex,
  address learner,
  uint16 score,      // Basis points (0-10000)
  uint8 rating,      // FSRS rating (1-4)
  string metadataUri
) external;

function gradeMultipleChoiceAttempt(
  uint256 attemptId,
  bytes32 questionId,
  address learner,
  uint16 score,
  uint8 rating,
  string metadataUri
) external;
```

---

## 🔄 Data Flow

### Karaoke Grader Flow

```
User Audio → Lit Action → Voxtral STT → OpenRouter/Gemini → PKP Sign → Lens Testnet
    ↓            ↓              ↓                ↓               ↓            ↓
  Base64    Decrypt Keys   Transcript      Aggregate Score   Signature   On-chain
```

**Execution Steps**:
1. Decrypt Voxtral + OpenRouter API keys
2. Transcribe audio with Voxtral STT (or use override)
3. Grade pronunciation with Gemini AI
4. Calculate aggregate score (basis points)
5. Prepare zkSync type 0x71 transaction
6. Sign with PKP (⚠️ currently degraded)
7. Submit to KaraokeEvents contract

**Performance Metrics**:
- Decryption: ~50ms (both keys)
- Transcription: ~500-1000ms (or 0ms with override)
- AI Grading: ~660-750ms
- Contract Simulation: ~150ms
- Transaction Prep: ~440ms
- PKP Signing: ⚠️ 60+ seconds (expected: 1-2s)

### Exercise Grader Flow

```
User Audio → Lit Action → Voxtral STT → Levenshtein → PKP Sign → Lens Testnet
    ↓            ↓              ↓              ↓            ↓            ↓
  Base64    Decrypt Key    Transcript    Calculate Score  Signature   FSRS Event
```

**Execution Steps**:
1. Decrypt Voxtral API key
2. Transcribe user audio
3. Calculate pronunciation score (Levenshtein distance)
4. Map score to FSRS rating (1-4)
5. Sign transaction with PKP
6. Submit to ExerciseEvents contract
7. Use `Lit.Actions.runOnce()` for deduplication

---

## 🔐 Security & Access Control

### API Key Encryption

**Access Control Conditions**:
```javascript
const accessControlConditions = [{
  conditionType: 'evmBasic',
  contractAddress: '',
  standardContractType: '',
  chain: 'ethereum',
  method: '',
  parameters: [':currentActionIpfsId'],
  returnValueTest: {
    comparator: '=',
    value: CID  // Only this CID can decrypt
  }
}];
```

**Key Properties**:
- Old CIDs cannot decrypt new keys
- Each deployment requires re-encryption
- Keys stored in git-ignored `keys/` directory
- Decryption happens inside Lit nodes (never exposed)

### PKP (Programmable Key Pair)

**PKP Address**: `0x4e8dFa140265BEC567Ab22f6f882C4F587dBB889`

**Permission Management**:
```bash
# Add permission for new CID
bun scripts/add-pkp-permission.mjs <CID> nagaTest
```

**Signing Pattern**:
```javascript
// Sign EIP-712 transaction hash
const signature = await Lit.Actions.signAndCombineEcdsa({
  toSign: eip712Hash,
  publicKey: PKP_PUBLIC_KEY,
  sigName: "karaokeSig"
});
```

**Current Issue**: PKP signing takes 60+ seconds (expected: 1-2 seconds) on both Lit testnets due to network degradation.

### Contract Security

**Trusted PKP Pattern**:
```solidity
// Only trusted PKP can grade
address public trustedPKP;

modifier onlyTrustedPKP() {
  require(msg.sender == trustedPKP, "Not trusted PKP");
  _;
}

function gradeKaraokePerformance(...) external onlyTrustedPKP {
  // Only callable by PKP
}
```

---

## 🛠️ Integration Patterns

### Frontend Integration

**Execute Karaoke Grader**:
```typescript
import { executeLitAction } from '@/lib/lit/client';

const result = await executeLitAction({
  ipfsId: 'QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq',
  jsParams: {
    performanceId: Date.now(),
    clipHash: '0x...',
    spotifyTrackId: '0VjIjW4GlUZAMYd2vXMi3b',
    performer: userAddress,
    audioDataBase64: audioBase64,
    voxtralEncryptedKey: VOXTRAL_KEY,
    openRouterEncryptedKey: OPENROUTER_KEY,
    lyricsLines: [
      { text: "Line 1", startMs: 0, endMs: 2000 },
      { text: "Line 2", startMs: 2000, endMs: 4000 }
    ]
  }
});
```

**Execute Exercise Grader**:
```typescript
const result = await executeLitAction({
  ipfsId: 'QmbV3NTurgXwMqkaAD1z8t43iWAPNoBMHW9cMWk1LjTbfB',
  jsParams: {
    attemptId: Date.now(),
    lineId: '0x...',
    segmentHash: '0x...',
    lineIndex: 0,
    learner: userAddress,
    audioDataBase64: audioBase64,
    expectedText: "Hello world",
    voxtralEncryptedKey: VOXTRAL_KEY,
    testMode: false  // Set true to skip PKP signing
  }
});
```

### Subgraph Integration

**Query Performance Records**:
```graphql
query GetPerformances($performer: String!) {
  karaokePerformances(
    where: { performer: $performer }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    performanceId
    clipHash
    spotifyTrackId
    similarityScore
    grade
    timestamp
  }
}
```

**Query Exercise Attempts**:
```graphql
query GetLineAttempts($learner: String!, $lineId: String!) {
  lineAttempts(
    where: { learner: $learner, lineId: $lineId }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    attemptId
    score
    rating
    timestamp
  }
}
```

---

## 🧪 Testing Integration

### Test Karaoke Grader

```bash
# Full grading flow (skip PKP signing)
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_SKIP_TX=true \
bun tests/test-openrouter-minimal.mjs

# Test contract simulation
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_TX_STAGE=simulate \
bun tests/test-openrouter-minimal.mjs

# Test transaction preparation
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_TX_STAGE=prepare \
bun tests/test-openrouter-minimal.mjs
```

### Test Exercise Grader

```bash
# Uses testMode=true (skips PKP signing)
bun tests/test-exercise-grader-say-it-back.mjs
```

---

## 🚨 Known Issues

### PKP Signing Network Degradation

**Issue**: `Lit.Actions.signAndCombineEcdsa()` takes 60+ seconds and times out

- **Expected**: 1-2 seconds
- **Actual**: 60+ seconds (causes timeout)
- **Networks**: nagaDev, nagaTest
- **Root Cause**: Lit Protocol network performance degradation
- **Impact**: Cannot complete end-to-end transaction submission

**What Still Works**:
- ✅ API key decryption
- ✅ Voxtral transcription
- ✅ OpenRouter/Gemini grading
- ✅ Contract simulation (eth_call)
- ✅ Transaction preparation (nonce, gas price, encoding)
- ❌ PKP signing step

**Workarounds**:
- Use `skipTx: true` to test grading without transaction
- Use `txDebugStage: "simulate"` to test contract simulation
- Use `txDebugStage: "prepare"` to test transaction preparation
- Use `testMode: true` in exercise grader

---

## 📋 Environment Variables

Required in `.env`:

```bash
# API Keys (for encryption scripts)
VOXTRAL_API_KEY=your_voxtral_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# IPFS Upload
PINATA_JWT=your_pinata_jwt_here

# PKP Management (optional)
PRIVATE_KEY=your_wallet_private_key
```

---

## 🔧 Deployment Workflow

### 1. Upload Lit Action

```bash
set -a && source .env && set +a
node scripts/upload-lit-action.mjs actions/karaoke-grader-v1.js "Description"
# Returns: New CID
```

### 2. Encrypt API Keys

```bash
# Update CID in scripts/quick-encrypt.mjs first
node scripts/quick-encrypt.mjs
# Saves to: keys/voxtral_api_key.json, keys/openrouter_api_key.json
```

### 3. Add PKP Permission

```bash
bun scripts/add-pkp-permission.mjs <NEW_CID> nagaTest
```

### 4. Test

```bash
KARAOKE_GRADER_CID=<NEW_CID> \
KARAOKE_SKIP_TX=true \
bun tests/test-openrouter-minimal.mjs
```

---

## 📊 Integration Checklist

### ✅ Lit Actions
- [ ] Karaoke grader deployed to IPFS
- [ ] Exercise grader deployed to IPFS
- [ ] API keys encrypted for current CID
- [ ] PKP permissions added for both CIDs
- [ ] Test scripts passing (with skipTx/testMode)

### ✅ Smart Contracts
- [ ] KaraokeEvents deployed to Lens Testnet
- [ ] ExerciseEvents deployed to Lens Testnet
- [ ] Trusted PKP configured on both contracts
- [ ] Contract ABIs synced to frontend

### ✅ Frontend
- [ ] Lit client configured (nagaTest network)
- [ ] Encrypted keys stored in constants
- [ ] Audio recording implemented
- [ ] Result handling for both graders
- [ ] Error handling for PKP timeout

### ✅ Subgraph
- [ ] Indexing KaraokeEvents
- [ ] Indexing ExerciseEvents
- [ ] Performance query working
- [ ] Line attempt query working

---

**Essential integration guide for Lit Actions service communication**
