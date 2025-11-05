# Audio Processor Test Setup

This guide explains how to test the audio processor Lit Action with credit validation.

## Overview

The audio processor requires segment ownership before generating karaoke stems. This ensures users have paid for the segment via the KaraokeCredits contract.

## Test Flow

```
1. Grant credits to test wallet (if needed)
2. Unlock test segment (deduct 1 credit)
3. Run audio processor test (validates ownership, then processes)
```

## Quick Start

### 1. Setup Test Credits

Run the setup script to grant credits and unlock the test segment:

```bash
cd lit-actions
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
dotenvx run -- bash scripts/setup-test-credits.sh
```

This will:
- Check current credit balance
- Check if segment is already owned
- Unlock segment if not owned (uses 1 credit)

### 2. Run Test

After setup, deploy and test your lit actions:

```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
dotenvx run -- bun run scripts/upload-lit-action.mjs study/sat-it-back-v1.js 'Sat It Back v1'
```

## Manual Credit Management

### Check Credit Balance

```bash
cast call 0x6de183934E68051c407266F877fafE5C20F74653 \
  "getCredits(address)(uint256)" \
  <YOUR_ADDRESS> \
  --rpc-url https://sepolia.base.org
```

### Check Segment Ownership

```bash
cast call 0x6de183934E68051c407266F877fafE5C20F74653 \
  "ownsSegment(address,uint8,string,string)(bool)" \
  <YOUR_ADDRESS> 1 "378195" "verse-1" \
  --rpc-url https://sepolia.base.org
```

### Grant Credits (Owner/PKP only)

```bash
cast send 0x6de183934E68051c407266F877fafE5C20F74653 \
  "grantCredits(address,uint16,string)" \
  <USER_ADDRESS> 5 "test_setup" \
  --rpc-url https://sepolia.base.org \
  --private-key <OWNER_PRIVATE_KEY>
```

### Purchase Credits with ETH

```bash
cast send 0x6de183934E68051c407266F877fafE5C20F74653 \
  "purchaseCreditsETH(uint8)" 0 \
  --value 0.0002ether \
  --rpc-url https://sepolia.base.org \
  --private-key <YOUR_PRIVATE_KEY>
```

### Unlock Segment

```bash
cast send 0x6de183934E68051c407266F877fafE5C20F74653 \
  "useCredit(uint8,string,string)" \
  1 "378195" "verse-1" \
  --rpc-url https://sepolia.base.org \
  --private-key <YOUR_PRIVATE_KEY>
```

## Test Data

- **Song**: Sia - Chandelier (Genius ID: 378195)
- **Segment**: Verse 1 (0-23s)
- **Segment ID**: "verse-1"
- **Source**: 1 (ContentSource.Genius)

## Contract Addresses

- **KaraokeCredits**: `0x6de183934E68051c407266F877fafE5C20F74653` (Base Sepolia)
- **RPC**: `https://sepolia.base.org`
- **Explorer**: `https://sepolia.basescan.org`

## Troubleshooting

### "Segment not owned" Error

If the test fails with ownership error:
1. Run `scripts/setup-test-credits.sh` again
2. Check segment ownership manually (see commands above)
3. Verify you're using the correct wallet address

### "Insufficient credits" Error

If setup script shows 0 credits:
1. Grant credits using owner/PKP account
2. Or purchase credits with ETH (see commands above)

### Test Timeout

If the test times out:
- Modal processing takes ~31 seconds
- Total test time should be ~35-40 seconds
- Check Modal API status if consistently timing out
