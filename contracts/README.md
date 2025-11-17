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
PRIVATE_KEY=0x... TRUSTED_PKP_ADDRESS=0x... npx tsx deploy-<contract-name>.ts
```

**Example:**
```bash
PRIVATE_KEY=0x7ad3639f0de041ea9cf7bbcd865180383eb85a65fd333a955e9d9d0ab0184235 \
TRUSTED_PKP_ADDRESS=0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7 \
npx tsx deploy-karaoke-events.ts
```

**Why this pattern?**
- `forge build --via-ir` generates artifacts for ethers.js (solves stack depth issues)
- Ethers deployment scripts auto-save ABIs to `../subgraph/abis/` for indexing
- Explicit env vars ensure subprocess gets them (`source` doesn't work with npx)

See `DEPLOYMENT.md` for detailed troubleshooting and common errors.

## Deployed Contracts (Lens Testnet)

> **Chain ID**: 37111 | **RPC**: https://rpc.testnet.lens.xyz

- **ExerciseEvents**: `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` ✅
  - PKP-gated grading for “Say It Back” + multiple choice attempts
  - Emits `SayItBackAttemptGraded` / `MultipleChoiceAttemptGraded`
  - Trusted PKP: `0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7`

> Looking for the old `PerformanceGrader` flow? The Solidity sources, tests,
> and scripts now live in `contracts/archived/performance-grader/` for
> historical reference only.

- **KaraokeEvents**: `0x51aA6987130AA7E4654218859E075D8e790f4409` ✅
  - Clip registration, processing, song encryption, and performance grading
  - Emits `ClipRegistered`, `ClipProcessed`, `SongEncrypted`, `ClipToggled`, `KaraokePerformanceGraded`
  - PKP-gated performance grading for clips and full songs
  - Trusted PKP: `0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7`
  - Deployed 2025-01-13 via ethers.js (renamed from ClipEvents)

- **SongEvents**: `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` ✅
  - Song registration events (~28k gas)

- **TranslationEvents**: `0x4aE979A4f115d734670403e644d83d4C695f9c58` ✅
  - Translation tracking events (~25k gas)
  - Deployed 2025-11-03 via ethers.js

- **AccountEvents**: `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` ✅
  - Account tracking (optional, ~25k gas)

See contract source files in `src/events/` for full documentation.
