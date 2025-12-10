# Lens Chain Event Contracts

Minimal event-only contracts for karaoke-school V2 architecture on Lens Chain (ZKsync).

## Architecture

- **Storage**: Grove (decentralized, immutable/mutable)
- **Discovery**: Event contracts → The Graph subgraph
- **Chain**: Lens Chain testnet/mainnet (ZKsync-based)

## Setup

### 1. Configure Environment

Ensure `.env` exists with:
```bash
PRIVATE_KEY=0x...
TRUSTED_PKP_ADDRESS=0x...
LENS_CHAIN_RPC_URL=https://rpc.testnet.lens.xyz
```

### 2. Compile Contracts

**CRITICAL: Must use `--via-ir` to avoid "stack too deep" errors:**

```bash
forge build --via-ir --force
```

### 3. Deploy to Lens Chain

**CRITICAL: Use explicit env vars, NOT `source .env` (subprocess doesn't inherit):**

```bash
PRIVATE_KEY=0x... TRUSTED_PKP_ADDRESS=0x... npx tsx scripts/deploy-<contract-name>.ts
```

**Why this pattern?**
- `forge build --via-ir` generates artifacts for ethers.js (solves stack depth issues)
- Ethers deployment scripts auto-save ABIs to `../subgraph/abis/` for indexing
- Explicit env vars ensure subprocess gets them (`source` doesn't work with npx)

See `DEPLOYMENT.md` for detailed troubleshooting and common errors.

## Deployed Contracts (Lens Testnet)

> **Chain ID**: 37111 | **RPC**: https://rpc.testnet.lens.xyz

| Contract | Address | Purpose |
|----------|---------|---------|
| **KaraokeEvents** | `0xd942eB51C86c46Db82678627d19Aa44630F901aE` | Clip lifecycle + karaoke grading (V6) |
| **ExerciseEvents** | `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` | FSRS study cards |
| **TranslationEvents** | `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` | Multi-language translations |
| **AccountEvents** | `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` | User account management |

### KaraokeEvents

The main contract handling clip registration and karaoke grading:
- `ClipRegistered` - New clip added
- `ClipProcessed` - Audio/alignment processed
- `SongEncrypted` - Full song encrypted for subscribers
- `ClipToggled` - Enable/disable clip
- `ClipLocalizationUpdated` - 12-language JSON localizations
- `KaraokeSessionStarted` - Live karaoke session begins
- `KaraokeLineGraded` - Line-by-line grading
- `KaraokeSessionEnded` - Session complete
- `KaraokePerformanceGraded` - Final performance score

PKP-gated grading functions require trusted PKP: `0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379`

### ExerciseEvents

FSRS spaced repetition study cards:
- `TranslationQuestionRegistered` - Translation exercise
- `TriviaQuestionRegistered` - Trivia exercise
- `SayItBackAttemptGraded` - Audio response graded
- `MultipleChoiceAttemptGraded` - MCQ graded

### TranslationEvents

Multi-language translation tracking:
- `TranslationAdded` - New translation
- `TranslationUpdated` - Translation updated
- `TranslationToggled` - Enable/disable translation

### AccountEvents

User account lifecycle:
- `AccountCreated` - New account
- `AccountMetadataUpdated` - Profile update
- `AccountVerified` - Verification status

## Directory Structure

```
contracts/
├── src/events/           # Solidity contracts
│   ├── KaraokeEvents.sol     # Clip lifecycle + grading
│   ├── ExerciseEvents.sol    # FSRS study cards
│   ├── TranslationEvents.sol # Translations
│   └── AccountEvents.sol     # Accounts
├── script/               # Foundry deploy scripts (.sol)
├── scripts/              # TypeScript deploy scripts
├── test/                 # Foundry tests
└── lib/forge-std/        # Foundry stdlib
```

See contract source files in `src/events/` for full documentation.
