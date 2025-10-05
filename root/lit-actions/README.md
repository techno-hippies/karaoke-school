# Lit Actions

Decentralized serverless functions for the karaoke app, powered by [Lit Protocol](https://developer.litprotocol.com/).

## 📁 Project Structure

```
lit-actions/
├── src/
│   ├── stt/                          # Speech-to-Text actions
│   │   ├── karaoke-scorer-v4.js      # ✅ PRODUCTION - zkSync EIP-712 scoring
│   │   ├── free-v8.js                # Basic STT (no scoring)
│   │   └── keys/                     # Encrypted API keys
│   ├── study/                        # Study/progress tracking
│   │   ├── study-session-recorder-v1.js
│   │   └── test-*.js                 # Debug helpers
│   └── test/                         # Integration tests
│       ├── test-karaoke-scorer-v4.mjs
│       ├── zksync-sig-test.js        # ⭐ zkSync signing reference
│       └── test-zksync-sig.mjs
├── scripts/
│   ├── upload-lit-action.mjs         # Upload to IPFS
│   ├── encrypt-keys-v8.mjs           # Encrypt secrets
│   └── update-pkp-permissions.ts     # Grant PKP permissions
├── output/                           # PKP credentials
└── docs/
    ├── DEPLOYMENT.md                 # Deployment guide
    ├── STUDY_SESSION_RECORDER_README.md
    └── ZKSYNC_EIP712_DEBUGGING.md   # zkSync deep dive
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
# Test karaoke scorer v4 (end-to-end)
bun run test:scorer-v4

# Test zkSync signing only (minimal)
bun run test:zksync
```

## 🎯 Current Production Lit Actions

| Action | CID | Contract | Status |
|--------|-----|----------|--------|
| karaoke-scorer-v4 | `Qme5MZK7vyfEphzmgLJDMA9htkm9Xh37yA4SGfGLdtDStS` | KaraokeScoreboardV4 | ✅ Working |
| study-session-recorder-v1 | `QmaesnxLXgyNDEpLm563xA4VcNsT2zqSysw6CtwDJgMw77` | StudyProgressV1 | ✅ Working |

### Karaoke Scorer v4

**New Architecture:**
- Uses `SongCatalogV1` for song metadata (replaces ClipRegistry)
- Uses `KaraokeScoreboardV4` with multi-source support
- Scores individual segments (verse-1, chorus-1, etc.)
- **zkSync EIP-712 transactions** signed by PKP

**Flow:**
1. Query SongCatalogV1 for song metadata → Grove URI
2. Fetch segment lyrics from metadataUri (word-level timestamps)
3. Transcribe user audio using Voxstral STT API
4. Calculate similarity score (transcript vs expected lyrics)
5. Submit score to KaraokeScoreboardV4 via zkSync EIP-712 transaction

**Deployed Contracts (Lens Testnet):**
- SongCatalogV1: `0x88996135809cc745E6d8966e3a7A01389C774910`
- KaraokeScoreboardV4: `0x8301E4bbe0C244870a4BC44ccF0241A908293d36`

**Test:**
```bash
bun run test:scorer-v4
```

**Critical Fix Applied:** [ZKSYNC_EIP712_DEBUGGING.md](./ZKSYNC_EIP712_DEBUGGING.md)
- yParity encoding fix (v → yParity conversion)
- Gas limit increased to 2M
- 10+ hour debugging journey documented

## 🔐 Secrets Management

### Encrypted Secrets (Voxstral API Key)

Stored in: `src/stt/keys/voxstral_api_key.json`

**Access Control:** CID-locked to specific Lit Action

**Re-encrypt when:**
- New Lit Action version uploaded (new CID)
- API key rotation
- Access control changes

```bash
VOXSTRAL_API_KEY=your-key node scripts/encrypt-keys-v8.mjs \
  --cid QmNewCID \
  --key voxstral_api_key \
  --output src/stt/keys/voxstral_api_key.json
```

### PKP Permissions

After uploading new Lit Action, grant PKP permission:

```bash
PRIVATE_KEY=your-key timeout 90 bun run scripts/update-pkp-permissions.ts QmNewCID
```

## 🧪 Testing

### End-to-End Tests

```bash
# Karaoke scorer v4 (full flow: audio → transcript → score → blockchain)
bun run test:scorer-v4

# Study session recorder
bun run test:study-recorder-v1
```

### zkSync Reference Tests

**⭐ Important:** `src/test/zksync-sig-test.js` is a **critical reference** for zkSync EIP-712 signing.

This minimal test proved essential during debugging:
- Tests ONLY zkSync transaction signing (no audio, no API keys)
- Demonstrates correct yParity encoding (v → yParity conversion)
- Shows proper RLP structure for zkSync transactions
- Validates signature recovery before submission

**Do not delete** - saved 10+ hours of debugging!

```bash
bun run test:zksync
```

## 📦 Deployment

### 1. Upload to IPFS

```bash
DOTENV_PRIVATE_KEY='your-key' npx dotenvx run -- \
  node scripts/upload-lit-action.mjs \
  src/stt/karaoke-scorer-v4.js \
  "Karaoke Scorer v4"
```

### 2. Re-encrypt Secrets

```bash
VOXSTRAL_API_KEY=your-key node scripts/encrypt-keys-v8.mjs \
  --cid QmNewCID \
  --key voxstral_api_key \
  --output src/stt/keys/voxstral_api_key.json
```

### 3. Update PKP Permissions

```bash
PRIVATE_KEY=your-key timeout 90 bun run scripts/update-pkp-permissions.ts QmNewCID
```

### 4. Update Frontend Config

```typescript
// site/src/config/lit-actions.ts
export const LIT_ACTIONS = {
  karaoke: {
    scorer: {
      cid: 'QmNewCID',
      version: 'v4',
    },
  },
};
```

### 5. Test Integration

```bash
bun run test:scorer-v4
```

## 📚 Documentation

- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Full deployment guide
- [ZKSYNC_EIP712_DEBUGGING.md](./docs/ZKSYNC_EIP712_DEBUGGING.md) - zkSync EIP-712 deep dive
- [STUDY_SESSION_RECORDER_README.md](./docs/STUDY_SESSION_RECORDER_README.md) - Study session recorder docs

## 🔗 Resources

- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [zkSync EIP-712 Spec](https://github.com/matter-labs/zksync-era/blob/main/docs/specs/zk_evm/eip712.md)
- [Pinata IPFS](https://docs.pinata.cloud/)
- [Lens Testnet Explorer](https://explorer.testnet.lens.xyz/)

## 🛠️ Development Scripts

```bash
# Install dependencies
bun install

# Run tests
bun run test:scorer-v4
bun run test:zksync
bun run test:study-recorder-v1

# Upload to IPFS
DOTENV_PRIVATE_KEY='...' npx dotenvx run -- \
  node scripts/upload-lit-action.mjs <file> <name>

# Encrypt secrets
API_KEY=... node scripts/encrypt-keys-v8.mjs --cid <cid> --key <name> --output <path>

# Update PKP permissions
PRIVATE_KEY=... timeout 90 bun run scripts/update-pkp-permissions.ts <cid>
```

## ⚠️ Important Notes

### zkSync EIP-712 Transactions

- Use **yParity (0/1)** in RLP field 7, NOT v (27/28)
- Gas limit must be generous (2M for scoreboard contract)
- See [ZKSYNC_EIP712_DEBUGGING.md](./ZKSYNC_EIP712_DEBUGGING.md) for details

### IPFS CID Management

- Each code change requires new IPFS upload → new CID
- Re-encrypt ALL secrets for new CID
- Update PKP permissions for new CID
- Update all test files with new CID

### Test Files to Keep

- `zksync-sig-test.js` - Critical reference for zkSync signing
- `test-karaoke-scorer-v4.mjs` - End-to-end production test
- Study test files - Minimal debug helpers (< 3KB each)

---

**Status:** ✅ karaoke-scorer-v4 fully operational on Lens Testnet with zkSync EIP-712 PKP-signed transactions
