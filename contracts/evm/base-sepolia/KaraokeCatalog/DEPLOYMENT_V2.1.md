# KaraokeCatalogV2.1 Deployment Checklist

## 🎯 Changes in V2.1
- **Added:** `deleteSong()` function for owner to remove songs (testnet utility)
- **Purpose:** Fix uploading mistakes, remove test data, allow geniusId corrections

## ⚠️ IMPORTANT NOTES
- **Breaking Change:** NO (additive only)
- **Data Migration:** NOT required (existing data stays)
- **Testnet Only:** This function is intended for Base Sepolia testnet flexibility

---

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
```bash
cd /media/t42/th42/Code/karaoke-school-v1/contracts/evm/base-sepolia/KaraokeCatalog
```

- [ ] Verify `PRIVATE_KEY` in contracts/.env (encrypted with dotenvx)
- [ ] Verify `PKP_ADDRESS` in contracts/.env (Lit Protocol PKP address)
- [ ] Confirm deployer wallet has Base Sepolia ETH (~0.01 ETH needed)
- [ ] Get test ETH: https://www.alchemy.com/faucets/base-sepolia

### 2. Contract Review
- [x] **Added `deleteSong()` function** - Owner can delete songs by ID
- [x] Clears: `songIdToIndex`, `geniusIdToIndex`, and song storage
- [ ] Run tests (if available): `forge test`
- [ ] Check contract compiles: `forge build`

### 3. Current Deployment Info
**Active Contract (V2):**
- Address: `0x420Fd6e49Cb672cfbe9649B556807E6b0BafA341`
- Owner: Your deployer wallet
- Trusted Processor: PKP address from .env
- Chain: Base Sepolia (84532)

---

## 🚀 Deployment Steps

### Step 1: Compile Contract
```bash
cd /media/t42/th42/Code/karaoke-school-v1/contracts/evm/base-sepolia/KaraokeCatalog

forge build
```

**Expected Output:**
```
[⠊] Compiling...
[⠒] Compiling 1 files with Solc 0.8.30
[⠢] Solc 0.8.30 finished in X.XXs
Compiler run successful!
```

---

### Step 2: Deploy Contract

**Option A: With Verification (Recommended)**
```bash
DOTENV_PRIVATE_KEY=<your_key> dotenvx run -f ../../.env -- \
  forge script script/DeployKaraokeCatalogV2.s.sol:DeployKaraokeCatalogV2 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

**Option B: Without Verification (Faster)**
```bash
DOTENV_PRIVATE_KEY=<your_key> dotenvx run -f ../../.env -- \
  forge script script/DeployKaraokeCatalogV2.s.sol:DeployKaraokeCatalogV2 \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

**Expected Output:**
```
=== KaraokeCatalogV2 Deployment ===
Deployer: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Trusted Processor (PKP): 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
Chain ID: 84532

=== Deployment Complete ===
KaraokeCatalogV2 deployed to: 0x<NEW_ADDRESS>
Owner: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Trusted Processor: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
```

**SAVE THIS ADDRESS:** `0x<NEW_ADDRESS>`

---

### Step 3: Verify Deployment

```bash
# Check contract exists
cast code <NEW_ADDRESS> --rpc-url https://sepolia.base.org

# Check owner
cast call <NEW_ADDRESS> "owner()" --rpc-url https://sepolia.base.org

# Check trusted processor
cast call <NEW_ADDRESS> "trustedProcessor()" --rpc-url https://sepolia.base.org

# Check paused state (should be false)
cast call <NEW_ADDRESS> "paused()" --rpc-url https://sepolia.base.org

# Verify deleteSong function exists
cast interface <NEW_ADDRESS> | grep deleteSong
```

**Expected Results:**
- Contract code exists (non-zero bytecode)
- Owner matches deployer address
- Trusted processor matches PKP address
- Paused = false
- `deleteSong(string)` function appears in interface

---

## 🔄 Post-Deployment Updates

### 1. Update Song Uploader
```bash
# File: song-uploader-new/src/config.ts
```

```typescript
contract: {
  address: '0x<NEW_ADDRESS>' as `0x${string}`, // ← UPDATE THIS
  chain: 'base-sepolia',
  rpcUrl: 'https://sepolia.base.org',
},
```

### 2. Update App Frontend
```bash
# File: app/.env.local
```

```bash
VITE_KARAOKE_CATALOG_CONTRACT=0x<NEW_ADDRESS>  # ← UPDATE THIS
```

**Also update fallback in:**
```typescript
// File: app/src/config/contracts.ts
karaokeCatalog: (import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT || '0x<NEW_ADDRESS>') as Address,
```

### 3. Update Lit Actions Config
```bash
# File: lit-actions/src/karaoke/contracts.config.js
```

```javascript
export const KARAOKE_CATALOG_ADDRESS = '0x<NEW_ADDRESS>'; // ← UPDATE THIS
```

