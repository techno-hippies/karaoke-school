# KaraokeScoreboardV1 Contract Deployment

## Prerequisites

**Critical Requirements:**
- ✅ Foundry ZKsync fork v0.0.29 (installed)
- ✅ Solidity 0.8.19 (to avoid PUSH0 opcode issues on zkSync)
- ✅ NO OpenZeppelin dependencies (causes zkSync deployment failures)
- ✅ FOUNDRY_PROFILE=zksync (must use zksync profile)
- ✅ Must wrap command in `bash -c '...'` for proper env var handling

**Verify installation:**
```bash
forge --version
# Should show: forge Version: 1.3.5-foundry-zksync-v0.0.29
```

## Deployment Steps

### 1. Set Environment Variables

```bash
# PKP_ADDRESS should already be set in .env from mint-pkp script
# PRIVATE_KEY should already be encrypted in .env
source .env
```

### 2. Deploy Contract

**CRITICAL:** Must wrap the entire command in `bash -c '...'` AND `--broadcast` must come IMMEDIATELY after contract name:

```bash
bash -c 'FOUNDRY_PROFILE=zksync forge create \
  src/KaraokeScoreboardV1.sol:KaraokeScoreboardV1 \
  --broadcast \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args "$PKP_ADDRESS" \
  --zksync'
```

**Note:** `--broadcast` flag position is critical - it MUST come right after the contract name, NOT at the end!

**Expected output:**
```
Compiling 1 files with zksolc and solc 0.8.19
zksolc and solc 0.8.19 finished in X.XXs
Compiler run successful!
Deployer: 0x0C6433789d14050aF47198B2751f6689731Ca79C
Deployed to: 0x... (contract address)
Transaction hash: 0x...
```

### 3. Verify Deployment

```bash
# Get owner
cast call <CONTRACT_ADDRESS> "owner()" --rpc-url https://rpc.testnet.lens.xyz

# Get trusted scorer (should be PKP address)
cast call <CONTRACT_ADDRESS> "trustedScorer()" --rpc-url https://rpc.testnet.lens.xyz
```

### 4. Update Environment

After deployment, update `.env`:
```bash
SCOREBOARD_CONTRACT_ADDRESS="0x..."  # Your deployed contract address
```

---

## Common Issues & Solutions

### Issue 1: "Dry run enabled, not broadcasting transaction"

**Error:** `Warning: Dry run enabled, not broadcasting transaction` despite using `--broadcast`

**Root Cause:** Shell not properly handling `FOUNDRY_PROFILE=zksync` environment variable

**Solution:** Wrap entire command in `bash -c '...'`:
```bash
# ❌ DON'T DO THIS (doesn't work in some shells)
FOUNDRY_PROFILE=zksync forge create ... --broadcast

# ✅ DO THIS (works reliably)
bash -c 'FOUNDRY_PROFILE=zksync forge create ... --broadcast'
```

### Issue 2: PUSH0 Opcode Error
**Error:** `Transaction reverted: invalid opcode PUSH0`

**Solution:** Use Solidity 0.8.19 (not 0.8.20+)
```toml
# foundry.toml
[profile.zksync]
solc_version = "0.8.19"
```

### Issue 3: zkSync VM Halted / Not Enough Balance
**Error:** `zk vm halted: Account validation error: Not enough balance for fee + value`

**Solution:** Check deployer wallet has sufficient $GRASS:
```bash
cast balance 0x0C6433789d14050aF47198B2751f6689731Ca79C --rpc-url https://rpc.testnet.lens.xyz
```

---

## Testing Deployed Contract

### Query Functions (Free)
```bash
# Get user's score for a clip
cast call <CONTRACT_ADDRESS> \
  "getScore(string,address)" "clip-id" "0xUserAddress" \
  --rpc-url https://rpc.testnet.lens.xyz

# Get all users who played a clip
cast call <CONTRACT_ADDRESS> \
  "getUsersByClip(string)" "clip-id" \
  --rpc-url https://rpc.testnet.lens.xyz
```

### Write Functions (PKP Only)
Only the PKP can call `updateScore()`:
```bash
# This will FAIL if called by non-PKP address
cast send <CONTRACT_ADDRESS> \
  "updateScore(string,address,uint96)" "clip-id" "0xUserAddress" 85 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
# Error: Not trusted scorer
```

The PKP will call this from the Lit Action after computing scores.

---

## Integration with Lit Action

After deployment:

1. **Update Lit Action** (`lit-actions/src/stt/free-v8.js`) with contract address
2. **Add score submission logic** to Lit Action after Voxtral API call
3. **Re-upload Lit Action to IPFS** to get new CID
4. **Update PKP permissions** with new Lit Action CID

See `lit-actions/README.md` for Lit Action integration details.

---

## Deployment Checklist

- [x] Foundry ZKsync v0.0.29 installed
- [x] Using Solidity 0.8.19 in zksync profile
- [x] No OpenZeppelin dependencies
- [x] PKP minted and funded with $GRASS
- [x] PRIVATE_KEY encrypted in .env
- [x] PKP_ADDRESS set in .env
- [ ] Contract deployed using `bash -c` wrapper
- [ ] Owner address verified
- [ ] Trusted scorer (PKP) verified
- [ ] Contract address saved to .env
- [ ] Lit Action updated with contract address
- [ ] Lit Action re-uploaded to IPFS
- [ ] PKP permissions updated with new IPFS CID
- [ ] Explorer verified: https://explorer.testnet.lens.xyz/address/<CONTRACT_ADDRESS>
