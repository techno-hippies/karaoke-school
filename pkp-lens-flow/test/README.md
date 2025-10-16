# Unlock Protocol Tests

Test scripts for verifying the subscription lock functionality with a separate test account (NOT the master EOA).

## Setup

**1. Generate test account:**
```bash
bun run test:generate-account
```

This creates a fresh wallet at `test/test-account.json` (gitignored).

**2. Fund test account:**

Send **0.02 ETH** to the generated address on Base Sepolia:
```
Address: 0x655db2d11b3964a62B17076379BA2654e7D35F57
```

Get testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## Available Tests

### 1. Check Lock Info

View the subscription pricing and configuration:

```bash
bun run test:lock-info @charlidamelio
```

Output:
- Key price (0.01 ETH)
- Duration (30 days)
- Max keys (unlimited)
- Keys sold so far
- Cost breakdown (1/3/12 months)

**Check if specific address has a valid key:**
```bash
bun run test:lock-info @charlidamelio --check-address 0x0C6433789d14050aF47198B2751f6689731Ca79C
```

### 2. Purchase Test Key

Purchase a subscription key with your wallet:

```bash
bun run test:purchase-key @charlidamelio
```

This will:
1. Check your balance (requires Base Sepolia ETH)
2. Read the key price from the lock
3. Purchase a subscription key
4. Verify you now have access

**Get testnet ETH:**
- Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### 3. Decrypt Video (TODO)

Test decrypting an encrypted video:

```bash
bun run test:decrypt-video @charlidamelio
```

This will:
1. Check if you have a valid key
2. Fetch encrypted video from Grove
3. Use Lit Protocol to decrypt
4. Verify content is accessible

## Current Pricing

- **Price:** 0.01 ETH/month (~$25 USD)
- **Duration:** 30 days
- **Token:** Native ETH (Base Sepolia)
- **Max Supply:** Unlimited

### Cost Calculator

| Duration | Cost (ETH) | Cost (USD @ $2,500/ETH) |
|----------|------------|-------------------------|
| 1 month  | 0.01       | $25                     |
| 3 months | 0.03       | $75                     |
| 6 months | 0.06       | $150                    |
| 1 year   | 0.12       | $300                    |

## Lock Details

**Lock Address:** `0x3ed620cd13a71f35f90e296a78853b5e7bdbceaf`
**Chain:** Base Sepolia
**Version:** Unlock v14

**View on BaseScan:**
https://sepolia.basescan.org/address/0x3ed620cd13a71f35f90e296a78853b5e7bdbceaf

## Access Control Flow

```
User wants to view content
       ↓
Check: Does user have valid Unlock key?
       ↓
  ┌────NO────┐         ┌────YES────┐
  ↓           ↓         ↓           ↓
Purchase key  Error   Fetch video  Success
       ↓               from Grove
  Retry check               ↓
                    Decrypt with Lit
                            ↓
                    Play video
```

## Troubleshooting

**"Insufficient balance"**
- Get testnet ETH from the Base Sepolia faucet

**"Already have a valid key"**
- Your account already has an active subscription
- Keys are valid for 30 days from purchase

**"Lock not found"**
- Run `bun run deploy-lock --creator @handle` first

**Contract reverted errors**
- Check you're on Base Sepolia
- Verify lock address in data/lens/{handle}.json
