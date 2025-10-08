# KaraokeCreditsV1

**Status**: ✅ Ready to Deploy
**Network**: Base Sepolia (Testnet)
**Chain ID**: 84532

## Quick Links
- **Contract**: `KaraokeCreditsV1.sol`
- **Deployment Script**: `script/DeployKaraokeCreditsV1.s.sol`
- **Deployment Guide**: `DEPLOYMENT.md`
- **Architecture**: `../KARAOKE_ARCHITECTURE.md`

## Overview

Credit system for user-generated karaoke segments from copyrighted songs. Users purchase credits with USDC (via Particle Network) or ETH, then spend 1 credit to permanently unlock 30-second segments.

## Key Features

✅ **Flexible Payments**: USDC (preferred) or ETH
✅ **Bulk Discounts**: 4 default packages (1, 10, 20, 50 credits)
✅ **Permanent Ownership**: Segments owned forever after unlock
✅ **Deduplication**: Prevents charging for songs in SongCatalogV1
✅ **PKP Integration**: Trusted PKP can grant free credits

## Quick Deploy

```bash
export PRIVATE_KEY=0x...
export TREASURY_ADDRESS=0x...
export PKP_ADDRESS=0x...
export BASESCAN_API_KEY=...

forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Contract Interface

### User Functions

```solidity
// Purchase credits with USDC (requires approval first)
function purchaseCreditsUSDC(uint8 packageId) external

// Purchase credits with ETH
function purchaseCreditsETH(uint8 packageId) external payable

// Use 1 credit to unlock a segment (permanent)
function useCredit(uint8 source, string songId, string segmentId) external

// Check credit balance
function getCredits(address user) external view returns (uint256)

// Check segment ownership
function ownsSegment(address user, uint8 source, string songId, string segmentId)
  external view returns (bool)
```

### Admin Functions

```solidity
// Update credit packages
function updatePackage(uint8 id, uint16 credits, uint256 priceUSDC, uint256 priceETH, bool enabled)

// Add new package
function addPackage(uint16 credits, uint256 priceUSDC, uint256 priceETH)

// Update addresses
function setSongCatalog(address catalog)
function setTreasury(address treasury)
function setTrustedPKP(address pkp)
function setUSDCToken(address usdc)

// Emergency controls
function pause()
function unpause()
```

### PKP Functions

```solidity
// Grant free credits (max 10 at once)
function grantCredits(address user, uint16 amount, string reason)
```

## Default Packages

| ID | Credits | USDC Price | ETH Price | Discount |
|----|---------|------------|-----------|----------|
| 0  | 1       | $0.50      | 0.0002    | -        |
| 1  | 10      | $4.50      | 0.0018    | 10%      |
| 2  | 20      | $8.00      | 0.0032    | 20%      |
| 3  | 50      | $17.50     | 0.007     | 30%      |

## Deduplication Logic

Prevents users from paying for segments of songs that exist in SongCatalogV1:

```solidity
// During useCredit()
if (source == Genius && songCatalog != address(0)) {
  uint32 geniusId = parseUint32(songId);
  bool existsInCatalog = SongCatalogV1(songCatalog).songExistsByGeniusId(geniusId);
  require(!existsInCatalog, "Song available for free in Native catalog");
}
```

**Frontend Check** (before showing segment picker):
```typescript
const geniusId = 378195
const existsInCatalog = await songCatalogContract.read.songExistsByGeniusId([geniusId])

if (existsInCatalog) {
  // Redirect to free Native version
  router.push(`/song/native/${catalogId}`)
} else {
  // Show segment picker with credit pricing
  showSegmentPicker(geniusId)
}
```

## Integration Example

```typescript
import { createPublicClient, createWalletClient } from 'viem'
import { base } from 'viem/chains'

const CREDITS_ADDRESS = '0x...'
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// 1. Check user's credit balance
const credits = await publicClient.readContract({
  address: CREDITS_ADDRESS,
  abi: KARAOKE_CREDITS_ABI,
  functionName: 'getCredits',
  args: [userAddress],
})

// 2. Purchase credits (if needed)
if (credits === 0n) {
  // Approve USDC
  await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CREDITS_ADDRESS, parseUnits('4.50', 6)],
  })

  // Purchase 10 credits
  await walletClient.writeContract({
    address: CREDITS_ADDRESS,
    abi: KARAOKE_CREDITS_ABI,
    functionName: 'purchaseCreditsUSDC',
    args: [1], // Package ID
  })
}

// 3. Check segment ownership
const owned = await publicClient.readContract({
  address: CREDITS_ADDRESS,
  abi: KARAOKE_CREDITS_ABI,
  functionName: 'ownsSegment',
  args: [userAddress, 1, '378195', 'chorus-1'],
})

// 4. Unlock segment (if not owned)
if (!owned) {
  await walletClient.writeContract({
    address: CREDITS_ADDRESS,
    abi: KARAOKE_CREDITS_ABI,
    functionName: 'useCredit',
    args: [1, '378195', 'chorus-1'],
  })
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│         User (Particle Wallet)          │
└───────────────┬─────────────────────────┘
                │ Any crypto (BTC, SOL, ETH)
                ↓
┌─────────────────────────────────────────┐
│       Particle Universal Accounts       │
│  Swap → Bridge → USDC on Base Sepolia   │
└───────────────┬─────────────────────────┘
                │ USDC
                ↓
┌─────────────────────────────────────────┐
│        KaraokeCreditsV1 Contract        │
│  - purchaseCreditsUSDC() → mint credits │
│  - useCredit() → unlock segment         │
│  - Deduplication check (SongCatalogV1)  │
└───────────────┬─────────────────────────┘
                │
                ├─ Check: SongCatalogV1 (Lens Testnet)
                │  └─ Prevent double-charging for free songs
                │
                └─ Trigger: audio-processor-v1.js (Lit Action)
                   └─ Generate karaoke stems → store → own forever
```

## Testing

See `DEPLOYMENT.md` for comprehensive testing guide.

Quick test:
```bash
# Check balance
cast call $CREDITS_ADDRESS "getCredits(address)(uint256)" $USER --rpc-url https://sepolia.base.org

# Purchase with ETH
cast send $CREDITS_ADDRESS "purchaseCreditsETH(uint8)" 0 \
  --value 0.0002ether --private-key $PK --rpc-url https://sepolia.base.org

# Use credit
cast send $CREDITS_ADDRESS "useCredit(uint8,string,string)" 1 "378195" "chorus-1" \
  --private-key $PK --rpc-url https://sepolia.base.org
```

## Mainnet Checklist

Before deploying to Base mainnet:

- [ ] Update USDC address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- [ ] Update RPC: `https://mainnet.base.org`
- [ ] Adjust ETH prices based on current market rates
- [ ] Security audit
- [ ] Treasury multisig setup
- [ ] Update frontend contracts config
- [ ] Test credit flow end-to-end
- [ ] Monitor for 24h on testnet

## Support

- **Issues**: GitHub Issues
- **Docs**: `DEPLOYMENT.md`
- **Architecture**: `../KARAOKE_ARCHITECTURE.md`
- **Explorer**: https://sepolia.basescan.org

## License

MIT
