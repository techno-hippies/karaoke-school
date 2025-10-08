# Karaoke Contracts Deployment Guide

**Target Network**: Base Sepolia (Testnet)
**Date**: 2025-10-08

## 📦 Contracts Overview

| Contract | Purpose | Dependencies |
|----------|---------|--------------|
| KaraokeCreditsV1 | Credit purchase & segment ownership | USDC, SongCatalogV1 (optional) |
| KaraokeSegmentRegistryV1 | Segment metadata & asset storage | None |

Both contracts deploy to **Base Sepolia** and work together to power the user-generated karaoke system.

---

## 🔑 Prerequisites

### 1. Environment Variables

Create a `.env` file in the `contracts/` directory:

```bash
# Deployer wallet
PRIVATE_KEY=0x...                           # Has ETH on Base Sepolia

# Addresses
TREASURY_ADDRESS=0x...                      # Receives USDC/ETH payments
PKP_ADDRESS=0x...                           # Lit Protocol PKP (trusted processor)

# Optional
SONG_CATALOG_ADDRESS=0x...                  # SongCatalogV1 on Lens (for deduplication)
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia USDC

# Verification
BASESCAN_API_KEY=...                        # For contract verification
```

### 2. Fund Deployer Wallet

Get Base Sepolia ETH from faucet:
- https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Or bridge from Ethereum Sepolia

```bash
# Check balance
cast balance $YOUR_ADDRESS --rpc-url https://sepolia.base.org
```

### 3. Get API Keys

- **BaseScan API Key**: https://basescan.org/myapikey
- **Lit PKP Address**: From your Lit Protocol setup

---

## 🚀 Deployment Steps

### Option 1: Deploy Both Contracts (Recommended)

```bash
cd contracts

# Load environment variables
source .env

# Deploy KaraokeCreditsV1
echo "Deploying KaraokeCreditsV1..."
forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# Save the deployed address
export CREDITS_ADDRESS=<address_from_output>

# Deploy KaraokeSegmentRegistryV1
echo "Deploying KaraokeSegmentRegistryV1..."
forge script KaraokeSegmentRegistry/script/DeployKaraokeSegmentRegistryV1.s.sol:DeployKaraokeSegmentRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# Save the deployed address
export REGISTRY_ADDRESS=<address_from_output>
```

### Option 2: Deploy One at a Time

#### Deploy KaraokeCreditsV1

```bash
forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

**Expected Output**:
```
=== KaraokeCreditsV1 Deployment ===
Deployer: 0x...
Treasury: 0x...
Trusted PKP: 0x...
USDC Token: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
SongCatalog: 0x... (or "Not set")

=== Deployment Complete ===
KaraokeCreditsV1 deployed to: 0x1234...
Owner: 0x...
Package Count: 4
```

#### Deploy KaraokeSegmentRegistryV1

```bash
forge script KaraokeSegmentRegistry/script/DeployKaraokeSegmentRegistryV1.s.sol:DeployKaraokeSegmentRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

**Expected Output**:
```
=== KaraokeSegmentRegistryV1 Deployment ===
Deployer: 0x...
Trusted Processor (PKP): 0x...

=== Deployment Complete ===
KaraokeSegmentRegistryV1 deployed to: 0x5678...
Owner: 0x...
Trusted Processor: 0x...
```

---

## ✅ Post-Deployment Verification

### 1. Verify Contracts on BaseScan

Check that contracts are verified:
- https://sepolia.basescan.org/address/[CREDITS_ADDRESS]
- https://sepolia.basescan.org/address/[REGISTRY_ADDRESS]

### 2. Verify Configuration

