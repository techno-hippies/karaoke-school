# V2 Contracts Deployment Guide

## Prerequisites

1. Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install dependencies:
```bash
forge install foundry-rs/forge-std
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your private key
```

## Deployment Steps

### 1. Deploy All Contracts (Recommended)

Deploy all contracts in correct dependency order:

```bash
# Lens Testnet (zkSync)
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:Deploy \
  --rpc-url lens_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --zksync

# Or using .env file
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:Deploy \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync
```

Contract addresses will be saved to `deployments/latest.env`.

### 2. Deploy Individual Contracts

For testing or incremental deployment:

```bash
# 1. Artist Registry (no dependencies)
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeployArtistRegistry \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync

# 2. Song Registry (requires ARTIST_REGISTRY in .env)
export ARTIST_REGISTRY=0x...
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeploySongRegistry \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync

# 3. Segment Registry (requires SONG_REGISTRY in .env)
export SONG_REGISTRY=0x...
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeploySegmentRegistry \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync

# 4. Performance Registry (requires SEGMENT_REGISTRY in .env)
export SEGMENT_REGISTRY=0x...
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeployPerformanceRegistry \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync

# 5. Student Profile (no dependencies)
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeployStudentProfile \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync

# 6. Leaderboard (no dependencies)
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:DeployLeaderboard \
  --rpc-url lens_testnet \
  --broadcast \
  --zksync
```

## Post-Deployment

### 1. Verify Contracts

```bash
# Verify on Lens Block Explorer
forge verify-contract <CONTRACT_ADDRESS> \
  src/core/ArtistRegistryV1.sol:ArtistRegistryV1 \
  --chain lens_testnet \
  --etherscan-api-key $LENSSCAN_API_KEY
```

### 2. Configure Authorizations

Authorize the master-pipeline PKP to register artists/songs:

```bash
# Get PKP address
export PKP_ADDRESS=0x254AA0096C9287a03eE62b97AA5643A2b8003657

# Authorize in each contract
cast send $ARTIST_REGISTRY \
  "setAuthorized(address,bool)" \
  $PKP_ADDRESS \
  true \
  --rpc-url lens_testnet \
  --private-key $PRIVATE_KEY

cast send $SONG_REGISTRY \
  "setAuthorized(address,bool)" \
  $PKP_ADDRESS \
  true \
  --rpc-url lens_testnet \
  --private-key $PRIVATE_KEY

# Repeat for other contracts...
```

### 3. Test Basic Functionality

```bash
# Test ArtistRegistry
cast call $ARTIST_REGISTRY "getTotalArtists()" --rpc-url lens_testnet

# Register test artist
cast send $ARTIST_REGISTRY \
  "registerArtist(uint32,address,string,address)" \
  498 \
  $PKP_ADDRESS \
  "beyoncetest" \
  0x0000000000000000000000000000000000000001 \
  --rpc-url lens_testnet \
  --private-key $PRIVATE_KEY

# Verify registration
cast call $ARTIST_REGISTRY "artistExists(uint32)" 498 --rpc-url lens_testnet
```

## Integration with Master Pipeline

After deployment, update master-pipeline configuration:

```bash
# Copy addresses to master-pipeline
cp deployments/latest.env ../master-pipeline/.env.contracts

# Or manually update master-pipeline/.env
ARTIST_REGISTRY=0x...
SONG_REGISTRY=0x...
SEGMENT_REGISTRY=0x...
PERFORMANCE_REGISTRY=0x...
STUDENT_PROFILE=0x...
LEADERBOARD=0x...
```

## Deployment Order

**Critical:** Contracts must be deployed in this order due to constructor dependencies:

1. **ArtistRegistryV1** (no dependencies)
2. **SongRegistryV1** (requires ArtistRegistry address)
3. **SegmentRegistryV1** (requires SongRegistry address)
4. **PerformanceRegistryV1** (requires SegmentRegistry address)
5. **StudentProfileV1** (no dependencies)
6. **LeaderboardV1** (no dependencies)

## Gas Costs

Estimated deployment costs on Lens Testnet:

| Contract | Gas | Cost (at 0.5 gwei) |
|----------|-----|--------------------|
| ArtistRegistry | ~800k | ~$0.02 |
| SongRegistry | ~1.2M | ~$0.03 |
| SegmentRegistry | ~1.1M | ~$0.03 |
| PerformanceRegistry | ~1.3M | ~$0.03 |
| StudentProfile | ~1.0M | ~$0.02 |
| Leaderboard | ~1.5M | ~$0.04 |
| **Total** | **~6.9M** | **~$0.17** |

## Troubleshooting

### "Insufficient funds" error
Ensure deployer address has enough ETH on Lens Testnet.

### "Contract creation failed" error
Check that dependencies are deployed first (see Deployment Order above).

### "zkSync verification failed"
Ensure you're using `--zksync` flag and correct profile (`FOUNDRY_PROFILE=zksync`).

### Contract not showing on block explorer
Wait 1-2 minutes for indexing, then verify manually via block explorer UI.

## Next Steps

After successful deployment:

1. ✅ Update `deployments/latest.env` with addresses
2. ✅ Authorize PKP in all contracts
3. ✅ Test basic functionality
4. ✅ Configure master-pipeline with contract addresses
5. ✅ Run end-to-end test with pipeline
6. ✅ Document deployment in README.md

## Mainnet Deployment

When ready for mainnet:

```bash
# Use lens_mainnet RPC
FOUNDRY_PROFILE=zksync forge script script/Deploy.s.sol:Deploy \
  --rpc-url lens_mainnet \
  --broadcast \
  --zksync \
  --verify

# IMPORTANT: Triple-check all parameters before mainnet deployment
```
