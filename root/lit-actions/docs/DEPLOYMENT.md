# Lit Actions Deployment Guide

This guide explains how to deploy and manage Lit Actions for the frontend.

## 📁 File Structure

```
lit-actions/
├── src/
│   ├── stt/                     # Speech-to-Text actions
│   │   ├── karaoke-scorer-v4.js # ✅ PRODUCTION - zkSync EIP-712 scoring
│   │   ├── free-v8.js           # Basic STT (no scoring)
│   │   └── keys/                # Encrypted keys
│   ├── study/                   # Study/Progress actions
│   │   └── study-session-recorder-v1.js  # Study session tracking
│   └── test/                    # Integration tests
│       ├── test-karaoke-scorer-v4.mjs
│       ├── zksync-sig-test.js   # ⭐ zkSync signing reference (keep!)
│       └── test-study-session-recorder-v1.mjs
├── scripts/
│   ├── upload-lit-action.mjs    # Upload to IPFS
│   ├── encrypt-keys-v8.mjs      # Encrypt secrets
│   └── update-pkp-permissions.ts # Grant PKP permissions
├── docs/
│   ├── DEPLOYMENT.md            # This file
│   ├── ZKSYNC_EIP712_DEBUGGING.md # zkSync EIP-712 deep dive
│   └── STUDY_SESSION_RECORDER_README.md
└── README.md                    # Quick start guide
```

## 🚀 Deployment Process

### 1. Upload Lit Action to IPFS

```bash
cd lit-actions

# Upload a Lit Action to Pinata
DOTENV_PRIVATE_KEY='your-key' npx dotenvx run -- \
  node scripts/upload-lit-action.mjs \
  src/search/free.js \
  "Genius Search Free"
```

This will return a CID like:
```
✅ Upload successful!
📦 CID: QmS1ZUdhinpLmu6fw7GMzu7ktBk3EXwrjK6oJgvtnfm38B
🏷️  Name: Genius Search Free
🔗 Gateway URL: https://gateway.pinata.cloud/ipfs/QmS1ZUdhinpLmu6fw7GMzu7ktBk3EXwrjK6oJgvtnfm38B
```

### 2. Encrypt Secrets (if needed)

If your Lit Action uses encrypted secrets:

```bash
# Encrypt API keys
API_KEY=your-api-key node scripts/encrypt-keys-v8.mjs \
  --cid QmS1ZUdhinpLmu6fw7GMzu7ktBk3EXwrjK6oJgvtnfm38B \
  --key api_key_name \
  --output src/search/keys/api_key_name.json
```

This creates a JSON file with:
- `ciphertext` - Encrypted key
- `dataToEncryptHash` - Hash for decryption
- `accessControlConditions` - CID-locked access control
- `cid` - The IPFS CID this key is locked to

### 3. Update Frontend Configuration

Update `site/src/config/lit-actions.ts` with the new CID:

```typescript
export const LIT_ACTIONS = {
  search: {
    free: {
      cid: 'QmNewCIDHere',  // ← Update this
      version: 'free-v3',
      network: 'ethereum',
      description: 'Search Genius API for songs',
    },
  },
} as const;
```

### 4. Test the Integration

```bash
cd site
npm run dev

# Navigate to: http://localhost:5174/#/create/song-picker
# Try searching for songs
```

## 📝 Current Deployments

### Search Actions

| Version | CID | Status | Notes |
|---------|-----|--------|-------|
| free-v8 | `QmQ721ZFN4zwTkQ4DXXCzTdWzWF5dBQTRbjs2LMdjnN4Fj` | ✅ Production | Search for songs (v8 jsParams) |
| song-free-v1 | `QmNvX8u4mE6xqEPeC5vk77xJVLK6W7YB2u4GdFmbnCmDGv` | ✅ Production | Fetch song metadata (v8 jsParams) |
| referents-free-v1 | `QmZXKFHfnmuUTM7bY8dDgpBdj57aRTVcWK6KvpidKekrQK` | ✅ Production | Fetch lyric referents (v8 jsParams) |
| free-v3 | `QmS1ZUdhinpLmu6fw7GMzu7ktBk3EXwrjK6oJgvtnfm38B` | ⚠️ Legacy | Old pattern (no jsParams) |

### STT Actions

| Version | CID | Status | Notes |
|---------|-----|--------|-------|
| karaoke-scorer-v4 | `Qme5MZK7vyfEphzmgLJDMA9htkm9Xh37yA4SGfGLdtDStS` | ✅ Production | zkSync EIP-712, SongCatalogV1, KaraokeScoreboardV4 |
| free-v8 | TBD | 📦 Available | Basic STT only (no scoring) |

### Study Actions

