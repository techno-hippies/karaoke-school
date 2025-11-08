# Unlock Protocol Integration - Implementation Summary

## 🎯 Overview

Unlock Protocol subscription locks have been integrated into the karaoke pipeline to monetize premium artist content. This is **ARTISTS ONLY** (requires `spotify_artist_id`) - TikTok creators are excluded from lock deployment.

---

## 📋 What Was Created

### 1. Database Schema (`schema/migrations/07-unlock-protocol-locks.sql`)

**Added columns to `lens_accounts` table:**
- `subscription_lock_address` - Lock contract address on Base Sepolia
- `subscription_lock_chain` - Blockchain network (default: 'base-sepolia')
- `subscription_lock_price` - Price as string (default: '1.99')
- `subscription_lock_currency` - Payment currency (default: 'ETH')
- `subscription_lock_duration_days` - Duration in days (default: 30)
- `subscription_lock_deployed_at` - Deployment timestamp
- `subscription_lock_tx_hash` - Transaction hash

**Indexes created:**
- `idx_lens_accounts_lock_address` - Query locks efficiently
- `idx_lens_accounts_needs_lock` - Find artists needing locks

**Why `lens_accounts` table?**
- 1:1 relationship (each Lens account has ONE lock)
- Simpler schema, fewer joins
- Follows PKP → Lens → Lock progression
- Lock info already part of Lens metadata

### 2. Processor (`src/processors/deploy-artist-unlock-locks.ts`)

**New standalone processor for lock deployment.**

**Query logic:**
```sql
-- Find artists with PKP+Lens but no lock
SELECT sa.*, pkp.*, lens.*
FROM spotify_artists sa
INNER JOIN pkp_accounts pkp ON pkp.spotify_artist_id = sa.spotify_artist_id
  AND pkp.account_type = 'artist'
INNER JOIN lens_accounts lens ON lens.spotify_artist_id = sa.spotify_artist_id
  AND lens.account_type = 'artist'
WHERE EXISTS (SELECT 1 FROM karaoke_segments ...)  -- In pipeline
  AND lens.subscription_lock_address IS NULL        -- No lock yet
```

**Lock Configuration:**
- Price: 1.99 ETH/month (fixed)
- Duration: 30 days
- Max Keys: Unlimited
- Chain: Base Sepolia (testnet)
- Beneficiary: Artist's PKP address (payments flow directly to artist)

### 3. Documentation (`AGENTS.md` updated)

Added to "New Processors" table and Web3 workflow examples.

---

## 🔄 Pipeline Position

```
Web3 Identity & Monetization Flow:

1. mint-pkps.ts                       ← Creates PKP accounts for artists
2. create-lens-accounts.ts             ← Creates Lens accounts with PKP
3. deploy-artist-unlock-locks.ts       ← [NEW] Deploys subscription locks (artists only)
4. populate-grc20-artists              ← Final metadata compilation for minting
```

**Why this order?**
- ✅ PKP exists → Lock deployment requires PKP address
- ✅ Lens account exists → Lock address added to Lens metadata
- ✅ Before GRC-20 compilation → Lock info included in final artist metadata
- ✅ Optional step → Not all artists need premium locks

---

## 🚀 Usage

### Prerequisites

1. **Database migration applied:**
   ```bash
   # Apply migration (add columns to lens_accounts)
   psql $NEON_DATABASE_URL -f karaoke-pipeline/schema/migrations/07-unlock-protocol-locks.sql
   ```

2. **Environment variables set:**
   ```bash
   PRIVATE_KEY=0x...  # Master EOA used ONLY to deploy locks (pays gas fees)
   ```

3. **Master EOA funded:**
   - Need Base Sepolia testnet ETH
   - Get from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### Running the Processor

```bash
# Deploy locks for 5 artists
bun src/processors/deploy-artist-unlock-locks.ts --limit=5

# Deploy lock for specific artist
bun src/processors/deploy-artist-unlock-locks.ts --artist=3TVXtAsR1Inumwj472S9r4
```

### Complete Web3 Flow

```bash
# 1. Create PKP accounts
bun src/processors/mint-pkps.ts --limit=20 --type=artist

# 2. Create Lens accounts
bun src/processors/create-lens-accounts.ts --limit=20 --type=artist

# 3. Deploy subscription locks (NEW!)
bun src/processors/deploy-artist-unlock-locks.ts --limit=5

# 4. Populate GRC-20 artists (includes lock info)
bun scripts:migration:populate-grc20-artists
```

---

## 🗄️ Database Queries

### Find artists needing locks
```sql
SELECT 
  sa.name,
  sa.spotify_artist_id,
  lens.lens_handle,
  lens.lens_account_address
FROM spotify_artists sa
INNER JOIN pkp_accounts pkp ON pkp.spotify_artist_id = sa.spotify_artist_id
INNER JOIN lens_accounts lens ON lens.spotify_artist_id = sa.spotify_artist_id
WHERE lens.subscription_lock_address IS NULL
  AND pkp.account_type = 'artist'
  AND lens.account_type = 'artist';
```

