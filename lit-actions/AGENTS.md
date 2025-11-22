# Lit Actions - Service Integration Guide

**AI-powered exercise grading for karaoke language learning**

---

## Service Overview

| Component | Status | Network |
|-----------|--------|---------|
| Karaoke Grader | Active | Lit Protocol |
| Exercise Grader | Active | Lit Protocol |
| Voxtral STT | Active | API (encrypted) |
| OpenRouter/Gemini | Active | API (encrypted) |

---

## Integration Points

### Lit Actions

**Karaoke Grader**
- Purpose: Transcribe audio, grade pronunciation, submit aggregate score
- Contract: KaraokeEvents on Lens Testnet

**Exercise Grader**
- Purpose: Grade line attempts (Say It Back, Multiple Choice)
- Contract: ExerciseEvents on Lens Testnet

### Smart Contracts (Lens Testnet - 37111)

```typescript
const CONTRACTS = {
  KaraokeEvents: "0x51aA6987130AA7E4654218859E075D8e790f4409",
  ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832",
  RPC: "https://rpc.testnet.lens.xyz"
}
```

**Karaoke Events**:
```solidity
function gradeKaraokePerformance(
  uint256 performanceId,
  bytes32 clipHash,
  string calldata spotifyTrackId,
  address performer,
  uint16 similarityScore,  // 0-10000
  uint16 lineCount,
  string calldata grade
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
  uint16 score,
  uint8 rating,  // FSRS 1-4
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

## Data Flow

### Karaoke Grader

```
Audio → Decrypt Keys → Voxtral STT → Gemini AI → PKP Sign → Contract
```

### Exercise Grader

```
Audio → Decrypt Key → Voxtral STT → Score (Levenshtein) → PKP Sign → Contract
```

---

## Environment Configuration

### Networks

| Env | Lit Network | Keys | Notes |
|-----|-------------|------|-------|
| naga-dev | nagaDev | keys/dev/ | Free |
| naga-test | nagaTest | keys/test/ | Requires tstLPX |

### Required Environment Variables

```bash
VOXTRAL_API_KEY=...
OPENROUTER_API_KEY=...
PINATA_JWT=...
PRIVATE_KEY=...  # For PKP management
```

---

## Deployment Workflow

### Complete Setup

```bash
# Deploy action with all steps
bun scripts/setup.ts karaoke
bun scripts/setup.ts exercise

# Verify configuration
bun scripts/verify.ts --all
```

### Individual Steps

```bash
# 1. Upload to IPFS
bun scripts/upload-action.ts karaoke

# 2. Add PKP permission
bun scripts/add-permission.ts QmXxx...

# 3. Encrypt keys
bun scripts/encrypt-key.ts --action=karaoke

# 4. Verify
bun scripts/verify.ts
```

---

## Testing

### Run Tests

```bash
# Full flow (default: testMode=false, signs transactions)
LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-grader.ts
LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-say-it-back.ts

# Skip signing
KARAOKE_SKIP_TX=true bun tests/karaoke/test-karaoke-grader.ts

# Debug stages
KARAOKE_TX_STAGE=simulate  # Contract simulation
KARAOKE_TX_STAGE=prepare   # Transaction prep
```

### Centralized Config

All tests use `tests/shared/env.ts`:

```typescript
import { Env } from '../shared/env';

// Network detection
Env.name         // 'naga-dev' or 'naga-test'
Env.litNetwork   // nagaDev or nagaTest
Env.isTest       // true if naga-test

// Load resources
Env.cids.karaoke    // Current CID
Env.loadKey('karaoke', 'voxtral_api_key')
Env.getAuthStoragePath('my-test')
```

---

## Security

### API Key Encryption

```javascript
const accessControlConditions = [{
  conditionType: 'evmBasic',
  parameters: [':currentActionIpfsId'],
  returnValueTest: {
    comparator: '=',
    value: CID  // Only this CID can decrypt
  }
}];
```

### PKP Permissions

- Only permitted CIDs can use PKP for signing
- Contracts only accept signatures from trusted PKP

---

## File Structure

```
lit-actions/
├── actions/           # Lit Action source code
├── scripts/           # TypeScript tooling
│   ├── setup.ts       # Full deployment
│   ├── upload-action.ts
│   ├── add-permission.ts
│   ├── encrypt-key.ts
│   └── verify.ts
├── tests/
│   ├── shared/env.ts  # Centralized config
│   ├── karaoke/       # Karaoke tests
│   ├── exercise/      # Exercise tests
│   └── fixtures/      # Test audio
├── keys/{dev,test}/   # Encrypted keys
├── cids/{dev,test}.json
└── output/            # PKP creds, auth storage
```

---

## Integration Checklist

- [ ] Actions deployed to IPFS
- [ ] PKP permissions added
- [ ] Keys encrypted for current CIDs
- [ ] Tests passing
- [ ] Contracts deployed with trusted PKP
- [ ] Subgraph indexing events

---

**Last Updated**: 2025-11-22
