# PKP Setup Guide

Complete guide for creating and configuring a PKP (Programmable Key Pair) for the Karaoke Scoreboard.

## What is a PKP?

A PKP is a Programmable Key Pair from Lit Protocol that can:
- Sign transactions automatically via Lit Actions (serverless functions)
- Be controlled by permissions (only specific Lit Actions can use it)
- Act as a trusted "scorer" for our karaoke game

**Why we need it:**
- Prevents users from cheating (they can't fake scores)
- Automates score submission to the blockchain
- Decentralized and trustless (no central server needed)

---

## Quick Start

### Prerequisites

✅ **Installed:**
- Bun package manager
- Lit Protocol SDK (installed via `bun install`)

📋 **Needed:**
- Chronicle Yellowstone testnet tokens (for PKP minting)
- Lens Chain testnet tokens (for PKP gas)

---

## Step-by-Step Setup

### 1. Get Chronicle Yellowstone Tokens

**Test Wallet Address:** `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`

Visit the faucet and request tokens:
- **Faucet URL:** https://chronicle-yellowstone-faucet.getlit.dev/
- **Network:** Chronicle Yellowstone Testnet
- **Amount needed:** ~0.01 ETH (for PKP minting gas)

How to use the faucet:
1. Visit the faucet URL
2. Paste address: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`
3. Complete CAPTCHA
4. Wait for tokens (~1 minute)

Verify you received tokens:
```bash
# You can check on the explorer or wait for mint-pkp script to check
```

---

### 2. Mint the PKP

Once you have Chronicle Yellowstone tokens, run:

```bash
cd contracts
bun run mint-pkp
```

**What this script does:**

1. ✅ Connects to Lit Protocol (nagaDev network)
2. ✅ Creates account from test wallet private key
3. ✅ Checks Chronicle Yellowstone balance
4. ✅ Mints a new PKP using your EOA
5. ✅ Adds "sign-anything" permission to the PKP
6. ✅ Saves PKP credentials to `output/pkp-credentials.json`
7. ✅ Updates `.env` with `PKP_ADDRESS`

**Expected output:**
```
🔐 Lit Protocol PKP Minting Script
===================================

📝 Creating account from private key...
✅ Account address: 0x5C3c78DA1a4A4622486b4470d2a70cdF43052990

🔌 Connecting to Lit Protocol (nagaDev network)...
✅ Connected to Lit Network

🪙 Minting PKP with your EOA...
   This may take a minute...
✅ PKP Minted Successfully!

📊 PKP Details:
   Token ID: 0x...
   Public Key: 0x04...
   ETH Address: 0x...

✨ PKP Setup Complete!
```

**What you get:**
- PKP ETH address (this will be the trusted scorer)
- PKP credentials file (`output/pkp-credentials.json`)
- Updated `.env` with `PKP_ADDRESS`

---

### 3. Get Lens Chain Testnet Tokens

Now you need to fund your deployer wallet AND the PKP on Lens Chain.

**Deployer wallet:** `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`
**PKP address:** (check `.env` or `output/pkp-credentials.json`)

Visit the Lens Chain faucet:
- **Faucet URL:** https://faucet.lens.xyz
- **Network:** Lens Chain Testnet
- **Addresses to fund:**
  1. Deployer wallet (for contract deployment)
  2. PKP address (for score submission transactions)

**How much to request:**
- Deployer wallet: ~0.2 ETH (for contract deployment)
- PKP address: ~0.5 ETH (for ongoing score submissions)

---

### 4. Fund the PKP

After receiving Lens Chain tokens in your deployer wallet, fund the PKP:

```bash
cd contracts
bun run fund-pkp
```

**Custom amount:**
```bash
bun run fund-pkp --amount 0.5
```

**Or manually with cast:**
```bash
cast send $PKP_ADDRESS --value 0.5ether \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

**Verify PKP balance:**
```bash
cast balance $PKP_ADDRESS --rpc-url https://rpc.testnet.lens.xyz
```

Should show: `500000000000000000` (0.5 ETH in wei)

---

### 5. Verify PKP Setup

Check that everything is configured correctly:

```bash
# 1. Check .env has PKP_ADDRESS
cat .env | grep PKP_ADDRESS

# 2. Check PKP credentials file exists
ls -la output/pkp-credentials.json

# 3. Check PKP balance on Lens Chain
cast balance $PKP_ADDRESS --rpc-url https://rpc.testnet.lens.xyz
```

**Expected results:**
```
PKP_ADDRESS="0x..."
-rw-rw-r-- 1 user user 523 Oct  1 19:45 output/pkp-credentials.json
500000000000000000
```

---

## PKP Credentials File

The `output/pkp-credentials.json` file contains:

```json
{
  "tokenId": "0x...",
  "publicKey": "0x04...",
  "ethAddress": "0x...",
  "owner": "0x5C3c78DA1a4A4622486b4470d2a70cdF43052990",
  "network": "nagaDev",
  "mintedAt": "2025-10-01T19:45:00.000Z",
  "permittedActions": [
    {
      "ipfsId": "QmWGkjZKcfsE9nabey7cXf8ViZ5Mf5CvLFTHbsYa79s3ER",
      "scopes": ["sign-anything"]
    }
  ]
}
```

**⚠️ Important:**
- The `ipfsId` is currently a placeholder
- You'll update this later with your Lit Action's IPFS CID
- Keep this file secure (it's in `.gitignore`)

---

## Next Steps

With your PKP created and funded, you can now:

### 1. Deploy the Scoreboard Contract

```bash
cd contracts

FOUNDRY_PROFILE=zksync forge create \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args "$PKP_ADDRESS" \
  src/KaraokeScoreboardV1.sol:KaraokeScoreboardV1 \
  --zksync \
  --gas-limit 10000000 \
  --gas-price 300000000 \
  --broadcast
```

Save the deployed contract address to `.env`:
```bash
SCOREBOARD_CONTRACT_ADDRESS="0x..."
```

### 2. Update Your Lit Action

Modify `lit-actions/src/stt/free-v8.js` to include score submission logic (see main README.md for full code example).

### 3. Upload Lit Action to IPFS

```bash
# Upload your Lit Action to IPFS
# Get the IPFS CID (QmXXX...)
```

### 4. Update PKP Permissions

Update the PKP to allow your specific Lit Action:

```typescript
// Use Lit SDK to update PKP permissions
await pkpPermissionsManager.addPermittedAction({
  ipfsId: "QmYourActualLitActionCID",
  scopes: ["sign-anything"],
});
```

---

## Troubleshooting

### "PRIVATE_KEY not found in .env"

**Solution:** The `.env` file should already exist. Check it:
```bash
cat contracts/.env
```

If missing, copy from `.env.example`:
```bash
cp .env.example .env
```

### "Insufficient balance" when minting PKP

**Problem:** Not enough Chronicle Yellowstone tokens

**Solution:** Visit the faucet again:
https://chronicle-yellowstone-faucet.getlit.dev/

Address: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`

### "Insufficient balance" when funding PKP

**Problem:** Not enough Lens Chain testnet tokens in deployer wallet

**Solution:** Visit Lens Chain faucet:
https://faucet.lens.xyz

Address: `0x5C3c78DA1a4A4622486b4470d2a70cdF43052990`

### PKP minting taking too long

**Normal:** PKP minting can take 1-2 minutes

**If stuck >5 minutes:**
1. Check Chronicle Yellowstone network status
2. Try again with more gas: (script already sets optimal gas)
3. Check https://explorer.yellowstone.litprotocol.com/ for your transaction

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    Karaoke User                          │
│  (Sings → Speech-to-Text → Score Computed)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Calls Lit Action
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Lit Action (IPFS)                          │
│  - Receives audio + expected lyrics                      │
│  - Calls Voxstral API for transcription                  │
│  - Computes score by comparing transcript                │
│  - Signs transaction with PKP ◄──────────────┐           │
└────────────────────┬────────────────────────┬───────────┘
                     │                         │
                     │ Submits score           │ PKP signs
                     ▼                         │
┌─────────────────────────────────────────────┴───────────┐
│        KaraokeScoreboardV1 Contract (Lens Chain)         │
│  - Verifies caller is trusted PKP                        │
│  - Updates high score if better                          │
│  - Maintains leaderboard                                 │
└──────────────────────────────────────────────────────────┘
```

**Key Points:**
- PKP = trusted automated signer (can't be controlled by users)
- Only the PKP can call `updateScore()` on the contract
- Lit Actions run in secure TEE (Trusted Execution Environment)
- Users can't fake scores because they don't control the PKP

---

## References

- Lit Protocol Docs: https://developer.litprotocol.com/
- Chronicle Yellowstone Faucet: https://chronicle-yellowstone-faucet.getlit.dev/
- Lens Chain Faucet: https://faucet.lens.xyz
- Lens Chain Explorer: https://explorer.testnet.lens.xyz
