# Lens Chain Event Contracts

Minimal event-only contracts for karaoke-school V2 architecture on Lens Chain (ZKsync).

## Architecture

- **Storage**: Grove (decentralized, immutable/mutable)
- **Discovery**: Event contracts → The Graph subgraph
- **Chain**: Lens Chain testnet/mainnet (ZKsync-based)

## Setup

### 1. Configure Environment

```bash
cp .env.example .env
# Fill in LENS_CHAIN_RPC_URL, PRIVATE_KEY, TRUSTED_PKP_ADDRESS
```

### 2. Compile Contracts

```bash
forge build --zksync
```

### 3. Deploy to Lens Chain

```bash
source .env
forge script script/DeployEvents.s.sol:DeployEvents \
  --rpc-url lens-testnet \
  --broadcast \
  --zksync \
  -vvvv
```

## Deployed Contracts (Lens Testnet)

> **Chain ID**: 37111 | **RPC**: https://rpc.testnet.lens.xyz

- **PerformanceGrader**: `0x788A245B9AAB4E29D0152424b72bcB8Ac7c1E260` ✅
  - PKP-verified grading (~48k gas)
  - Trusted PKP: `0x3345Cb3A0CfEcb47bC3D638e338D26c870FA2b23`

- **SongEvents**: `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` ✅
  - Song registration events (~28k gas)

- **SegmentEvents**: `0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274` ✅
  - Segment processing events (~30k gas)

- **TranslationEvents**: `0x5A49E23A5C3a034906eE0274c266A08805770C70` ✅
  - Translation tracking events (~25k gas)
  - Deployed 2025-11-03 via ethers.js

- **AccountEvents**: `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` ✅
  - Account tracking (optional, ~25k gas)

See contract source files in `src/events/` for full documentation.