### Check deployed locks
```sql
SELECT 
  sa.name as artist_name,
  lens.lens_handle,
  lens.subscription_lock_address,
  lens.subscription_lock_deployed_at,
  lens.subscription_lock_tx_hash
FROM lens_accounts lens
JOIN spotify_artists sa ON sa.spotify_artist_id = lens.spotify_artist_id
WHERE lens.subscription_lock_address IS NOT NULL
ORDER BY lens.subscription_lock_deployed_at DESC;
```

### Verify lock on Base Sepolia
```sql
SELECT 
  subscription_lock_address,
  'https://sepolia.basescan.org/address/' || subscription_lock_address as explorer_url
FROM lens_accounts
WHERE subscription_lock_address IS NOT NULL;
```

---

## 💰 Payment Flow

**Direct to Artist:** Payments flow directly to the **artist's PKP address**.

```
User purchases subscription
    ↓
Pays 1.99 ETH to Lock Contract
    ↓
Funds routed directly to Artist's PKP Address
    ↓
Artist receives payment automatically (no intermediary)
```

**Why PKP beneficiary?**
- **Direct payments** - Artists receive subscription revenue immediately
- **No intermediary** - No need for off-chain revenue distribution
- **Artist control** - PKP owner (artist) can withdraw funds at any time
- **Transparent** - All payments visible on-chain

**Note:** Master EOA (PRIVATE_KEY) is only used to deploy the lock contract, not to receive payments.

---

## ⚠️ Important Notes

### 1. Artists Only
- **Requires:** `spotify_artist_id IS NOT NULL`
- **Excluded:** TikTok creators (no Spotify ID)
- Query explicitly filters: `pkp.account_type = 'artist'`

### 2. Fixed Pricing
- All locks: $1.99 ETH/month
- Not configurable per-artist (yet)
- Could be extended to support per-artist pricing in future

### 3. Testnet Only (for now)
- Deployed on Base Sepolia (testnet)
- Uses testnet ETH (no real cost)
- Production deployment would use Base mainnet

### 4. Lens Metadata Update (TODO)
- Lock address stored in database ✅
- Lens metadata URI needs updating (manual step)
- Requires calling `setMetadataURI` on Lens account contract
- Future enhancement: automate metadata update

### 5. Cost Considerations
- Each lock deployment costs gas
- Should be deployed **selectively** (only for premium artists)
- Consider batch deployment to save gas

---

## 🧪 Testing Checklist

### Before deploying locks:

- [ ] Migration applied to database
- [ ] PRIVATE_KEY set in .env
- [ ] Master EOA has Base Sepolia testnet ETH
- [ ] Artists have PKP accounts (check `pkp_accounts`)
- [ ] Artists have Lens accounts (check `lens_accounts`)
- [ ] Artists in pipeline (have tracks in `karaoke_segments`)

### After deploying locks:

- [ ] Verify lock addresses in `lens_accounts.subscription_lock_address`
- [ ] Check lock on Base Sepolia explorer (https://sepolia.basescan.org)
- [ ] Verify lock configuration (price, duration, beneficiary=PKP) on-chain
- [ ] Test subscription purchase flow (frontend integration)
- [ ] Confirm payments route to artist PKP address (not master EOA)

---

## 🔮 Future Enhancements

### Short-term:
1. Automate Lens metadata updates (call `setMetadataURI`)
2. Add per-artist pricing support (read from database)
3. Support ERC20 payments (USDC) in addition to ETH

### Medium-term:
1. Integrate with Story Protocol for automated revenue splits
2. Add subscription management UI (pause, extend, refund)
3. Track subscription analytics (purchases, renewals, churn)

### Long-term:
1. Deploy to Base mainnet (production)
2. Multi-tier subscriptions (basic/premium)
3. NFT-gated content (combine with Unlock keys)
4. Cross-chain lock deployment (Polygon, Arbitrum)

---

## 📚 Additional Resources

- **Unlock Protocol Docs:** https://docs.unlock-protocol.com/
- **Base Sepolia Explorer:** https://sepolia.basescan.org
- **Unlock Contract (Base Sepolia):** `0x259813B665C8f6074391028ef782e27B65840d89`
- **Archived Implementation:** `/archived/unlock-protocol/` (reference code)

---

## 🆘 Troubleshooting

### "PRIVATE_KEY not found in .env"
- Add PRIVATE_KEY to `.env` file
- Format: `PRIVATE_KEY=0x...` or `PRIVATE_KEY=...` (without 0x)

### "Insufficient ETH balance"
- Get Base Sepolia testnet ETH from faucet
- URL: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### "No artists need lock deployment"
- Check if artists have PKP accounts: `SELECT * FROM pkp_accounts WHERE account_type = 'artist'`
- Check if artists have Lens accounts: `SELECT * FROM lens_accounts WHERE account_type = 'artist'`
- Run PKP/Lens creation first: `bun src/processors/mint-pkps.ts --type=artist`

### "Transaction failed"
- Check master EOA balance (need ETH for gas)
- Verify Base Sepolia RPC is responsive
- Check Unlock contract address is correct

### Lock deployed but not showing in database
- Check transaction receipt for lock address
- Verify UPDATE query ran successfully
- Check lens_accounts.subscription_lock_address column

---

**Status:** ✅ Implementation complete, ready for testing

**Next step:** Run migration and deploy first test locks!
