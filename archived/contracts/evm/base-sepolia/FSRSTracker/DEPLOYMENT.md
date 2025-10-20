# FSRSTrackerV1 Deployment Guide

## Prerequisites

✅ All tests passing (16/16)
✅ Contract compiled successfully
✅ Environment variables configured
✅ Deployment script ready

## Environment Variables Required

Located in `/contracts/evm/base-sepolia/.env`:

```bash
# Already configured:
PKP_ADDRESS="0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30"
BASESCAN_API_KEY="VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A"

# Required (encrypted via dotenvx):
PRIVATE_KEY=<your-encrypted-deployer-private-key>
```

## Deployment Command

From `/contracts/evm/base-sepolia` directory:

```bash
# Using dotenvx for encrypted keys
DOTENV_PRIVATE_KEY=<decryption-key> dotenvx run -f .env -- \
  forge script FSRSTracker/script/DeployFSRSTrackerV1.s.sol:DeployFSRSTrackerV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# OR using plain PRIVATE_KEY (less secure)
forge script FSRSTracker/script/DeployFSRSTrackerV1.s.sol:DeployFSRSTrackerV1 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --private-key $PRIVATE_KEY
```

## Expected Output

```
=== FSRSTrackerV1 Deployment ===
Network: Base Sepolia (84532)
Deployer: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Trusted PKP: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30

=== Deployment Complete ===
FSRSTrackerV1 deployed to: 0x...
Owner: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Trusted PKP: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
Paused: false
Max Line Count: 100

=== Gas Estimates ===
Deployment: ~2-3M gas (~$0.01 on Base)
Per review: ~50k gas (~$0.00005 on Base)
Batch (5 lines): ~200k gas (~$0.0002 on Base)
```

## Post-Deployment Steps

### 1. Update DEPLOYED_ADDRESSES.md

Add the following entry to `/contracts/DEPLOYED_ADDRESSES.md`:

```markdown
### FSRSTrackerV1
- **Address**: `0x...` (from deployment output)
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Trusted PKP**: `0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30`
- **BaseScan**: https://sepolia.basescan.org/address/0x...
- **Purpose**: FSRS spaced repetition tracker for karaoke learning
- **Features**:
  - ✅ Ultra-compact card storage (19 bytes per card)
  - ✅ Batch updates (up to 20 cards)
  - ✅ Song-level aggregation queries
  - ✅ Separate "due" vs "review" queries
  - ✅ CardReviewed events for Grove indexing
- **Deployed**: 2025-10-19
- **Gas Used**: ~2-3M gas (~0.003 ETH)
```

### 2. Export Contract ABI

```bash
cd /contracts/evm/base-sepolia

# Extract ABI to frontend
forge inspect FSRSTracker/FSRSTrackerV1.sol:FSRSTrackerV1 abi > \
  ../../../app/src/config/abis/fsrsTrackerV1.ts

# Format as TypeScript export
cat ../../../app/src/config/abis/fsrsTrackerV1.ts | \
  sed '1s/^/export const fsrsTrackerV1Abi = /' | \
  sed '$s/$/;/' > \
  ../../../app/src/config/abis/fsrsTrackerV1.ts
```

### 3. Update Frontend Config

Add to `/app/src/config/contracts.ts`:

```typescript
export const contracts = {
  // ... existing contracts

  fsrsTrackerV1: {
    address: '0x...' as const, // From deployment
    chain: baseSepolia,
    abi: fsrsTrackerV1Abi,
  },
} as const;
```

### 4. Update Lit Actions Config

Add to `/lit-actions/src/karaoke/contracts.config.js`:

```javascript
export const CONTRACTS = {
  // ... existing contracts

  fsrsTrackerV1: {
    address: '0x...', // From deployment
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
  },
};
```

### 5. Fund PKP Wallet

The PKP needs ETH to submit card updates:

```bash
# Send ~0.001 ETH to PKP (= ~20,000 card updates)
cast send 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30 \
  --value 0.001ether \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

### 6. Test Contract Interaction

```bash
# Check deployment
cast call 0x... "owner()" --rpc-url https://sepolia.base.org
cast call 0x... "trustedPKP()" --rpc-url https://sepolia.base.org
cast call 0x... "paused()" --rpc-url https://sepolia.base.org

# Query card (should return empty card)
cast call 0x... \
  "getCard(address,string,string,uint8)" \
  0x0C6433789d14050aF47198B2751f6689731Ca79C \
  "heat-of-the-night" \
  "chorus-1" \
  0 \
  --rpc-url https://sepolia.base.org
```

## Troubleshooting

### Deployment Fails: "Nonce too low"
```bash
# Reset nonce
cast nonce $DEPLOYER_ADDRESS --rpc-url https://sepolia.base.org
```

### Deployment Fails: "Insufficient funds"
```bash
# Check balance
cast balance $DEPLOYER_ADDRESS --rpc-url https://sepolia.base.org

# Get testnet ETH from faucet
open https://www.alchemy.com/faucets/base-sepolia
```

### Verification Fails
```bash
# Manually verify
forge verify-contract \
  0x... \
  FSRSTracker/FSRSTrackerV1.sol:FSRSTrackerV1 \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode 'constructor(address)' 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30) \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Next: Implement study-scorer-v1.js Lit Action

After successful deployment, the next step is to implement the Lit Action that:

1. Receives audio from user study session
2. Transcribes via Voxstral API
3. Calculates score (pronunciation accuracy)
4. Runs FSRS algorithm (vanilla JS implementation)
5. Signs and submits transaction to FSRSTrackerV1
6. Updates Grove leaderboards/streaks

See `/lit-actions/src/karaoke/study-scorer-v1.js` (to be created)