**Note:** Lit actions receive `contractAddress` as a parameter, so this is just a fallback/documentation.

---

## 🧪 Testing Steps

### Test 1: Delete Song Function (New Feature)

**A. Delete the broken "genesis-again" upload:**
```bash
DOTENV_PRIVATE_KEY=<key> dotenvx run -- \
  cast send <NEW_ADDRESS> \
  "deleteSong(string)" \
  "genesis-again" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

**B. Verify deletion:**
```bash
cast call <NEW_ADDRESS> "songExistsById(string)" "genesis-again" \
  --rpc-url https://sepolia.base.org
```

Expected: `0x0000...0000` (false)

---

### Test 2: Re-Upload Song with Correct GeniusId

```bash
cd /media/t42/th42/Code/karaoke-school-v1/song-uploader-new

# Verify metadata has geniusId
cat songs/genesis-again/metadata.json
# Should show: "geniusId": 12554411

# Upload
DOTENV_PRIVATE_KEY=<key> dotenvx run -- bun run upload genesis-again
```

**Expected Results:**
- Song uploads successfully
- Uses geniusId: 12554411 ✅ (not 0)
- Transaction confirms on Base Sepolia

---

### Test 3: Verify in App

```bash
cd /media/t42/th42/Code/karaoke-school-v1/app
npm run dev
```

1. Navigate to: `http://localhost:5173/#/karaoke/song/12554411`
2. **Expected:**
   - Song loads
   - Shows image/metadata from Genius
   - Shows sections/alignment from contract
   - No SoundCloud error

---

### Test 4: Test Lit Action Integration

**Test match-and-segment still works with new contract:**

1. Go to: `http://localhost:5173/#/karaoke/song/<GENIUS_ID>` (some other song)
2. Click "Start Karaoke"
3. **Expected:** Lit action runs successfully with new contract address

---

## 📊 Migration Plan (If Needed)

**Current V2:** `0x420Fd6e49Cb672cfbe9649B556807E6b0BafA341`
**New V2.1:** `0x<NEW_ADDRESS>`

### Option A: Fresh Start (Recommended for Testnet)
- Deploy V2.1 to new address
- Start fresh (no migration)
- Old data remains accessible at old address

### Option B: Migrate Data
If you have important test data:

```solidity
// Script to migrate songs from V2 to V2.1
// Read from old contract, write to new contract
// (Manual process, owner-only operation)
```

---

## 🔒 Security Checklist

- [ ] Owner address is correct
- [ ] Trusted processor (PKP) address is correct
- [ ] No mainnet private keys in testnet deployment
- [ ] Contract verified on BaseScan
- [ ] `deleteSong()` is `onlyOwner` (can't be called by users)
- [ ] Test `deleteSong()` on testnet before using in production

---

## 🐛 Rollback Plan

If something goes wrong:

1. **Old contract still works:** `0x420Fd6e49Cb672cfbe9649B556807E6b0BafA341`
2. **Revert environment variables** to old address
3. **No data loss** - V2 contract remains unchanged
4. **Debug new contract** without affecting users

---

## ✅ Final Verification Checklist

After all updates:

- [ ] Song uploader uses new address
- [ ] App uses new address (env var + fallback)
- [ ] Lit actions reference updated
- [ ] Can delete songs via `deleteSong()`
- [ ] Can upload songs with correct geniusId
- [ ] Songs appear in app at `/karaoke/song/<geniusId>`
- [ ] Lit actions can write to new contract
- [ ] No console errors in browser
- [ ] Transactions confirm on BaseScan

---

## 📝 Contract Addresses Reference

Update this section after deployment:

```
V1 (Old): 0x0843DDB2F2ceCAB0644Ece0523328af2C7882032
V2 (Current): 0x420Fd6e49Cb672cfbe9649B556807E6b0BafA341
V2.1 (New): 0x<NEW_ADDRESS_HERE>

Base Sepolia RPC: https://sepolia.base.org
BaseScan: https://sepolia.basescan.org/address/<NEW_ADDRESS>
```

---

## 🆘 Troubleshooting

**Deployment fails:**
- Check deployer has ETH
- Verify RPC URL is correct
- Check PRIVATE_KEY is decrypted properly

**Contract won't verify:**
- Use `--verify` flag in deployment command
- May need to wait ~30s after deployment
- Can manually verify on BaseScan later

**deleteSong() fails:**
- Only owner can call it
- Song must exist
- Check you're calling from deployer wallet

**Old songs don't appear:**
- Redeploy migrates nothing - it's a fresh contract
- Either migrate data or use old contract address

---

## 📞 Support

If you encounter issues:
1. Check deployment logs
2. Verify on BaseScan
3. Test with minimal example
4. Review contract events

**Contract Source:** `KaraokeCatalogV2.sol`
**Deployment Script:** `script/DeployKaraokeCatalogV2.s.sol`
