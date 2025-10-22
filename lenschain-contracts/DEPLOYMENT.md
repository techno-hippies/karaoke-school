# Deployment Summary - Lens Chain Testnet

**Network:** Lens Chain Testnet
**RPC URL:** https://rpc.testnet.lens.xyz
**Chain ID:** 37111
**Explorer:** https://explorer.testnet.lens.xyz
**Deployer:** 0x0C6433789d14050aF47198B2751f6689731Ca79C
**Deployment Date:** 2025-10-22

## How to Deploy

### Prerequisites
```bash
# Ensure you have forge installed with ZKsync support
forge --version

# Configure environment
cp .env.example .env
# Fill in: PRIVATE_KEY, TRUSTED_PKP_ADDRESS, LENS_CHAIN_RPC_URL
```

### Compile Contracts
```bash
forge clean
forge build --zksync
```

### Deploy Individual Contracts

```bash
# Deploy SongEvents
forge create --zksync \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  src/events/SongEvents.sol:SongEvents

# Deploy SegmentEvents
forge create --zksync \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  src/events/SegmentEvents.sol:SegmentEvents

# Deploy PerformanceGrader (requires PKP address)
forge create --zksync \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  src/events/PerformanceGrader.sol:PerformanceGrader \
  --constructor-args $TRUSTED_PKP_ADDRESS

# Deploy AccountEvents
forge create --zksync \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  src/events/AccountEvents.sol:AccountEvents
```

### Verify Contracts (Optional)

```bash
forge verify-contract \
  --zksync \
  --chain-id 37111 \
  --verifier zksync \
  --verifier-url https://block-explorer-verify.testnet.lens.dev/contract_verification \
  --watch \
  <CONTRACT_ADDRESS> \
  src/events/SongEvents.sol:SongEvents
```

## Deployed Contracts

### SongEvents
- **Address:** `0x912fA332604d7cA38a87446f2f7c0927EFB5dD3d`
- **Transaction:** `0x411078d898d34399468bab6c83ffc02e33e1df278e590d692baef1644ac7bba3`
- **Explorer:** https://explorer.testnet.lens.xyz/address/0x912fA332604d7cA38a87446f2f7c0927EFB5dD3d

### SegmentEvents
- **Address:** `0x4b410DA7e0D87fB0e4116218e3319FF9acAd82c8`
- **Transaction:** `0x23bf099441b91413f9a43a1aede9df4ce828294edd790a04aa8673387ec1c0a9`
- **Explorer:** https://explorer.testnet.lens.xyz/address/0x4b410DA7e0D87fB0e4116218e3319FF9acAd82c8

### PerformanceGrader
- **Address:** `0x14d17Fe89Ae9ED52243A03A1729F7a2413EAc2a0`
- **Transaction:** `0x85f802f40cbd258e898e785ffdecde01523beca097c7f436dbf67701319ce6ee`
- **Explorer:** https://explorer.testnet.lens.xyz/address/0x14d17Fe89Ae9ED52243A03A1729F7a2413EAc2a0
- **Trusted PKP:** `0x3345Cb3A0CfEcb47bC3D638e338D26c870FA2b23`

### AccountEvents
- **Address:** `0xb31b8abB319Ee6AB6f0706E0086bEa310E25da22`
- **Transaction:** `0xb7fe5bc18888f6722b19f027ca2b8def4c64dfe6231de9d7311341817aef35dc`
- **Explorer:** https://explorer.testnet.lens.xyz/address/0xb31b8abB319Ee6AB6f0706E0086bEa310E25da22

## Next Steps

1. **Update master-pipeline/.env** with contract addresses:
   ```bash
   SONG_EVENTS_ADDRESS=0x912fA332604d7cA38a87446f2f7c0927EFB5dD3d
   SEGMENT_EVENTS_ADDRESS=0x4b410DA7e0D87fB0e4116218e3319FF9acAd82c8
   PERFORMANCE_GRADER_ADDRESS=0x14d17Fe89Ae9ED52243A03A1729F7a2413EAc2a0
   ACCOUNT_EVENTS_ADDRESS=0xb31b8abB319Ee6AB6f0706E0086bEa310E25da22
   ```

2. **Update song/segment creation scripts** to emit events after Grove upload

3. **Set up The Graph subgraph**:
   - Create subgraph schema with Song, Segment, Performance entities
   - Write event handlers/mappings
   - Deploy to The Graph Studio
   - Point to these contract addresses

4. **Update frontend** to query subgraph instead of direct contract queries
