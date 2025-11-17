# Lit Actions - Karaoke School

**AI-powered exercise grading for karaoke language learning**

---

## 📁 Structure

```
lit-actions/
├── karaoke/
│   └── karaoke-grader-v1.js       # Aggregate performance grader
├── study/
│   └── exercise-grader-v1.js      # Line-level exercise grader
├── scripts/
│   ├── upload-lit-action.mjs      # Upload to IPFS via Pinata
│   ├── encrypt-voxtral-key.mjs    # Encrypt Voxtral API key
│   ├── encrypt-openrouter-key.mjs # Encrypt OpenRouter API key
│   ├── quick-encrypt.mjs          # Batch encrypt both keys
│   └── add-pkp-permission.mjs     # Add PKP permissions
├── keys/                          # Encrypted API keys (git ignored)
│   ├── voxtral_api_key.json
│   └── openrouter_api_key.json
├── tests/                         # Test scripts
├── AGENTS.md                      # Service integration guide
└── README.md                      # This file
```

---

## 🚀 Current Status

### Karaoke Grader (karaoke-grader-v1.js)
**CID**: `QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq`
**Contract**: KaraokeEvents (`0x51aA6987130AA7E4654218859E075D8e790f4409`)
**Status**: ✅ **Production-ready** (except PKP signing - see below)

**Features**:
- Voxtral STT transcription with encrypted API key
- Gemini AI pronunciation grading via OpenRouter
- zkSync type 0x71 transaction encoding for Lens Testnet
- Contract simulation and transaction preparation
- Debug stages: simulate, prepare, sign
- Metrics tracking for all operations

### Exercise Grader (exercise-grader-v1.js)
**CID**: `QmbV3NTurgXwMqkaAD1z8t43iWAPNoBMHW9cMWk1LjTbfB`
**Contract**: ExerciseEvents (`0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`)
**Status**: ✅ **Production-ready**

**Features**:
- Say It Back: Voxtral transcription + Levenshtein scoring
- Multiple Choice: Answer validation
- FSRS rating calculation (1-4)
- Transaction deduplication with `Lit.Actions.runOnce()`

---

## ⚠️ PKP Signing Network Degradation

**Current Issue**: PKP signing is degraded on both Lit testnets

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Key Decryption | ~50ms | ~50ms | ✅ Works |
| Voxtral STT | ~500-1000ms | ~500-1000ms | ✅ Works |
| AI Grading | ~660-750ms | ~660-750ms | ✅ Works |
| Contract Simulation | ~150ms | ~150ms | ✅ Works |
| Transaction Prep | ~440ms | ~440ms | ✅ Works |
| **PKP Signing** | **1-2s** | **60+ seconds** | ❌ **Timeout** |

**Root Cause**: Lit Protocol network performance degradation on nagaDev and nagaTest networks

**Workarounds**:
- Use `skipTx: true` to test grading without transaction submission
- Use `txDebugStage: "simulate"` to test contract simulation
- Use `txDebugStage: "prepare"` to test transaction preparation
- Use `testMode: true` in exercise grader tests

---

## 🔧 Quick Start

### Prerequisites

```bash
cd lit-actions
bun install

# Set environment variables
cp .env.example .env
# Edit .env with your API keys
```

Required environment variables:
```bash
VOXTRAL_API_KEY=your_voxtral_key      # Note: VOXTRAL not VOXSTRAL
OPENROUTER_API_KEY=your_openrouter_key
PINATA_JWT=your_pinata_jwt
```

### Test Current Deployment

```bash
# Load environment
set -a && source .env && set +a

# Test karaoke grader (skip PKP signing)
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_SKIP_TX=true \
bun tests/test-openrouter-minimal.mjs

# Test exercise grader
bun tests/test-exercise-grader-say-it-back.mjs
```

**Expected Output**:
```json
{
  "success": true,
  "similarityScore": 9850,
  "grade": "Excellent",
  "executionTime": 859,
  "metrics": {
    "transcriptionMs": 0,
    "geminiMs": 712
  }
}
```

### Deploy New Version

```bash
# 1. Upload Lit Action
node scripts/upload-lit-action.mjs karaoke/karaoke-grader-v1.js "Description"
# Returns: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# 2. Update CID in scripts/quick-encrypt.mjs
# Edit line 12: const CID = 'QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

# 3. Encrypt API keys
node scripts/quick-encrypt.mjs
# Saves to: keys/voxtral_api_key.json, keys/openrouter_api_key.json

# 4. Add PKP permission
bun scripts/add-pkp-permission.mjs QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX nagaTest

# 5. Test
KARAOKE_GRADER_CID=QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
KARAOKE_SKIP_TX=true \
bun tests/test-openrouter-minimal.mjs
```

---

## 🧪 Testing

### Debug Stages

The karaoke grader supports debug stages for incremental testing:

**Skip Transaction** (fastest):
```bash
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_SKIP_TX=true \
bun tests/test-openrouter-minimal.mjs
```
- Tests: Decryption, transcription, AI grading
- Skips: Contract interaction
- Time: ~860ms

**Simulate** (contract validation):
```bash
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_TX_STAGE=simulate \
bun tests/test-openrouter-minimal.mjs
```
- Tests: Everything + contract simulation (eth_call)
- Skips: Transaction preparation, PKP signing, submission
- Time: ~1013ms

