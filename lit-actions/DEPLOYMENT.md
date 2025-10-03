# Lit Actions Deployment Guide

This guide explains how to deploy and manage Lit Actions for the frontend.

## 📁 File Structure

```
lit-actions/
├── src/
│   ├── stt/                     # Speech-to-Text actions
│   │   ├── karaoke-scorer-v3.js # Production STT
│   │   ├── free-v8.js           # Basic STT
│   │   └── keys/                # Encrypted keys
│   └── search/                  # Search actions
│       ├── free.js              # Genius search
│       └── keys/                # Encrypted keys
├── scripts/
│   ├── upload-lit-action.mjs    # Upload to IPFS
│   └── encrypt-keys-v8.mjs      # Encrypt secrets
└── DEPLOYMENT.md               # This file
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
| free-v8 | `QmQ721ZFN4zwTkQ4DXXCzTdWzWF5dBQTRbjs2LMdjnN4Fj` | ✅ Production | v8 jsParams pattern |
| free-v3 | `QmS1ZUdhinpLmu6fw7GMzu7ktBk3EXwrjK6oJgvtnfm38B` | ⚠️ Legacy | Old pattern (no jsParams) |

### STT Actions

| Version | CID | Status | Notes |
|---------|-----|--------|-------|
| karaoke-scorer-v3 | `QmS3Q7pcRXvb12pB2e681YMq1BWqyGY5MUdzT8sFEs4rzs` | ✅ Production | With ClipRegistry integration |
| free-v8 | TBD | 🚧 Pending | Basic STT only |

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

## 📚 Resources

- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [Pinata Docs](https://docs.pinata.cloud/)
- [Production README](./KARAOKE_SCORER_PRODUCTION_README.md)
