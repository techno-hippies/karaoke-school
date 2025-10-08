# Deployed Contract Addresses

## Base Sepolia (Chain ID: 84532)
**Network**: Base Sepolia Testnet
**RPC**: https://sepolia.base.org
**Explorer**: https://sepolia.basescan.org

### KaraokeCreditsV1
- **Address**: `0x6de183934E68051c407266F877fafE5C20F74653`
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Treasury**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Trusted PKP**: `0x254aAB1EF1ad6f95d93b557cA6dd3ef2E6f5ce52`
- **USDC Token**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia mock)
- **SongCatalog**: `0x88996135809cc745E6d8966e3a7A01389C774910` (Lens Testnet - for deduplication)

#### Credit Packages
- **Package 0**: 1 credit - $0.50 USDC / 0.0002 ETH
- **Package 1**: 10 credits - $4.50 USDC / 0.0018 ETH (10% discount)
- **Package 2**: 20 credits - $8.00 USDC / 0.0032 ETH (20% discount)
- **Package 3**: 50 credits - $17.50 USDC / 0.007 ETH (30% discount)

### KaraokeSegmentRegistryV1
- **Address**: `0xd74F1874B1346Ce1a4958FA5304c376bE0209Fa8`
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Trusted Processor (PKP)**: `0x254aAB1EF1ad6f95d93b557cA6dd3ef2E6f5ce52`

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

**Date**: 2025-10-08
**Gas Used**:
- KaraokeCreditsV1: 2,698,725 gas (~0.0027 ETH)
- KaraokeSegmentRegistryV1: 3,083,329 gas (~0.0031 ETH)

**Broadcast Logs**:
- `/contracts/evm/base-sepolia/broadcast/DeployKaraokeCreditsV1.s.sol/84532/run-latest.json`
- `/contracts/evm/base-sepolia/broadcast/DeployKaraokeSegmentRegistryV1.s.sol/84532/run-latest.json`

## Next Steps

1. **Verify Contracts on BaseScan**:
   ```bash
   cd /media/t42/th42/Code/karaoke-school-v1/contracts/evm/base-sepolia
   forge verify-contract \
     0x6de183934E68051c407266F877fafE5C20F74653 \
     KaraokeCredits/KaraokeCreditsV1.sol:KaraokeCreditsV1 \
     --chain-id 84532 \
     --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
       "0x036CbD53842c5426634e7929541eC2318f3dCF7e" \
       "0x0C6433789d14050aF47198B2751f6689731Ca79C" \
       "0x254aAB1EF1ad6f95d93b557cA6dd3ef2E6f5ce52" \
       "0x88996135809cc745E6d8966e3a7A01389C774910")
   ```

2. **Test Credit Purchase** (via frontend or cast):
   ```bash
   cast send 0x6de183934E68051c407266F877fafE5C20F74653 \
     "purchaseCreditsETH(uint8)" 0 \
     --value 0.0002ether \
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
