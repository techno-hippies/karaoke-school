# Quickstart: Create Beyoncé Artist Profile

This guide walks through creating the Beyoncé artist profile in the karaoke school system.

## Prerequisites

1. **Environment Setup**
   ```bash
   cd master-pipeline
   bun install
   cp .env.example .env
   # Edit .env with your keys
   ```

2. **Required Keys**
   - `PRIVATE_KEY` - Your wallet private key (controls PKPs and contracts)
   - Ensure you have test tokens on Chronicle Yellowstone and Lens Testnet

3. **Deploy Contracts** (if not already deployed)
   ```bash
   cd ../v2-contracts
   forge script script/Deploy.s.sol --broadcast --verify
   # Copy deployed addresses to master-pipeline/config/contracts.json
   ```

## Artist Pipeline

### Option 1: Full Automated Pipeline (Recommended)

```bash
cd master-pipeline

# Run complete artist pipeline
bun run pipeline-artist \
  --name beyonce \
  --genius-id 498 \
  --handle beyonce
```

This will:
1. Mint PKP on Chronicle Yellowstone
2. Create Lens account with metadata
3. Create Lens username (@beyonce)
4. Register in ArtistRegistryV1 contract

**Output:**
- `data/artists/beyonce/pkp.json` - PKP data
- `data/artists/beyonce/lens.json` - Lens data
- `data/artists/beyonce/manifest.json` - Full artist manifest

**Result:** Artist profile ready at `/a/beyonce`

---

### Option 2: Step-by-Step

If you prefer to run each step manually:

```bash
cd master-pipeline

# Step 1: Mint PKP
bun run artists/01-mint-pkp.ts --name beyonce --genius-id 498

# Step 2: Create Lens Account
bun run artists/02-create-lens.ts --name beyonce --handle beyonce

# Step 3: Register in Contract
bun run artists/03-register-artist.ts --name beyonce --genius-id 498
```

---

## Verify Artist Creation

```bash
# Check manifest
cat data/artists/beyonce/manifest.json

# Or use validate script (coming soon)
bun run validate --artist beyonce
```

## Next Steps

Once the artist is created, you can:

1. **Add Songs and Segments**
   ```bash
   # Example: Add "CUFF IT" song
   bun run pipeline-song \
     --artist beyonce \
     --tiktok-url https://www.tiktok.com/music/CUFF-IT-7164943011337561089 \
     --original-path ~/Music/Beyonce/CUFF-IT.flac
   ```

2. **Verify on Lens**
   - Visit Lens Protocol testnet explorer
   - Search for @beyonce
   - View account metadata

3. **Verify on Contract**
   - Check ArtistRegistryV1 for Genius ID 498
   - Should show PKP address and Lens handle

## Troubleshooting

### "Missing required environment variable: PRIVATE_KEY"
- Make sure you've copied `.env.example` to `.env` and filled in your private key

### "Contract addresses not found"
- Deploy v2-contracts first
- Copy deployed addresses to `config/contracts.json`

### "Insufficient funds"
- Get test tokens from faucets:
  - Chronicle Yellowstone: https://chronicle-yellowstone-faucet.getlit.dev/
  - Lens Testnet: https://faucet.lens.dev/

### "Artist already exists"
- Check if artist was already created: `cat data/artists/beyonce/manifest.json`
- To recreate, delete the data folder first: `rm -rf data/artists/beyonce`

## Example Output

```
╔════════════════════════════════════╗
║  Artist Creation Pipeline          ║
╚════════════════════════════════════╝

   Name: beyonce
   Genius ID: 498
   Lens Handle: beyonce

▶  Step 1: Mint PKP

🎨 Minting PKP for beyonce (Genius ID: 498)...
⏳ Minting PKP on Chronicle Yellowstone...
✅ PKP minted successfully
   Address: 0x1234...5678
   Token ID: 891099264949...
   Tx: 0xabcd...
✓  Step 1: Mint PKP - Complete

▶  Step 2: Create Lens Account

🌿 Creating Lens account for beyonce...
📤 Uploading metadata to Grove...
✅ Metadata uploaded: lens://abc123...
⏳ Creating Lens account on-chain...
✅ Lens account created successfully
   Address: 0x9876...5432
   Account ID: 0xdef456...
   Tx: 0x1234...

🏷️  Creating username: @beyonce...
✅ Username created successfully
   Username: @beyonce
   Tx: 0x5678...
✓  Step 2: Create Lens Account - Complete

▶  Step 3: Register in Contract

📝 Registering artist 498 in ArtistRegistry...
⏳ Waiting for transaction: 0x9abc...
✅ Artist registered on-chain
   Tx: 0x9abc...
✓  Step 3: Register in Contract - Complete

✓  ✨ Artist creation complete! (2.34 minutes)
✓  Artist profile ready at: /a/beyonce
```

## Data Structure

After completion, you'll have:

```
data/artists/beyonce/
├── pkp.json          # PKP data (address, token ID, tx)
├── lens.json         # Lens data (handle, account, tx)
└── manifest.json     # Combined metadata
```

**manifest.json structure:**
```json
{
  "name": "beyonce",
  "geniusArtistId": 498,
  "handle": "beyonce",
  "pkp": {
    "pkpEthAddress": "0x...",
    "pkpTokenId": "...",
    "transactionHash": "0x..."
  },
  "lens": {
    "lensHandle": "beyonce",
    "lensAccountAddress": "0x...",
    "lensAccountId": "0x...",
    "transactionHash": "0x..."
  },
  "onchain": {
    "geniusArtistId": 498,
    "pkpAddress": "0x...",
    "lensHandle": "beyonce",
    "lensAccountAddress": "0x...",
    "transactionHash": "0x..."
  },
  "createdAt": "2025-10-20T...",
  "updatedAt": "2025-10-20T..."
}
```

## What's Next?

The artist pipeline is complete! Next steps:

1. **Build Song/Segment Pipeline** - Add TikTok song pages to the artist
2. **Process Audio** - Demucs + Fal.ai for instrumentals
3. **Frontend Integration** - Show artist page at `/a/beyonce`

See [README.md](./README.md) for the full architecture and pipeline overview.
