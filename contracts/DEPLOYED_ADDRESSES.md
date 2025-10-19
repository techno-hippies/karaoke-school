# Deployed Contract Addresses

## Base Sepolia (Chain ID: 84532)
**Network**: Base Sepolia Testnet
**RPC**: https://sepolia.base.org
**Explorer**: https://sepolia.basescan.org

### KaraokeCreditsV1
- **Address**: `0xb072a10814eE18bafe9725F171450FD6188397B6`
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Treasury**: `0x8aAc65DCC0E2CB4e3EF63DcF85Ce2A1Ff1b93E8B`
- **Trusted PKP**: `0x254aAB1EF1ad6f95d93b557cA6dd3ef2E6f5ce52`
- **USDC Token**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia mock)
- **SongCatalog**: `0x88996135809cc745E6d8966e3a7A01389C774910` (Lens Testnet - for deduplication)
- **BaseScan**: https://sepolia.basescan.org/address/0xb072a10814ee18bafe9725f171450fd6188397b6

#### Credit Packages
- **Package 0**: 1 credit - $0.50 USDC / 0.0002 ETH
- **Package 1**: 5 credits - $2.50 USDC / 0.001 ETH
- **Package 2**: 20 credits - $10.00 USDC / 0.004 ETH

### KaraokeSegmentRegistryV1
- **Address**: `0xd74F1874B1346Ce1a4958FA5304c376bE0209Fa8`
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Trusted Processor (PKP)**: `0x254aAB1EF1ad6f95d93b557cA6dd3ef2E6f5ce52`

### ArtistRegistryV1 (Deprecated)
- **Address**: `0x8370c98114B52ea294ABd65ACF113414B38525d0`
- **Status**: ⚠️ **DEPRECATED** - Use V2 instead
- **Bug**: `updateArtist()` doesn't check for mapping collisions
- **BaseScan**: https://sepolia.basescan.org/address/0x8370c98114b52ea294abd65acf113414b38525d0

### ArtistRegistryV2 (Current)
- **Address**: `0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7`
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **BaseScan**: https://sepolia.basescan.org/address/0x81ce49c16d2bf384017c2bca7fddacb8a15decc7
- **Purpose**: Maps Genius artist IDs to PKP addresses and Lens profiles
- **V2 Improvements**:
  - ✅ Fixed `updateArtist()` mapping collision bug
  - ✅ Added `lensAccountAddress != address(0)` validation
  - ✅ Improved NatSpec documentation
- **Features**:
  - Minimal on-chain storage (~$150 for 10k artists)
  - Rich metadata in Lens Account Metadata
  - Supports MANUAL and GENERATED profiles
  - Reverse lookups (PKP/Lens handle → geniusId)
  - Subgraph-ready events
- **Deployed**: 2025-01-19
- **Gas Used**: 2,410,206 gas (~0.0024 ETH)

### KaraokeCatalogV2 (Current)
- **Address**: `0xe43A62838f70384Ed7a4C205E70d20f56d1Da711`
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Trusted Processor (PKP)**: `0x254aAB1EF1ad6f95d93b557cA6dd3ef2E6f5ce52`
- **Treasury**: `0x8aAc65DCC0E2CB4e3EF63DcF85Ce2A1Ff1b93E8B`
- **BaseScan**: https://sepolia.basescan.org/address/0xe43a62838f70384ed7a4c205e70d20f56d1da711
- **Purpose**: Main catalog for karaoke songs with segments and metadata
- **Features**:
  - ✅ Batch segment processing (`processSegmentsBatch`)
  - ✅ Recent songs query (`getRecentSongs`) - up to 50 newest songs
  - ✅ Translation support (multi-language lyrics)
  - ✅ Additive metadata updates (`sectionsUri` + `alignmentUri`)
  - ✅ Song deletion (`deleteSong`) - testnet utility
  - ✅ Enhanced event tracking (SectionsUriUpdated, AlignmentUriUpdated, SongDeleted)
- **Deployed**: 2025-10-19
- **Previous Version**: `0x40A2a5bbD54ebB5DB84252c542b4e1BebFf37454` (V2.1 - deprecated)

## Lens Testnet (Chain ID: 37111)
**Network**: Lens Testnet (zkSync)
**RPC**: https://rpc.testnet.lens.xyz
**Explorer**: https://explorer.testnet.lens.xyz

### SongCatalogV1
- **Address**: `0x88996135809cc745E6d8966e3a7A01389C774910`
- **Purpose**: Native copyright-free songs with word-level timestamps

## Configuration Updated

### Frontend (`app/src/config/contracts.ts`)
✅ Updated with deployed addresses

### Lit Actions (`lit-actions/src/karaoke/contracts.config.js`)
✅ Created with contract addresses

### ABIs Exported (`app/src/abi/`)
✅ KaraokeCreditsV1.abi.json
✅ KaraokeSegmentRegistryV1.abi.json

## Deployment Details

**Latest Deployment**: 2025-10-11
**Gas Used**:
- KaraokeCreditsV1 (v2 - USDC $2.50 package): 2,581,450 gas (~0.0026 ETH)
- KaraokeSegmentRegistryV1: 3,083,329 gas (~0.0031 ETH)

**Broadcast Logs**:
- `/contracts/evm/base-sepolia/broadcast/DeployKaraokeCreditsV1.s.sol/84532/run-latest.json`
- `/contracts/evm/base-sepolia/broadcast/DeployKaraokeSegmentRegistryV1.s.sol/84532/run-latest.json`

## Next Steps

1. **Contracts Verified**: ✅ Automatically verified on BaseScan during deployment

2. **Test Credit Purchase** (via frontend or cast):
   ```bash
   # Test with ETH
   cast send 0xb072a10814eE18bafe9725F171450FD6188397B6 \
     "purchaseCreditsETH(uint8)" 1 \
     --value 0.001ether \
     --rpc-url https://sepolia.base.org

   # Test with USDC (approve first)
   cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
     "approve(address,uint256)" \
     0xb072a10814eE18bafe9725F171450FD6188397B6 \
     2500000 \
     --rpc-url https://sepolia.base.org

   cast send 0xb072a10814eE18bafe9725F171450FD6188397B6 \
     "purchaseCreditsUSDC(uint8)" 1 \
     --rpc-url https://sepolia.base.org
   ```

3. **Test Segment Registration** (via Lit Action):
   - User buys credits via Particle → USDC → KaraokeCreditsV1
   - User selects segment → useCredit() deducts credit
   - audio-processor-v1.js generates stems
   - Lit Action calls registerSegment() on KaraokeSegmentRegistryV1

4. **Frontend Integration**:
   - Import ABIs from `src/abi/`
   - Use addresses from `src/config/contracts.ts`
   - Test credit balance display
   - Test credit purchase flow with Particle
