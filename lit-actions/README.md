# Lit Actions - Karaoke School

**AI-powered exercise grading for karaoke language learning**

---

## Structure

```
lit-actions/
├── actions/
│   ├── karaoke-grader-v1.js    # Aggregate performance grader
│   └── exercise-grader-v1.js   # Line-level exercise grader
├── scripts/
│   ├── setup.ts                # Complete deployment workflow
│   ├── upload-action.ts        # Upload to IPFS via Pinata
│   ├── add-permission.ts       # Add PKP permissions
│   ├── encrypt-key.ts          # Encrypt API keys
│   ├── verify.ts               # Verify keys & permissions
│   ├── mint-pkp.ts             # Mint new PKP
│   └── check-balance.ts        # Check wallet balance
├── tests/
│   ├── shared/env.ts           # Centralized config (Env module)
│   ├── karaoke/                # Karaoke grader tests
│   ├── exercise/               # Exercise grader tests
│   └── fixtures/               # Test audio files
├── keys/{dev,test}/            # Encrypted API keys (git ignored)
├── cids/{dev,test}.json        # Action CIDs per environment
├── output/                     # PKP credentials, auth storage
└── config/lit-envs.json        # Environment configuration
```

---

## Quick Start

### Prerequisites

```bash
cd lit-actions
bun install

# Set environment variables
cp .env.example .env
# Edit with: VOXTRAL_API_KEY, OPENROUTER_API_KEY, PINATA_JWT, PRIVATE_KEY
```

### Run Tests

```bash
# Load environment
set -a && source .env && set +a

# Karaoke grader (full flow with signing)
LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-grader.ts

# Exercise grader
LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-say-it-back.ts
```

### Deploy New Version

```bash
# Complete workflow (upload, add permission, encrypt keys)
bun scripts/setup.ts karaoke
bun scripts/setup.ts exercise
bun scripts/setup.ts --all

# Or individual steps:
bun scripts/upload-action.ts karaoke
bun scripts/add-permission.ts QmXxx...
bun scripts/encrypt-key.ts --action=karaoke
bun scripts/verify.ts
```

---

## Networks & Environments

| Env | Lit Network | Key Folder | Notes |
|-----|-------------|------------|-------|
| naga-dev | nagaDev | keys/dev/ | Free, for development |
| naga-test | nagaTest | keys/test/ | Paid, requires tstLPX |

Set via `LIT_NETWORK` env var or defaults to `naga-dev`.

### Contracts (Lens Testnet - 37111)

```typescript
const CONTRACTS = {
  KaraokeEvents: "0x51aA6987130AA7E4654218859E075D8e790f4409",
  ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832"
}
```

---

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup.ts` | Full deployment workflow | `bun scripts/setup.ts karaoke` |
| `upload-action.ts` | Upload to IPFS | `bun scripts/upload-action.ts karaoke` |
| `add-permission.ts` | Add PKP permission | `bun scripts/add-permission.ts QmXxx...` |
| `encrypt-key.ts` | Encrypt API keys | `bun scripts/encrypt-key.ts` |
| `verify.ts` | Verify setup | `bun scripts/verify.ts --all` |
| `mint-pkp.ts` | Mint new PKP | `bun scripts/mint-pkp.ts` |

---

## Testing

### Environment Variables

```bash
# Skip transaction (test grading only)
KARAOKE_SKIP_TX=true bun tests/karaoke/test-karaoke-grader.ts

# Debug stages
KARAOKE_TX_STAGE=simulate  # Test contract simulation
KARAOKE_TX_STAGE=prepare   # Test tx preparation

# Override transcript (skip STT)
KARAOKE_TRANSCRIPT_OVERRIDE_PATH=tests/fixtures/transcript.txt

# Use local code instead of IPFS
USE_LOCAL_CODE=1
```

### Test Files

- `tests/karaoke/test-karaoke-grader.ts` - Full karaoke flow
- `tests/karaoke/test-karaoke-stt.ts` - STT only
- `tests/karaoke/test-karaoke-gemini.ts` - Gemini grading only
- `tests/exercise/test-exercise-grader-say-it-back.ts` - Say It Back
- `tests/exercise/test-exercise-grader-trivia-quiz.ts` - Multiple choice
- `tests/exercise/test-exercise-grader-translation-quiz.ts` - Translation

---

## Troubleshooting

### "Access control conditions check failed"
Keys encrypted for different CID. Re-encrypt:
```bash
bun scripts/encrypt-key.ts
```

### "PKP signing timeout"
Use workarounds:
```bash
KARAOKE_SKIP_TX=true bun tests/karaoke/test-karaoke-grader.ts
```

### Missing keys
Verify setup:
```bash
bun scripts/verify.ts
```

---

## Security

### API Key Encryption
- Keys encrypted with Lit Protocol
- Access control tied to specific CID
- Old CIDs cannot decrypt new keys
- Decryption inside Lit nodes only

### PKP Permissions
- Only permitted CIDs can use PKP
- Contracts only accept trusted PKP signatures

---

**Last Updated**: 2025-11-22
