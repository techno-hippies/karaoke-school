# KaraokeScoreboardV1 Deployment Record

## ✅ Successfully Deployed!

**Network:** Lens Chain Testnet (Chain ID: 37111)
**Contract Address:** `0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A`
**Transaction Hash:** `0xfc393598293568f830088f2908d9516f749e4cd133da9e7e33985c8ea6e2bf26`
**Deployed:** 2025-10-01
**Owner Address:** `0x0C6433789d14050aF47198B2751f6689731Ca79C`
**Trusted Scorer (PKP):** `0x254AA0096C9287a03eE62b97AA5643A2b8003657`

**Explorer Link:** https://explorer.testnet.lens.xyz/address/0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A

---

## Deployment Command Used

```bash
bash -c 'FOUNDRY_PROFILE=zksync forge create \
  src/KaraokeScoreboardV1.sol:KaraokeScoreboardV1 \
  --broadcast \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args "0x254AA0096C9287a03eE62b97AA5643A2b8003657" \
  --zksync'
```

## Critical Discovery: --broadcast Flag Position

**Problem:** Using `--broadcast` at the end of the command resulted in "Dry run enabled" warning despite the flag being present.

**Solution:** `--broadcast` must come IMMEDIATELY after the contract name:

```bash
# ❌ DOESN'T WORK (broadcast at end)
forge create src/Contract.sol:Contract --rpc-url ... --broadcast

# ✅ WORKS (broadcast right after contract)
forge create src/Contract.sol:Contract --broadcast --rpc-url ...
```

This is a quirk of foundry-zksync that's not documented anywhere but cost us hours of debugging.

---

## Next Steps

1. ✅ Contract deployed to Lens Chain testnet
2. ✅ PKP set as trusted scorer
3. ✅ Contract address saved to .env
4. ⏳ Update Lit Action with contract address and score submission logic
5. ⏳ Re-upload Lit Action to IPFS
6. ⏳ Update PKP permissions with new IPFS CID
7. ⏳ Test score submission from Lit Action

See `../lit-actions/README.md` for integration steps.
