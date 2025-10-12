# Lit Actions

Decentralized serverless functions for the karaoke app, powered by [Lit Protocol](https://developer.litprotocol.com/).

## 📁 Project Structure

```
lit-actions/
├── src/
│   ├── karaoke/                    # Karaoke pipeline actions
│   │   ├── match-and-segment-v5.js # ✅ PRODUCTION - Genius + LRClib lyrics
│   │   ├── match-and-segment-v6.js # ✅ PRODUCTION - Fast (no alignment)
│   │   ├── audio-processor-v4.js   # ✅ PRODUCTION - Song-based Demucs
│   │   ├── update-karaoke-contract-batch.js  # ✅ PRODUCTION - Batch updates
│   │   ├── auto-purchase-credits.js # ✅ PRODUCTION - Auto credit purchase
│   │   ├── contracts.config.js     # Contract addresses
│   │   ├── keys/                   # Encrypted API keys (CID-locked)
│   │   └── archive/                # Old versions (v1-v4)
│   ├── genius/                     # Genius API helpers
│   ├── quiz/                       # Quiz features
│   ├── stt/                        # Speech-to-text
│   ├── study/                      # Study features
│   └── test/                       # Integration tests
│       ├── test-match-and-segment-v5.mjs
│       ├── test-match-and-segment-v6.mjs
│       ├── test-audio-processor-v4.mjs
│       ├── test-auto-purchase-credits.mjs
│       └── archive/                # Old test files
├── scripts/
│   ├── upload-lit-action.mjs       # Upload to IPFS
│   ├── encrypt-keys-v8.mjs         # Encrypt secrets
│   ├── add-pkp-permission.mjs      # Grant PKP permissions
│   └── mint-pkp.ts                 # Mint new PKP
├── docs/
│   ├── DEPLOYMENT.md               # Deployment guide
│   ├── AUTO_PURCHASE_CREDITS.md    # Auto credit purchase flow
│   ├── PIPELINE_ANALYSIS.md        # Pipeline architecture
│   ├── README-AUDIO-PROCESSOR-V2.md
│   └── archive/                    # Deprecated docs
├── test-fixtures/                  # Test audio files
├── output/                         # PKP credentials (gitignored)
├── test-results/                   # Test logs (gitignored)
└── README.md                       # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Add your PRIVATE_KEY, PINATA_JWT, etc.
```

### 3. Run Tests

```bash
# Test match and segment v5 (with lyrics alignment)
bun run test:match-segment-v5

# Test match and segment v6 (fast - no alignment)
bun run test:match-segment-v6

# Test audio processor v4 (Demucs separation)
bun run test:audio-processor-v4

# Test auto credit purchase
bun run test:auto-purchase
```

## 🎯 Current Production Lit Actions

| Action | Version | CID | Contract | Network | Status |
|--------|---------|-----|----------|---------|--------|
| **match-and-segment** | v6 | `QmeEcXsV6F43NKSbfeqAfCismHWUpjmPo642SHikTyG2FX` | KaraokeCatalogV2 | Base Sepolia | ✅ Latest |
| match-and-segment | v5 | `QmWkjzoKzsqJHTsC6npQJR1Dk2dmWa5p88nTBCSEtVArdN` | KaraokeCatalogV2 | Base Sepolia | ✅ Active |
| audio-processor | v4 | `[Latest CID]` | KaraokeCatalogV2 | Base Sepolia | ✅ Active |
| update-contract-batch | v1 | `[Latest CID]` | KaraokeCatalogV2 | Base Sepolia | ✅ Active |
| auto-purchase-credits | v1 | `[Latest CID]` | KaraokeCreditsV1 | Base Sepolia | ✅ Active |

### Match and Segment (v5 & v6)

**Architecture:**
- AI-powered song matching (Genius → LRClib)
- Intelligent song segmentation (verse, chorus, etc.)
- PKP-signed EIP-155 transactions
- Fire-and-forget pattern with `Lit.Actions.runOnce()`

**v5 vs v6:**
- v5: With lyrics alignment (slower, more accurate)
- v6: Without lyrics alignment (faster, uses LRClib directly)

**Flow:**
1. Fetch song metadata from Genius API
2. Search LRClib for synced lyrics
3. AI validates match (artist + title comparison) [v5 only]
4. AI segments lyrics into karaoke sections (5 max)
5. Sign and submit batch transaction to KaraokeCatalogV2 on Base Sepolia

**Deployed Contracts (Base Sepolia):**
- KaraokeCatalogV2: `0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa`
- KaraokeCreditsV1: `[Address TBD]`

**Test:**
```bash
# Test v5 (with alignment)
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -- timeout 120 bun run src/test/test-match-and-segment-v5.mjs 378195

# Test v6 (fast, no alignment)
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -- timeout 120 bun run src/test/test-match-and-segment-v6.mjs 378195
```

### Audio Processor v4

**Architecture:**
- Song-based Demucs audio separation
- Modal deployment for GPU processing
- Processes full songs (not individual segments)

**Test:**
```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -- timeout 240 bun run src/test/test-audio-processor-v4.mjs
```

### Auto Purchase Credits

**Architecture:**
- Automatically purchases karaoke credits using USDC
- Monitors credit balance and auto-tops up when low
- Integrates with KaraokeCreditsV1 contract

**Documentation:** See [docs/AUTO_PURCHASE_CREDITS.md](./docs/AUTO_PURCHASE_CREDITS.md)

**Test:**
```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -- node src/test/test-auto-purchase-credits.mjs
```

## 🔐 Secrets Management

### Encrypted Secrets

Secrets are stored encrypted and CID-locked to specific Lit Actions.

**Current keys:**
- `openrouter_api_key` - For AI models (Claude, GPT-4)
- `genius_api_key` - For Genius API
- `elevenlabs_api_key` - For voice synthesis

**Location:** `src/karaoke/keys/`

**Re-encrypt when:**
- New Lit Action version uploaded (new CID)
- API key rotation
- Access control changes

```bash
# Encrypt all keys for a new CID
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
  dotenvx run -- bash -c '
    node scripts/encrypt-keys-v8.mjs \
      --cid QmNewCID \
      --key openrouter_api_key \
      --output src/karaoke/keys/openrouter_api_key_v9.json >/dev/null 2>&1 && \
    node scripts/encrypt-keys-v8.mjs \
      --cid QmNewCID \
      --key genius_api_key \
      --output src/karaoke/keys/genius_api_key_v9.json >/dev/null 2>&1 && \
    echo "✅ All keys encrypted for QmNewCID"
  '
```

### PKP Permissions

After uploading new Lit Action, grant PKP permission:

```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
  dotenvx run -- bun run scripts/add-pkp-permission.mjs QmNewCID
```

## 🧪 Testing

### Available Test Scripts

```bash
# Main karaoke tests
bun run test:match-segment-v5    # Match and segment with alignment
bun run test:match-segment-v6    # Match and segment (fast)
bun run test:audio-processor-v4  # Audio processing with Demucs
bun run test:auto-purchase       # Auto credit purchase

# Other features
bun run test:trivia-gen          # Trivia generator
bun run test:scorer-v4           # Karaoke scorer (archived)
```

### Test Song IDs

Common test songs:
- `378195` - Chandelier by Sia
- `5108762` - Breathe Deeper by Tame Impala
- `2165830` - Another test song
- `12325692` - Another test song

## 📦 Deployment

### 1. Upload to IPFS

```bash
DOTENV_PRIVATE_KEY='your-key' npx dotenvx run -- \
  node scripts/upload-lit-action.mjs \
  src/karaoke/match-and-segment-v6.js \
  "Match and Segment V6 (Fast)"
```

**Output:** New IPFS CID (e.g., `QmeEcXsV6F43NKSbfeqAfCismHWUpjmPo642SHikTyG2FX`)

### 2. Re-encrypt Secrets

```bash
# Use the new CID from step 1
DOTENV_PRIVATE_KEY='your-key' npx dotenvx run -- bash -c '
  node scripts/encrypt-keys-v8.mjs \
    --cid QmNewCID \
    --key openrouter_api_key \
    --output src/karaoke/keys/openrouter_api_key_v10.json && \
  node scripts/encrypt-keys-v8.mjs \
    --cid QmNewCID \
    --key genius_api_key \
    --output src/karaoke/keys/genius_api_key_v10.json
'
```

### 3. Update PKP Permissions

```bash
DOTENV_PRIVATE_KEY='your-key' npx dotenvx run -- \
  bun run scripts/add-pkp-permission.mjs QmNewCID
```

### 4. Update Frontend Config

```typescript
// app/src/lib/lit/actions.ts
export const LIT_ACTIONS = {
  matchAndSegment: {
    cid: 'QmNewCID',
    version: 'v6',
  },
};
```

### 5. Test Integration

```bash
bun run test:match-segment-v6
```

## 📚 Documentation

- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Full deployment guide
- [AUTO_PURCHASE_CREDITS.md](./docs/AUTO_PURCHASE_CREDITS.md) - Auto credit purchase flow
- [PIPELINE_ANALYSIS.md](./docs/PIPELINE_ANALYSIS.md) - Pipeline architecture deep dive
- [README-AUDIO-PROCESSOR-V2.md](./docs/README-AUDIO-PROCESSOR-V2.md) - Audio processor details

## 🔗 Resources

- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [Pinata IPFS](https://docs.pinata.cloud/)
- [Base Sepolia Explorer](https://sepolia.basescan.org/)

## 🛠️ Development Scripts

```bash
# Install dependencies
bun install

# Run tests (see Testing section above)
bun run test:match-segment-v6
bun run test:audio-processor-v4

# Upload to IPFS
DOTENV_PRIVATE_KEY='...' npx dotenvx run -- \
  node scripts/upload-lit-action.mjs <file> <name>

# Encrypt secrets
DOTENV_PRIVATE_KEY='...' npx dotenvx run -- \
  node scripts/encrypt-keys-v8.mjs --cid <cid> --key <name> --output <path>

# Update PKP permissions
DOTENV_PRIVATE_KEY='...' npx dotenvx run -- \
  bun run scripts/add-pkp-permission.mjs <cid>
```

## ⚠️ Important Notes

### IPFS CID Management

- Each code change requires new IPFS upload → new CID
- Re-encrypt ALL secrets for new CID
- Update PKP permissions for new CID
- Update frontend config with new CID
- Update test files with new CID (if needed)

### Contract Addresses

All contracts deployed on **Base Sepolia** testnet:
- KaraokeCatalogV2: `0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa`
- KaraokeCreditsV1: `[TBD]`
- PKP Address: `0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30`

### Archive Strategy

Old versions are preserved in `archive/` folders:
- `src/karaoke/archive/` - Old Lit Action versions
- `src/test/archive/` - Old test files
- `docs/archive/` - Deprecated documentation

**Do not delete archives** - they contain valuable reference code and debugging history.

---

**Status:** ✅ All production actions operational on Base Sepolia with EIP-155 PKP-signed transactions
