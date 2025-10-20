# Deploy Karaoke Contracts - Ready Commands

**Status**: ✅ Contracts compiled and ready
**Your Wallet**: 0x0C6433789d14050aF47198B2751f6689731Ca79C
**Balance**: 0.22 ETH on Base Sepolia

## ✅ What's Ready

1. **KaraokeCreditsV1** - Compiled ✅
2. **KaraokeSegmentRegistryV1** - Compiled ✅
3. **Environment** - Configured ✅
   - PRIVATE_KEY: Encrypted via dotenvx ✅
   - TREASURY_ADDRESS: 0x0C6433789d14050aF47198B2751f6689731Ca79C ✅
   - PKP_ADDRESS: 0x254AAb1Ef1AD6f95d93B557ca6dD3eF2e6f5CE52 ✅
   - SONG_CATALOG_ADDRESS: 0x88996135809cc745E6d8966e3a7A01389C774910 ✅

## 🚀 Deploy Commands

### Option 1: Using Forge Script (Recommended)

```bash
cd /media/t42/th42/Code/karaoke-school-v1/contracts

# Deploy KaraokeCreditsV1
dotenvx run -- forge script \
  KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast

# Deploy KaraokeSegmentRegistryV1
dotenvx run -- forge script \
  KaraokeSegmentRegistry/script/DeployKaraokeSegmentRegistryV1.s.sol:DeployKaraokeSegmentRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

### Option 2: Using Foundry Standard (Without dotenvx)

If you prefer to export the decrypted private key (temporarily):

```bash
# Decrypt and export
export PRIVATE_KEY=$(dotenvx run -- bash -c 'echo $PRIVATE_KEY')
export TREASURY_ADDRESS="0x0C6433789d14050aF47198B2751f6689731Ca79C"
export PKP_ADDRESS="0x254AAb1Ef1AD6f95d93B557ca6dD3eF2e6f5CE52"
export SONG_CATALOG_ADDRESS="0x88996135809cc745E6d8966e3a7A01389C774910"

# Deploy KaraokeCreditsV1
forge script \
  KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast

# Deploy KaraokeSegmentRegistryV1
forge script \
  KaraokeSegmentRegistry/script/DeployKaraokeSegmentRegistryV1.s.sol:DeployKaraokeSegmentRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast

# Clear the private key from memory
unset PRIVATE_KEY
```

### Option 3: Manual Deployment via Cast

```bash
# Get private key
PRIVATE_KEY=$(dotenvx run -- bash -c 'echo $PRIVATE_KEY')

# Add 0x prefix if needed
[[ "$PRIVATE_KEY" != 0x* ]] && PRIVATE_KEY="0x$PRIVATE_KEY"

# Deploy KaraokeCreditsV1
forge create KaraokeCredits/KaraokeCreditsV1.sol:KaraokeCreditsV1 \
  --rpc-url https://sepolia.base.org \
  --constructor-args \
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e" \
    "0x0C6433789d14050aF47198B2751f6689731Ca79C" \
    "0x254AAb1Ef1AD6f95d93B557ca6dD3eF2e6f5CE52" \
    "0x88996135809cc745E6d8966e3a7A01389C774910" \
  --private-key $PRIVATE_KEY

# Deploy KaraokeSegmentRegistryV1
forge create KaraokeSegmentRegistry/KaraokeSegmentRegistryV1.sol:KaraokeSegmentRegistryV1 \
  --rpc-url https://sepolia.base.org \
  --constructor-args \
    "0x254AAb1Ef1AD6f95d93B557ca6dD3eF2e6f5CE52" \
  --private-key $PRIVATE_KEY

