# KaraokeCatalog Contract Deployment Guide

## Overview

This guide documents the proper process for deploying, upgrading, and managing the KaraokeCatalog smart contract.

---

## Current Deployment

### KaraokeCatalogV2
- **Address**: `0xe43A62838f70384Ed7a4C205E70d20f56d1Da711`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Deployed**: October 19, 2025
- **Deployer**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Verified**: https://sepolia.basescan.org/address/0xe43a62838f70384ed7a4c205e70d20f56d1da711

### Features
- ✅ Batch segment processing (`processSegmentsBatch`)
- ✅ Recent songs query (`getRecentSongs`)
- ✅ Translation support (multi-language lyrics)
- ✅ Additive metadata updates (`sectionsUri` + `alignmentUri`)
- ✅ Song deletion (`deleteSong`) - testnet utility
- ✅ Enhanced event tracking

---

## Deployment Process

### 1. Prerequisites

**Required Environment Variables** (in `base-sepolia/.env`):
```bash
DOTENV_PUBLIC_KEY=<public-key>
PRIVATE_KEY=<encrypted-private-key>  # Will be decrypted by dotenvx
PKP_ADDRESS=<lit-protocol-pkp-address>
TREASURY_ADDRESS=<treasury-address>
BASESCAN_API_KEY=<basescan-api-key>
```

**Required DOTENV_PRIVATE_KEY**:
- Store securely (not in git)
- Used to decrypt the `.env` file
- Current key: `40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24`

### 2. Pre-Deployment Checks

```bash
cd contracts/evm/base-sepolia/KaraokeCatalog

# 1. Build contract
forge build

# 2. Verify .env is accessible
export DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24
dotenvx get -f ../../base-sepolia/.env

# 3. Check you have the correct values
# Should show: PRIVATE_KEY, PKP_ADDRESS, TREASURY_ADDRESS, etc.
```

### 3. Deploy Contract

```bash
# Set the decryption key
export DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24

# Deploy with verification
dotenvx run -f ../../base-sepolia/.env -- forge script \
  script/DeployKaraokeCatalogV2.s.sol:DeployKaraokeCatalogV2 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

**Output will show**:
```
✅ Contract deployed at: 0xe43A62838f70384Ed7a4C205E70d20f56d1Da711
🔍 Verifying on BaseScan...
✅ Verified!
```

### 4. Post-Deployment Updates

#### Update Contract Addresses

1. **Update DEPLOYED_ADDRESSES.md**:
```bash
cd /media/t42/th42/Code/karaoke-school-v1/contracts
# Edit DEPLOYED_ADDRESSES.md to add new address
```

2. **Update Frontend Config**:
```typescript
// app/src/config/contracts.ts
export const BASE_SEPOLIA_CONTRACTS = {
  karaokeCatalog: '0xe43A62838f70384Ed7a4C205E70d20f56d1Da711' as Address,
  // ... other contracts
}
```

3. **Update Environment Variables** (if needed):
```bash
# app/.env
VITE_KARAOKE_CATALOG_CONTRACT=0xe43A62838f70384Ed7a4C205E70d20f56d1Da711
```

#### Test Deployment

```bash
# Test reading from the new contract
cast call 0xe43A62838f70384Ed7a4C205E70d20f56d1Da711 \
  "getTotalSongs()(uint256)" \
  --rpc-url https://sepolia.base.org

# Should return: 0 (for new deployment)
```

---

## Contract Versioning Philosophy

### ❌ AVOID: Sub-versioning Within a Contract
```solidity
// BAD - Confusing
contract KaraokeCatalogV2 {
    // @title KaraokeCatalogV2.2  ← NO!
    // @title KaraokeCatalogV2.1  ← NO!
}
```

### ✅ GOOD: Clear Major Versions
```solidity
// GOOD - Clear
contract KaraokeCatalogV2 {
    // @title KaraokeCatalogV2
    // Features: batch processing, recent songs, translations
}
```

### When to Create a New Version

- **V1 → V2**: Major architectural changes
  - Changed storage layout
  - Added critical new features
  - Breaking changes to existing functions

- **V2 Updates**: Minor additions without breaking changes
  - Add new view functions (`getRecentSongs`)
  - Add new events
  - Add optional features
  - → Just redeploy V2 to a new address

### Version Naming Rules

1. **Contract Name**: Matches the Solidity file
   - `KaraokeCatalogV2.sol` → `contract KaraokeCatalogV2`

2. **Documentation**: Describe features, not versions
   ```solidity
   /**
    * @title KaraokeCatalogV2
    * @notice Karaoke catalog with batch processing and queries
    *
    * Features:
    * - Batch segment processing
    * - Recent songs query
    * - Translations
    */
   ```

3. **Deployment Docs**: Track by address, not sub-versions
   - `DEPLOYMENT_V2.1.md` ❌
   - `DEPLOYED_ADDRESSES.md` with history ✅

---

## Data Migration

### Non-Upgradeable Contracts

KaraokeCatalog is **NOT upgradeable** (no proxy pattern). Each deployment is independent.

**Migration Options**:

1. **Start Fresh** (Recommended for testnet)
   - Deploy new contract
   - Re-process songs through Lit Actions
   - Update frontend to use new address

2. **Copy Existing Data** (Production)
   - Write a migration script
   - Read all songs from old contract
   - Write to new contract (requires gas)
   - Verify data integrity

### Example Migration Script

```typescript
// scripts/migrate-catalog.ts
import { createPublicClient, createWalletClient } from 'viem'
import { baseSepolia } from 'viem/chains'