```bash
# KaraokeCreditsV1
cast call $CREDITS_ADDRESS "owner()(address)" --rpc-url https://sepolia.base.org
cast call $CREDITS_ADDRESS "treasury()(address)" --rpc-url https://sepolia.base.org
cast call $CREDITS_ADDRESS "trustedPKP()(address)" --rpc-url https://sepolia.base.org
cast call $CREDITS_ADDRESS "usdcToken()(address)" --rpc-url https://sepolia.base.org
cast call $CREDITS_ADDRESS "packageCount()(uint8)" --rpc-url https://sepolia.base.org

# KaraokeSegmentRegistryV1
cast call $REGISTRY_ADDRESS "owner()(address)" --rpc-url https://sepolia.base.org
cast call $REGISTRY_ADDRESS "trustedProcessor()(address)" --rpc-url https://sepolia.base.org
cast call $REGISTRY_ADDRESS "paused()(bool)" --rpc-url https://sepolia.base.org
```

### 3. Set SongCatalog Address (If Not Set During Deployment)

```bash
cast send $CREDITS_ADDRESS \
  "setSongCatalog(address)" \
  $SONG_CATALOG_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

---

## 🧪 Test Deployment

### Test 1: Credit Purchase with ETH

```bash
# Purchase 1 credit (package 0)
cast send $CREDITS_ADDRESS \
  "purchaseCreditsETH(uint8)" \
  0 \
  --value 0.0002ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org

# Check balance
cast call $CREDITS_ADDRESS \
  "getCredits(address)(uint256)" \
  $(cast wallet address --private-key $PRIVATE_KEY) \
  --rpc-url https://sepolia.base.org
```

### Test 2: PKP Grants Free Credits

```bash
# PKP grants 2 free credits
cast send $CREDITS_ADDRESS \
  "grantCredits(address,uint16,string)" \
  $USER_ADDRESS \
  2 \
  "test_bonus" \
  --private-key $PKP_PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Test 3: Register Segments (PKP)

```bash
# This would be called by Lit Action, but you can test manually:
# Note: This is complex - better to test via Lit Action integration
```

---

## 📝 Update Configuration Files

### 1. Update Lit Actions

Edit `/lit-actions/src/karaoke/audio-processor-v1.js`:

```javascript
const KARAOKE_CREDITS_ADDRESS = '0x...'  // Your deployed address
const SEGMENT_REGISTRY_ADDRESS = '0x...'  // Your deployed address
```

Edit `/lit-actions/src/karaoke/match-and-segment-v2.js`:

```javascript
const SEGMENT_REGISTRY_ADDRESS = '0x...'  // Your deployed address
```

### 2. Update Frontend Configuration

Create `/app/src/config/contracts.ts`:

```typescript
export const contracts = {
  // Base Sepolia
  karaokeCredits: {
    address: '0x...' as `0x${string}`,
    chainId: 84532,
  },
  karaokeSegmentRegistry: {
    address: '0x...' as `0x${string}`,
    chainId: 84532,
  },

  // Lens Testnet
  songCatalog: {
    address: '0x88996135809cc745E6d8966e3a7A01389C774910' as `0x${string}`,
    chainId: 37111,
  },
}
```

### 3. Create Contract ABIs

```bash
# Export ABIs for frontend
forge inspect KaraokeCredits/KaraokeCreditsV1.sol:KaraokeCreditsV1 abi > \
  ../app/src/abi/KaraokeCreditsV1.json

forge inspect KaraokeSegmentRegistry/KaraokeSegmentRegistryV1.sol:KaraokeSegmentRegistryV1 abi > \
  ../app/src/abi/KaraokeSegmentRegistryV1.json
```

---

## 🔄 Integration Flow

### 1. Cold Start (Free Segment Generation)

```
User searches song → Not in registry
  ↓
Frontend calls match-and-segment-v2.js
  ↓
Lit Action:
  1. Fetch Genius + LRClib data
  2. Segment with Gemini
  3. Call registry.addSegmentsBatch()
  4. Return segments to frontend
  ↓
Frontend shows SegmentPickerDrawer
```

### 2. Credit Purchase

```
User clicks "1 Credit" → Has 0 credits
  ↓
Frontend shows PurchaseCreditsDialog
  ↓
Particle Network payment (any crypto → USDC)
  ↓
credits.purchaseCreditsUSDC() or credits.purchaseCreditsETH()
  ↓
Credits minted to user
```

### 3. Segment Unlock