| Version | CID | Status | Notes |
|---------|-----|--------|-------|
| trivia-generator-v8 | `QmdezmuwUmdEWTFLcqGKsD4WLSr1wECcQXAaddm3jsMqf9` | ✅ Production | Generates trivia from referents/annotations (v8 jsParams) |
| study-session-recorder-v1 | `QmaesnxLXgyNDEpLm563xA4VcNsT2zqSysw6CtwDJgMw77` | ✅ Production | Records study sessions to StudyProgressV1 contract |

## 🔐 Secrets Management

### Encrypted Secrets (Voxstral API Key)

Stored in: `lit-actions/src/stt/keys/voxstral_api_key.json`

Access control: CID-locked to specific Lit Action

Re-encryption required when:
- Uploading new Lit Action version (new CID)
- Rotating API keys
- Changing access control conditions

### Exposed Secrets (Genius API Key)

For **free tier** actions, the API key is hardcoded in the Lit Action code:

```javascript
// lit-actions/src/search/free.js
const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';
```

This is **intentional** for:
- No wallet connection required
- Simpler user experience
- Rate-limited by Genius anyway

## 🔄 Version Management

### When to Create a New Version

Create a new Lit Action version when:
1. **Breaking Changes**: API response format changes
2. **New Features**: Adding new parameters or functionality
3. **Security Fixes**: Critical security improvements
4. **Performance**: Significant optimizations

### Version Naming Convention

- `v1`, `v2`, `v3` - Major versions with breaking changes
- `free-v3` - Free tier variant
- `karaoke-scorer-v3` - Feature-specific naming

### Backwards Compatibility

The frontend config allows multiple versions:

```typescript
export const LIT_ACTIONS = {
  search: {
    free: { cid: 'QmNewVersion', version: 'free-v3' },
    freeLegacy: { cid: 'QmOldVersion', version: 'free-v2' },
  },
}
```

## 🧪 Testing Checklist

Before deploying to production:

- [ ] Upload to IPFS and get CID
- [ ] Encrypt any new secrets with new CID
- [ ] Update `lit-actions.ts` config
- [ ] Test in local dev environment
- [ ] Verify analytics (if applicable)
- [ ] Check error handling
- [ ] Update documentation

## 🐛 Troubleshooting

### "Failed to fetch Lit Action"

**Cause**: CID not found on IPFS or not propagated yet

**Solution**: Wait 1-2 minutes for IPFS propagation, or try different gateway

### "Decryption failed"

**Cause**: Encrypted keys locked to different CID

**Solution**: Re-encrypt keys with correct CID using `encrypt-keys-v8.mjs`

### "Lit Node Client connection failed"

**Cause**: Network issues or wrong Lit Network

**Solution**: Check `LitSearchService.ts` uses correct network (DatilDev for testnet)

## 🆕 New Lit Actions (Not Yet Deployed)

### study-session-recorder-v1

**Purpose**: Records completed study sessions to StudyProgressV1 contract with optional FSRS encryption

**File**: `src/study/study-session-recorder-v1.js`

**Contract Integration**: StudyProgressV1 (needs deployment address)

**Key Features**:
- Records study sessions on-chain (`recordStudySession()`)
- Encrypts FSRS spaced repetition data using `Lit.Actions.encrypt()`
- Stores encrypted FSRS on-chain (`storeEncryptedFSRS()`)
- Two-transaction pattern (session + FSRS)
- Parameter validation for user inputs
- Hardcoded public contract address (v3 pattern)

**Required Parameters**:
- `userAddress` - User's wallet address
- `source` - ContentSource enum (0=Native, 1=Genius)
- `contentId` - Song/segment identifier
- `itemsReviewed` - Number of items reviewed (uint16)
- `averageScore` - Average score 0-100 (uint8)
- `pkpPublicKey` - PKP public key for transaction signing

**Optional Parameters**:
- `fsrsData` - JSON object with FSRS state (encrypted if provided)
- `fsrsAccessControlConditions` - Access control for encrypted FSRS

**Deployment Details**:
- Contract: StudyProgressV1 @ `0x784Ff3655B8FDb37b5CFB831C531482A606365f1` (Lens Testnet)
- CID: `QmaesnxLXgyNDEpLm563xA4VcNsT2zqSysw6CtwDJgMw77`
- Deployment Date: 2025-10-03
- Uses `waitForResponse: false` pattern (fire-and-forget transactions)

**Important Notes**:
- Transaction hashes are NOT returned due to `waitForResponse: false` (prevents timeout)
- FSRS data must be pre-encrypted client-side (Lit Action does not encrypt)
- Uses ethers v5.7.0 (Lit Actions runtime)

**Test File**: `src/test/test-study-session-recorder-v1.mjs`

## 📚 Resources

- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [Pinata Docs](https://docs.pinata.cloud/)
- [Production README](./KARAOKE_SCORER_PRODUCTION_README.md)
