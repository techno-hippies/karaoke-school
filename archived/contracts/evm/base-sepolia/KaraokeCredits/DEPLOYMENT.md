# KaraokeCreditsV1 Deployment Guide

**Network**: Base Sepolia (Testnet)
**Chain ID**: 84532
**RPC**: https://sepolia.base.org
**Explorer**: https://sepolia.basescan.org

## Overview

KaraokeCreditsV1 manages the credit economy for user-generated karaoke segments. Users purchase credits with USDC (via Particle Network) or ETH, then spend credits to unlock 30-second karaoke segments from copyrighted songs.

### Key Features
- **Flexible Payments**: USDC (preferred) or ETH via Particle Network
- **Bulk Discounts**: 4 default packages (1, 10, 20, 50 credits)
- **Permanent Ownership**: Once unlocked, segments are owned forever
- **Deduplication**: Prevents charging for songs available free in SongCatalogV1
- **PKP Integration**: Trusted PKP can grant free credits (anti-botnet)

## Prerequisites

1. **Deployer Wallet**:
   - Private key with ETH on Base Sepolia
   - Get testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

2. **Treasury Address**:
   - Separate wallet to receive USDC/ETH payments
   - Should be a secure multisig or cold wallet

3. **Lit Protocol PKP**:
   - PKP address from your Lit Protocol setup
   - Used to grant free credits and validate operations

4. **Environment Variables**:
   ```bash
   export PRIVATE_KEY=0x...                    # Deployer private key
   export TREASURY_ADDRESS=0x...               # Payment recipient
   export PKP_ADDRESS=0x...                    # Lit PKP address
   export SONG_CATALOG_ADDRESS=0x...           # SongCatalogV1 (optional)
   export BASESCAN_API_KEY=...                 # For verification
   ```

## Deployment

### Step 1: Deploy Contract

```bash
cd contracts

# Deploy to Base Sepolia
forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

**Output Example**:
```
=== Deployment Complete ===
KaraokeCreditsV1 deployed to: 0x1234567890abcdef...
Owner: 0xYourAddress...
Package Count: 4
```

### Step 2: Set SongCatalog Address (If Not Set During Deployment)

```bash
export CREDITS_ADDRESS=0x...  # From deployment output

cast send $CREDITS_ADDRESS \
  "setSongCatalog(address)" \
  $SONG_CATALOG_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Step 3: Verify Deployment

```bash
# Check owner
cast call $CREDITS_ADDRESS "owner()(address)" --rpc-url https://sepolia.base.org

# Check treasury
cast call $CREDITS_ADDRESS "treasury()(address)" --rpc-url https://sepolia.base.org

# Check PKP
cast call $CREDITS_ADDRESS "trustedPKP()(address)" --rpc-url https://sepolia.base.org

# Check USDC token
cast call $CREDITS_ADDRESS "usdcToken()(address)" --rpc-url https://sepolia.base.org

# Check SongCatalog
cast call $CREDITS_ADDRESS "songCatalog()(address)" --rpc-url https://sepolia.base.org

# View packages
cast call $CREDITS_ADDRESS "getAllPackages()(tuple(uint16,uint256,uint256,bool)[])" \
  --rpc-url https://sepolia.base.org
```

## Default Credit Packages

| Package | Credits | USDC Price | ETH Price | Discount |
|---------|---------|------------|-----------|----------|
| 0       | 1       | $0.50      | 0.0002    | -        |
| 1       | 10      | $4.50      | 0.0018    | 10%      |
| 2       | 20      | $8.00      | 0.0032    | 20%      |
| 3       | 50      | $17.50     | 0.007     | 30%      |

## Integration with Particle Network

### Frontend Flow

1. **User Clicks "Purchase Credits"**:
   ```typescript
   import { ParticleAuth } from '@particle-network/auth'
   import { UniversalProvider } from '@particle-network/universal-sdk'

   // Initialize Particle
   const particle = new ParticleAuth({
     projectId: 'your-project-id',
     clientKey: 'your-client-key',
     chain: 'base',
   })

   // Connect user
   const userInfo = await particle.login({ preferredAuthType: 'google' })
   ```

2. **Purchase Credits with USDC**:
   ```typescript
   import { createPublicClient, createWalletClient, parseUnits } from 'viem'
   import { base } from 'viem/chains'

   const CREDITS_CONTRACT = '0x...'  // From deployment
   const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

   // 1. Approve USDC spend
   await walletClient.writeContract({
     address: USDC_ADDRESS,
     abi: ERC20_ABI,
     functionName: 'approve',
     args: [CREDITS_CONTRACT, parseUnits('4.50', 6)], // Package 1 price
   })

   // 2. Purchase credits
   await walletClient.writeContract({
     address: CREDITS_CONTRACT,
     abi: KARAOKE_CREDITS_ABI,
     functionName: 'purchaseCreditsUSDC',
     args: [1], // Package ID
   })
   ```

3. **Check Credit Balance**:
   ```typescript
   const balance = await publicClient.readContract({
     address: CREDITS_CONTRACT,
     abi: KARAOKE_CREDITS_ABI,
     functionName: 'getCredits',
     args: [userAddress],
   })

   console.log(`User has ${balance} credits`)
   ```

4. **Use Credit to Unlock Segment**:
   ```typescript
   // User clicks "Unlock" on a segment
   await walletClient.writeContract({
     address: CREDITS_CONTRACT,
     abi: KARAOKE_CREDITS_ABI,
     functionName: 'useCredit',
     args: [
       1,             // source: Genius
       '378195',      // songId: geniusId as string
       'chorus-1'     // segmentId
     ],
   })

   // Segment is now permanently owned!
   ```