```
User clicks "Unlock" → Has credits
  ↓
credits.useCredit(1, "378195", "chorus-1")
  ↓
Lit Action: audio-processor-v1.js
  1. Download from maid.zone
  2. Trim + separate stems (Modal)
  3. Upload to Grove (vocals.zip, drums.zip)
  4. Call registry.updateSegmentAssets()
  ↓
Segment unlocked & ready for karaoke
```

---

## 🛡️ Security Checklist

Before mainnet deployment:

- [ ] Security audit completed
- [ ] Treasury is multisig (not EOA)
- [ ] PKP private key secured
- [ ] Rate limiting implemented
- [ ] Gas costs tested under load
- [ ] USDC approval flow tested
- [ ] Deduplication logic verified
- [ ] Emergency pause tested
- [ ] Owner functions access-controlled
- [ ] Events emitted correctly

---

## 🔧 Admin Operations

### Update Credit Packages

```bash
# Update package 0 price
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
# Add 100-credit package for $30
cast send $CREDITS_ADDRESS \
  "addPackage(uint16,uint256,uint256)" \
  100 \
  30000000 \
  0.012ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Update Treasury

```bash
cast send $CREDITS_ADDRESS \
  "setTreasury(address)" \
  $NEW_TREASURY \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### Emergency Pause

```bash
# Pause both contracts
cast send $CREDITS_ADDRESS "pause()" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org

cast send $REGISTRY_ADDRESS "pause()" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

---

## 📊 Monitoring

### Event Monitoring

```typescript
// Listen for credit purchases
creditsContract.watchEvent.CreditsPurchased({
  onLogs: (logs) => {
    logs.forEach(log => {
      console.log(`User ${log.args.user} purchased ${log.args.creditAmount} credits`)
      // Send to analytics
    })
  }
})

// Listen for segment registrations
registryContract.watchEvent.SongRegistered({
  onLogs: (logs) => {
    logs.forEach(log => {
      console.log(`Song ${log.args.title} registered with ${log.args.totalSegments} segments`)
    })
  }
})
```

### Health Checks

```bash
# Check contract status
cast call $CREDITS_ADDRESS "paused()(bool)" --rpc-url https://sepolia.base.org
cast call $REGISTRY_ADDRESS "paused()(bool)" --rpc-url https://sepolia.base.org

# Check treasury balance
cast balance $TREASURY_ADDRESS --rpc-url https://sepolia.base.org

# Check package availability
cast call $CREDITS_ADDRESS "getAllPackages()(tuple(uint16,uint256,uint256,bool)[])" \
  --rpc-url https://sepolia.base.org
```

---

## 🐛 Troubleshooting

### Deployment Fails: "Nonce too low"

**Solution**: Wait a few blocks or use `--nonce` flag

```bash
# Get current nonce
cast nonce $YOUR_ADDRESS --rpc-url https://sepolia.base.org

# Deploy with explicit nonce
forge script ... --nonce <nonce>
```

### Verification Fails

**Solution**: Wait 30 seconds after deployment, then verify manually

```bash
forge verify-contract \
  $CONTRACT_ADDRESS \
  KaraokeCredits/KaraokeCreditsV1.sol:KaraokeCreditsV1 \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
    $USDC_TOKEN $TREASURY $PKP $SONG_CATALOG)
```

### "Song available for free in Native catalog"

**Solution**: This is expected! Redirect user to free version instead of charging credits

---

## 📚 Resources

- **BaseScan**: https://sepolia.basescan.org
- **Base Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Foundry Book**: https://book.getfoundry.sh
- **Contract Source**: `/contracts/KaraokeCredits/` and `/contracts/KaraokeSegmentRegistry/`

---

## 🎯 Next Steps

1. ✅ Deploy both contracts to Base Sepolia
2. ⏳ Update Lit Actions with contract addresses
3. ⏳ Update frontend configuration
4. ⏳ Test end-to-end flow
5. ⏳ Monitor first user transactions
6. ⏳ Optimize gas costs if needed
7. ⏳ Plan mainnet migration

---

## License

MIT
