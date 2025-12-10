# Lit Actions - Karaoke School

AI-powered exercise grading with Lit Protocol PKP signing.

## Architecture

```
lit-actions/
├── actions/                    # Lit Action source code (JS)
│   ├── exercise-grader-v1.js   # Say It Back + Multiple Choice
│   └── karaoke-line-grader-v1.js # Line-by-line karaoke grading
│
├── cids/                       # Action CIDs per environment
│   ├── dev.json               # naga-dev (free)
│   ├── test.json              # naga-test (tstLPX)
│   └── mainnet.json           # mainnet (LIT)
│
├── keys/                       # Encrypted API keys per environment
│   ├── dev/
│   │   ├── exercise/voxtral_api_key_exercise.json
│   │   └── karaoke-line/voxtral_api_key_karaoke-line.json
│   ├── test/                   # Same structure
│   └── mainnet/                # Same structure (placeholder)
│
├── config/
│   ├── lit-envs.json          # Environment configuration
│   └── contracts.config.js    # Contract addresses
│
├── output/
│   ├── pkp-naga-dev.json      # PKP credentials (dev)
│   ├── pkp-naga-test.json     # PKP credentials (test)
│   └── lit-auth/              # Test session storage
│
├── scripts/                    # Deployment & management
│   ├── setup.ts               # Full deployment pipeline
│   ├── upload-action.ts       # Upload to IPFS
│   ├── add-permission.ts      # Add PKP permission
│   ├── encrypt-key.ts         # Encrypt API keys
│   ├── verify.ts              # Verify configuration
│   ├── mint-pkp.ts            # Mint new PKP
│   └── check-balance.ts       # Check wallet balance
│
└── tests/
    ├── shared/env.ts          # Centralized environment config
    ├── exercise/              # Exercise grader tests
    ├── karaoke/               # Karaoke grader tests
    └── fixtures/              # Test audio files
```

## Environments

| Environment | Lit Network | Cost | Status |
|-------------|-------------|------|--------|
| `naga-dev`  | nagaDev     | Free | Active |
| `naga-test` | nagaTest    | tstLPX | Ready |
| `mainnet`   | naga        | LIT  | Planned |

Set environment via `LIT_NETWORK`:
```bash
LIT_NETWORK=naga-dev bun scripts/setup.ts exercise
LIT_NETWORK=naga-test bun scripts/setup.ts exercise
```

## Quick Start

### Prerequisites

```bash
cd lit-actions
bun install

# Create .env with:
VOXTRAL_API_KEY=...
OPENROUTER_API_KEY=...
PINATA_JWT=...
PRIVATE_KEY=0x...
```

### Deploy Action

```bash
# Load environment
set -a && source .env && set +a

# Full deployment (upload → permission → encrypt)
bun scripts/setup.ts exercise
bun scripts/setup.ts karaoke-line

# Or deploy all
bun scripts/setup.ts --all
```

### Run Tests

```bash
# Exercise grader
LIT_NETWORK=naga-dev bun tests/exercise/test-exercise-grader-say-it-back.ts

# Karaoke line grader
LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-line-grader.ts
```

## Frontend Integration

The frontend (`app/src/lib/contracts/addresses.ts`) imports directly from this directory:

```typescript
import litCids from '../../../../lit-actions/cids/dev.json'
import exerciseKey from '../../../../lit-actions/keys/dev/exercise/voxtral_api_key_exercise.json'

export const LIT_ACTION_IPFS_CID = litCids.exercise
export const LIT_ACTION_VOXTRAL_KEY = exerciseKey
```

**No manual sync needed** - Vite HMR picks up changes. Just restart the dev server after deploying.

## Encryption Model

API keys are encrypted with access control conditions tied to the IPFS CID:

```javascript
accessControlConditions: [{
  conditionType: 'evmBasic',
  parameters: [':currentActionIpfsId'],
  returnValueTest: {
    comparator: '=',
    value: 'QmXxx...'  // Only this CID can decrypt
  }
}]
```

When you upload a new action version:
1. New CID is generated
2. Keys are re-encrypted for the new CID
3. Old CID can no longer decrypt

## Smart Contracts (Lens Testnet - 37111)

```typescript
// Exercise grading
ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832"

// Karaoke performance grading (V6 - JSON localizations)
KaraokeEvents: "0xd942eB51C86c46Db82678627d19Aa44630F901aE"

// Trusted PKP (naga-dev)
PKP: "0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379"
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `setup.ts` | Full deployment: upload → permission → encrypt |
| `upload-action.ts` | Upload action to IPFS via Pinata |
| `add-permission.ts` | Add CID to PKP's permitted actions |
| `encrypt-key.ts` | Encrypt API keys for a CID |
| `verify.ts` | Verify PKP permissions and key configuration |
| `mint-pkp.ts` | Mint a new PKP (one-time setup) |
| `check-balance.ts` | Check wallet tstLPX balance |

## Troubleshooting

### "Decryption failure"

The encrypted keys don't match the deployed CID. Re-deploy:

```bash
bun scripts/setup.ts exercise
```

### "PKP signing timeout"

Network congestion or rate limiting. Options:
- Wait and retry
- Skip transaction for testing: `KARAOKE_SKIP_TX=true`

### "Access control conditions check failed"

Same as decryption failure - keys encrypted for different CID.

### Missing PKP file

Mint a new PKP:

```bash
bun scripts/mint-pkp.ts
```

## Security

- **API keys**: Encrypted, only decryptable inside Lit nodes
- **PKP permissions**: Only permitted CIDs can sign
- **Contract access**: Only trusted PKP can call grading functions
- **No secrets in git**: Keys are encrypted, private keys in `.env`
