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

## Contracts

- **SongEvents**: Song registration events (~28k gas)
- **SegmentEvents**: Segment processing events (~30k gas)
- **PerformanceGrader**: PKP-verified grading (~48k gas)
- **AccountEvents**: Account tracking (optional, ~25k gas)

See contract source files in `src/events/` for full documentation.