5. **Check Segment Ownership**:
   ```typescript
   const owned = await publicClient.readContract({
     address: CREDITS_CONTRACT,
     abi: KARAOKE_CREDITS_ABI,
     functionName: 'ownsSegment',
     args: [userAddress, 1, '378195', 'chorus-1'],
   })

   // Show "Start" button if owned, "1 Credit" if locked
   ```

## Deduplication Logic

The contract automatically prevents users from paying for segments of songs that exist in SongCatalogV1:

```solidity
// Checks during useCredit()
if (source == Genius && geniusId > 0) {
  bool existsInCatalog = SongCatalogV1(songCatalog).songExistsByGeniusId(geniusId);
  require(!existsInCatalog, "Song available for free in Native catalog");
}
```

**Frontend Example**:
```typescript
// Before showing segment picker, check if song is free
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

## Admin Operations

### Update Credit Packages

```bash
# Update package 0 (1 credit)
cast send $CREDITS_ADDRESS \
  "updatePackage(uint8,uint16,uint256,uint256,bool)" \
  0 \
  1 \
  750000 \
  0.0003ether \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Add New Package

```bash
# Add package 4: 100 credits for $30
cast send $CREDITS_ADDRESS \
  "addPackage(uint16,uint256,uint256)" \
  100 \
  30000000 \
  0.012ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Grant Free Credits (PKP Only)

```bash
# PKP grants 2 free credits to new user
cast send $CREDITS_ADDRESS \
  "grantCredits(address,uint16,string)" \
  $USER_ADDRESS \
  2 \
  "first_generation_bonus" \
  --private-key $PKP_PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Update Treasury Address

```bash
cast send $CREDITS_ADDRESS \
  "setTreasury(address)" \
  $NEW_TREASURY_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Emergency Pause

```bash
# Pause contract
cast send $CREDITS_ADDRESS "pause()" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org

# Unpause contract
cast send $CREDITS_ADDRESS "unpause()" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

## Testing

### Test Credit Purchase (USDC)

```bash
# 1. Get test USDC from faucet
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "mint(address,uint256)" \
  $YOUR_ADDRESS \
  10000000 \
  --rpc-url https://sepolia.base.org

# 2. Approve USDC spend
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" \
  $CREDITS_ADDRESS \
  500000 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org

# 3. Purchase 1 credit
cast send $CREDITS_ADDRESS \
  "purchaseCreditsUSDC(uint8)" \
  0 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org

# 4. Check balance
cast call $CREDITS_ADDRESS \
  "getCredits(address)(uint256)" \
  $YOUR_ADDRESS \
  --rpc-url https://sepolia.base.org
```

### Test Credit Purchase (ETH)

```bash
# Purchase package 0 with ETH
cast send $CREDITS_ADDRESS \
  "purchaseCreditsETH(uint8)" \
  0 \
  --value 0.0002ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Test Segment Unlock

```bash
# Use 1 credit to unlock a segment
cast send $CREDITS_ADDRESS \
  "useCredit(uint8,string,string)" \
  1 \
  "378195" \
  "chorus-1" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org

# Check ownership
cast call $CREDITS_ADDRESS \
  "ownsSegment(address,uint8,string,string)(bool)" \
  $YOUR_ADDRESS \
  1 \
  "378195" \
  "chorus-1" \
  --rpc-url https://sepolia.base.org
```

## Monitoring

### Key Events

```typescript
// Listen for credit purchases
creditsContract.watchEvent.CreditsPurchased({
  onLogs: (logs) => {
    logs.forEach(log => {
      console.log(`User ${log.args.user} purchased ${log.args.creditAmount} credits`)
    })
  }
})

// Listen for segment unlocks
creditsContract.watchEvent.SegmentUnlocked({
  onLogs: (logs) => {
    logs.forEach(log => {
      console.log(`User ${log.args.user} unlocked segment ${log.args.segmentId}`)
    })
  }
})
```

## Security Considerations

1. **Treasury Security**: Use a multisig or hardware wallet for treasury
2. **PKP Access**: Protect PKP private key (used for granting free credits)
3. **Price Updates**: Monitor ETH/USDC prices and update packages accordingly
4. **Rate Limiting**: Consider implementing frontend rate limiting
5. **Deduplication**: Always check SongCatalogV1 before charging credits

## Mainnet Deployment

When ready for production (Base mainnet):

1. **Update USDC Address**: Use Base mainnet USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
2. **Update RPC**: `https://mainnet.base.org`
3. **Update Prices**: Adjust ETH prices based on current market rates
4. **Security Audit**: Consider audit before mainnet deployment
5. **Treasury Setup**: Use secure multisig (e.g., Safe)

## Troubleshooting

### "Song available for free in Native catalog"
- User is trying to unlock a segment for a song that exists in SongCatalogV1
- Frontend should redirect to free version instead

### "Insufficient credits"
- User needs to purchase credits first
- Show PurchaseCreditsDialog

### "USDC transfer failed"
- User hasn't approved USDC spend
- Call `approve()` on USDC contract first

### "Segment already owned"
- User already unlocked this segment
- Update frontend to show "Start" instead of "Unlock"

## Support

- Contract Source: `/contracts/KaraokeCredits/KaraokeCreditsV1.sol`
- Deployment Script: `/contracts/KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol`
- BaseScan: https://sepolia.basescan.org/address/[CONTRACT_ADDRESS]

## License

MIT
