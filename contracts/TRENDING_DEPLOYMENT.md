# TrendingTrackerV1 Deployment Record

## ✅ Successfully Deployed!

**Network:** Lens Chain Testnet (Chain ID: 37111)
**Contract Address:** `0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731`
**Transaction Hash:** `0x53c290203966a26e833ed12593adb5321c86a81b46297b7e760607c25cc300d6`
**Deployed:** 2025-10-03
**Owner Address:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`
**Trusted Tracker (PKP):** `0x254AA0096C9287a03eE62b97AA5643A2b8003657`

**Explorer Link:** https://explorer.testnet.lens.xyz/address/0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731

---

## Deployment Command Used

```bash
DOTENV_PRIVATE_KEY='a75a20fca4d452c7827a662f9ee0857c5147efce6a19149b7f0276b3fbc110d7' \
npx dotenvx run --env-file=.env -- bash -c 'FOUNDRY_PROFILE=zksync forge create \
  src/TrendingTrackerV1.sol:TrendingTrackerV1 \
  --broadcast \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args "$PKP_ADDRESS" \
  --zksync \
  --gas-limit 10000000 \
  --gas-price 300000000'
```

## Key Learnings

1. **--broadcast position matters**: Must come IMMEDIATELY after contract name, not at end
2. **Use dotenvx for encrypted .env**: `DOTENV_PRIVATE_KEY='...' npx dotenvx run --env-file=.env -- bash -c '...'`
3. **FOUNDRY_PROFILE=zksync required**: For zkSync deployment
4. **Gas parameters**: `--gas-limit 10000000 --gas-price 300000000`
5. **ABI location**: zkSync builds go to `zkout/` directory, not `out/`

---

## Contract Configuration

**Default Weights:**
- Click Weight: 10 (10%)
- Play Weight: 30 (30%)
- Completion Weight: 60 (60%)

**Time Windows:**
- Hourly: 0 (1-hour rolling window)
- Daily: 1 (24-hour rolling window)
- Weekly: 2 (7-day rolling window)

---

## Next Steps

1. ✅ Contract deployed to Lens Chain testnet
2. ✅ PKP set as trusted tracker
3. ✅ ABI exported to `site/src/abi/TrendingTrackerV1.json`
4. ✅ Lit Action updated with contract address
5. ✅ Upload Lit Action to IPFS (CID: QmW2wo1S7Bd4yaNKiAmXXkrbkPAwt16aFFXH6ZzmjiAGyz)
6. ✅ Update PKP permissions with new IPFS CID (Tx: 0xacfdfb4c5d848d041de185803354d264700d5395d73a705f181a43a9c7968be0)
7. ⏳ Test trending tracking from frontend
8. ⏳ Test batch submission from Lit Action

---

## Testing

### Verify Deployment

```bash
# Check owner
cast call 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 "owner()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Should return: 0x0C6433789d14050aF47198B2751f6689731Ca79C

# Check trusted tracker
cast call 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 "trustedTracker()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Should return: 0x254AA0096C9287a03eE62b97AA5643A2b8003657

# Check paused status
cast call 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 "paused()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Should return: false

# Check weights
cast call 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 "clickWeight()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Should return: 10

cast call 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 "playWeight()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Should return: 30

cast call 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 "completionWeight()" \
  --rpc-url https://rpc.testnet.lens.xyz
# Should return: 60
```

### Test Batch Update (Manual - PKP Only)

This should only be done by the PKP (Lit Action), not manually:

```bash
# Example batch update (3 songs)
cast send 0xeaF1A26dF6A202E2b4ba6e194d7BCe9bACF82731 \
  "updateTrendingBatch(uint8,uint8[],string[],uint32[],uint32[],uint32[])" \
  0 \
  '[0,1,0]' \
  '["heat-of-the-night","123456","down-home-blues"]' \
  '[5,3,2]' \
  '[10,7,4]' \
  '[3,2,1]' \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

---

## Integration Files Updated

1. ✅ `lit-actions/src/trending/trending-tracker-v1.js` - Contract address updated
2. ✅ `site/src/abi/TrendingTrackerV1.json` - ABI exported
3. ✅ `site/src/config/lit-actions.ts` - Trending config added with IPFS CID
4. ✅ `TRENDING.md` - Documentation updated with deployment info

---

## Resources

- **Contract Source:** `contracts/src/TrendingTrackerV1.sol`
- **Deployment Script:** `contracts/script/DeployTrendingTrackerV1.s.sol`
- **Lit Action:** `lit-actions/src/trending/trending-tracker-v1.js`
- **Frontend Service:** `site/src/services/TrendingService.ts`
- **Queue Service:** `site/src/services/TrendingQueueService.ts`
- **Documentation:** `TRENDING.md`