**Prepare** (full transaction prep):
```bash
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_TX_STAGE=prepare \
bun tests/test-openrouter-minimal.mjs
```
- Tests: Everything + nonce/gas fetching + transaction encoding
- Skips: PKP signing, submission
- Time: ~1234ms

### Test Parameters

**Override Transcript** (skip Voxtral API):
```bash
KARAOKE_TRANSCRIPT_OVERRIDE_PATH=tests/transcript-override.txt \
bun tests/test-openrouter-minimal.mjs
```

**Test with Real Audio**:
```bash
# Remove transcript override
KARAOKE_GRADER_CID=QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq \
KARAOKE_SKIP_TX=true \
KARAOKE_AUDIO_PATH=path/to/audio.mp3 \
bun tests/test-openrouter-minimal.mjs
```

---

## 🌐 Networks & Contracts

### Lens Testnet
- **Chain ID**: 37111
- **RPC**: https://rpc.testnet.lens.xyz
- **Explorer**: https://explorer.testnet.lens.xyz

**Deployed Contracts**:
```typescript
const CONTRACTS = {
  KaraokeEvents: "0x51aA6987130AA7E4654218859E075D8e790f4409",
  ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832"
}
```

### Lit Protocol
- **Network**: nagaTest (testnet)
- **PKP Address**: `0x4e8dFa140265BEC567Ab22f6f882C4F587dBB889`
- **Status**: ⚠️ PKP signing degraded (60+ second latency)

---

## 🔐 Security

### API Key Encryption

**How it Works**:
1. Keys encrypted with Lit Protocol
2. Access control tied to specific CID
3. Old CIDs cannot decrypt new keys
4. Decryption happens inside Lit nodes (never exposed)

**Access Control Conditions**:
```javascript
{
  conditionType: 'evmBasic',
  contractAddress: '',
  standardContractType: '',
  chain: 'ethereum',
  method: '',
  parameters: [':currentActionIpfsId'],
  returnValueTest: {
    comparator: '=',
    value: 'QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq'
  }
}
```

### PKP Permissions

**Manage Permissions**:
```bash
# Add permission for new Lit Action
bun scripts/add-pkp-permission.mjs <CID> nagaTest

# Check current permissions
# (requires Lit Protocol SDK exploration tools)
```

**Contract Integration**:
- Only trusted PKP can call grading functions
- PKP address configured in smart contracts
- Immutable performance records on-chain

---

## 📊 Performance Metrics

Based on recent test runs with `skipTx=true`:

| Operation | Time | Notes |
|-----------|------|-------|
| Key Decryption | ~50ms | Both Voxtral + OpenRouter |
| Transcription | 0ms | Using override in tests |
| AI Grading | ~660-750ms | Gemini 2.0 Flash via OpenRouter |
| Total (no tx) | ~860ms | End-to-end grading |

With contract interaction:

| Stage | Total Time | Added Time |
|-------|------------|------------|
| simulate | ~1013ms | +153ms (eth_call) |
| prepare | ~1234ms | +374ms (nonce + gas + encoding) |
| sign | 60+ seconds | ❌ Timeout (network issue) |

---

## 🆘 Troubleshooting

### "Access control conditions check failed"
**Cause**: Keys encrypted for different CID
**Fix**:
```bash
# Update CID in scripts/quick-encrypt.mjs
# Then re-encrypt
node scripts/quick-encrypt.mjs
```

### "Request timed out" / "PKP signing timeout"
**Cause**: PKP signing network degraded
**Fix**: Use workarounds
```bash
# Skip transaction
KARAOKE_SKIP_TX=true bun tests/test-openrouter-minimal.mjs

# Or test up to simulation
KARAOKE_TX_STAGE=simulate bun tests/test-openrouter-minimal.mjs
```

### "Cannot find module"
**Cause**: Missing dependencies
**Fix**:
```bash
bun install
```

### "VOXSTRAL is not defined" or similar
**Cause**: Wrong API name (common mistake)
**Fix**: It's VOXTRAL not VOXSTRAL
```bash
# Correct
echo $VOXTRAL_API_KEY

# Wrong
echo $VOXSTRAL_API_KEY  # ❌ Has extra S
```

**Memory Aid**: VOXTRAL = VOX (voice) + TR (transcribe) + AL (all)

---

## 📝 Recent Updates

**2025-11-17**:
- ✅ Consolidated all .md files into AGENTS.md and README.md
- ✅ Fixed txDebugStage scope bug in karaoke-grader
- ✅ Added runOnce pattern for transaction deduplication
- ✅ Created quick-encrypt.mjs helper script
- ✅ Documented PKP signing network degradation
- ✅ Added comprehensive testing guides with all debug stages

**2025-11-05**:
- ✅ Fixed VOXSTRAL → VOXTRAL naming consistency
- ✅ Re-encrypted keys for correct spelling
- ✅ Updated all scripts and documentation

---

## 📚 Additional Documentation

- **[AGENTS.md](./AGENTS.md)** - Service integration guide with detailed flow diagrams
- **[../AGENTS.md](../AGENTS.md)** - Full project integration guide
- **[scripts/](./scripts/)** - Helper scripts with inline documentation

---

**Status**: ✅ Code production-ready, waiting for PKP signing network recovery

**Last Updated**: 2025-11-17