const oldContract = '0x40A2a5bbD54ebB5DB84252c542b4e1BebFf37454'
const newContract = '0xe43A62838f70384Ed7a4C205E70d20f56d1Da711'

async function migrateCatalog() {
  // 1. Read all songs from old contract
  const totalSongs = await publicClient.readContract({
    address: oldContract,
    abi: CATALOG_ABI,
    functionName: 'getTotalSongs'
  })

  // 2. For each song, add to new contract
  for (let i = 0; i < totalSongs; i++) {
    const song = await publicClient.readContract({
      address: oldContract,
      abi: CATALOG_ABI,
      functionName: 'getSongByIndex',
      args: [i]
    })

    // Add to new contract...
  }
}
```

---

## Common Issues & Solutions

### Issue 1: `vm.envUint: environment variable "PRIVATE_KEY" not found`

**Cause**: dotenvx cannot decrypt `.env` file

**Solution**:
```bash
# Make sure you're using the correct DOTENV_PRIVATE_KEY
export DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24

# Test decryption
dotenvx get -f ../../base-sepolia/.env

# If it still fails, the .env file might be encrypted with a different key
```

### Issue 2: Contract Verification Fails

**Cause**: Constructor arguments mismatch or network issues

**Solution**:
```bash
# Manual verification
cast verify-contract \
  0xe43A62838f70384Ed7a4C205E70d20f56d1Da711 \
  contracts/evm/base-sepolia/KaraokeCatalog/KaraokeCatalogV2.sol:KaraokeCatalogV2 \
  --constructor-args $(cast abi-encode "constructor(address,address)" $PKP_ADDRESS $TREASURY_ADDRESS) \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A \
  --rpc-url https://sepolia.base.org
```

### Issue 3: Frontend Shows Old Data

**Cause**: Frontend still pointing to old contract address

**Solution**:
```bash
# 1. Clear browser cache and localStorage
# 2. Update contract address in frontend
# 3. Rebuild frontend
cd app
npm run dev  # or npm run build
```

---

## Rollback Procedure

If the new contract has issues:

1. **Immediate**: Update frontend to point back to old address
```typescript
// app/src/config/contracts.ts
karaokeCatalog: '0x40A2a5bbD54ebB5DB84252c542b4e1BebFf37454' // Old address
```

2. **Investigate**: Check contract on BaseScan for any reverts

3. **Fix & Redeploy**: Fix the issue and deploy a new version

---

## Checklist

Before deploying:
- [ ] Contract compiles (`forge build`)
- [ ] Tests pass (`forge test`)
- [ ] DOTENV_PRIVATE_KEY is set
- [ ] `.env` file is accessible
- [ ] PKP_ADDRESS is correct
- [ ] TREASURY_ADDRESS is correct

After deploying:
- [ ] Contract is verified on BaseScan
- [ ] Address added to `DEPLOYED_ADDRESSES.md`
- [ ] Frontend config updated
- [ ] Test basic functions (getTotalSongs, addSong)
- [ ] Commit changes to git

---

## Quick Reference

```bash
# Set decryption key
export DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24

# Deploy
cd contracts/evm/base-sepolia/KaraokeCatalog
dotenvx run -f ../../base-sepolia/.env -- \
  forge script script/DeployKaraokeCatalogV2.s.sol:DeployKaraokeCatalogV2 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A

# Test
cast call <NEW_ADDRESS> "getTotalSongs()(uint256)" --rpc-url https://sepolia.base.org
```

---

## Resources

- **BaseScan**: https://sepolia.basescan.org
- **Foundry Book**: https://book.getfoundry.sh
- **Dotenvx Docs**: https://dotenvx.com/docs
- **Base Docs**: https://docs.base.org