# Clear
unset PRIVATE_KEY
```

## 📝 After Deployment

### 1. Save Deployed Addresses

```bash
# From deployment output, save:
export CREDITS_ADDRESS=0x...
export REGISTRY_ADDRESS=0x...
```

### 2. Verify on BaseScan (Optional)

```bash
# Verify KaraokeCreditsV1
forge verify-contract \
  $CREDITS_ADDRESS \
  KaraokeCredits/KaraokeCreditsV1.sol:KaraokeCreditsV1 \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e" \
    "0x0C6433789d14050aF47198B2751f6689731Ca79C" \
    "0x254AAb1Ef1AD6f95d93B557ca6dD3eF2e6f5CE52" \
    "0x88996135809cc745E6d8966e3a7A01389C774910") \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify KaraokeSegmentRegistryV1
forge verify-contract \
  $REGISTRY_ADDRESS \
  KaraokeSegmentRegistry/KaraokeSegmentRegistryV1.sol:KaraokeSegmentRegistryV1 \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode "constructor(address)" \
    "0x254AAb1Ef1AD6f95d93B557ca6dD3eF2e6f5CE52") \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 3. Test Deployment

```bash
# Check KaraokeCreditsV1
cast call $CREDITS_ADDRESS "owner()(address)" --rpc-url https://sepolia.base.org
cast call $CREDITS_ADDRESS "packageCount()(uint8)" --rpc-url https://sepolia.base.org

# Check KaraokeSegmentRegistryV1
cast call $REGISTRY_ADDRESS "owner()(address)" --rpc-url https://sepolia.base.org

# Purchase 1 credit to test
cast send $CREDITS_ADDRESS \
  "purchaseCreditsETH(uint8)" \
  0 \
  --value 0.0002ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### 4. Export ABIs

```bash
# Export for frontend
forge inspect KaraokeCredits/KaraokeCreditsV1.sol:KaraokeCreditsV1 abi > \
  ../app/src/abi/KaraokeCreditsV1.json

forge inspect KaraokeSegmentRegistry/KaraokeSegmentRegistryV1.sol:KaraokeSegmentRegistryV1 abi > \
  ../app/src/abi/KaraokeSegmentRegistryV1.json
```

### 5. Update Configuration Files

**Lit Actions** (`lit-actions/src/karaoke/*.js`):
```javascript
const KARAOKE_CREDITS_ADDRESS = '0x...'  // KaraokeCreditsV1 address
const SEGMENT_REGISTRY_ADDRESS = '0x...'  // KaraokeSegmentRegistryV1 address
```

**Frontend** (`app/src/config/contracts.ts`):
```typescript
export const contracts = {
  karaokeCredits: {
    address: '0x...' as `0x${string}`,
    chainId: 84532,
  },
  karaokeSegmentRegistry: {
    address: '0x...' as `0x${string}`,
    chainId: 84532,
  },
}
```

## 🔍 Deployment Troubleshooting

### If "Error accessing local wallet"

The private key might need the 0x prefix:
```bash
PRIVATE_KEY=$(dotenvx run -- bash -c 'echo $PRIVATE_KEY')
[[ "$PRIVATE_KEY" != 0x* ]] && PRIVATE_KEY="0x$PRIVATE_KEY"
```

### If "Compilation taking too long"

Contracts are already compiled in `out/` directory. Use `--skip-compilation` or `forge create` instead of `forge script`.

### If "Insufficient funds"

Check balance:
```bash
cast balance 0x0C6433789d14050aF47198B2751f6689731Ca79C --rpc-url https://sepolia.base.org
```

Get more testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## 📊 Gas Estimates

- **KaraokeCreditsV1**: ~2.5M gas (~0.005 ETH)
- **KaraokeSegmentRegistryV1**: ~1.8M gas (~0.004 ETH)
- **Total**: ~0.009 ETH (you have 0.22 ETH ✅)

## 🎯 What's Next

After successful deployment:

1. ✅ Both contracts on Base Sepolia
2. ⏳ Update Lit Actions with addresses
3. ⏳ Update frontend configuration
4. ⏳ Export ABIs
5. ⏳ Test end-to-end flow:
   - User searches song
   - Cold start generation (FREE)
   - Credit purchase via Particle
   - Segment unlock
   - Karaoke stems ready!

---

**Your wallet is funded and ready. Choose any option above to deploy!**
