# Lit Action Development Workflow

## The Problem

Every Lit Action update requires:
1. ✅ Upload to IPFS → **new CID**
2. ✅ Re-encrypt ALL keys for new CID (ACC checks `:currentActionIpfsId`)
3. ✅ Add PKP permissions for new CID
4. ✅ Update frontend .env variables
5. ✅ Test (if broken, repeat ALL steps)

This is **by design** - Lit Protocol's security model requires CID-based encryption. You can't change it.

## The Solution: Automation

### Quick Start

```bash
# ONE command to deploy everything:
cd lit-actions
./scripts/deploy-lit-action.sh \
  src/karaoke/base-alignment-v2.js \
  "Base Alignment v2" \
  VITE_LIT_ACTION_BASE_ALIGNMENT
```

This automatically:
- Uploads to IPFS
- Re-encrypts keys for new CID
- Adds PKP permissions
- Updates `app/.env.local`

### Development Workflow

#### 1. **Local Testing (FAST)**

Test logic BEFORE uploading:

```bash
# Test without IPFS upload (mocked Lit Actions API)
node scripts/test-local-lit-action.mjs \
  src/karaoke/base-alignment-v2.js \
  --geniusId 2843978
```

This runs your code with mocked `Lit.Actions` functions, so you can:
- Test business logic
- Verify API calls
- Debug errors
- **Without** uploading to IPFS!

Limitations:
- Mocked PKP signing (won't actually sign)
- Mocked decryption (uses plaintext env vars)
- Use for logic testing only

#### 2. **Deploy to Staging**

Once local tests pass:

```bash
./scripts/deploy-lit-action.sh \
  src/karaoke/base-alignment-v2.js \
  "Base Alignment v2 (Staging)" \
  VITE_LIT_ACTION_BASE_ALIGNMENT_STAGING
```

This creates a **separate staging CID** you can test without breaking production.

#### 3. **Promote to Production**

When staging works:

```bash
./scripts/deploy-lit-action.sh \
  src/karaoke/base-alignment-v2.js \
  "Base Alignment v2" \
  VITE_LIT_ACTION_BASE_ALIGNMENT
```

### Manual Steps (if needed)

#### Upload Only

```bash
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
dotenvx run -- node scripts/upload-lit-action.mjs \
  src/karaoke/base-alignment-v2.js \
  "Base Alignment v2"
```

#### Encrypt Keys for CID

```bash
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
dotenvx run -- node scripts/encrypt-keys-v8.mjs \
  --cid QmYourCID \
  --key elevenlabs_api_key \
  --output src/karaoke/keys/elevenlabs_api_key_v11.json
```

#### Add PKP Permissions

```bash
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
dotenvx run -- bun run scripts/add-pkp-permission.mjs QmYourCID
```

## Best Practices

### 1. **Use Staging/Production Pattern**

Keep TWO env variables:
```bash
# app/.env.local
VITE_LIT_ACTION_BASE_ALIGNMENT_STAGING=QmStaging...
VITE_LIT_ACTION_BASE_ALIGNMENT=QmProduction...
```

Test with staging, promote to production when stable.

### 2. **Version Your Keys**

Name encrypted keys by version:
```
src/karaoke/keys/elevenlabs_api_key_v11.json  # For CID Qm...
src/karaoke/keys/elevenlabs_api_key_v12.json  # For new CID Qm...
```

This lets you rollback easily.

### 3. **Test Locally First**

Always run local tests before deploying:
```bash
node scripts/test-local-lit-action.mjs src/karaoke/your-action.js --param value
```

### 4. **Keep Old CIDs Working**

Don't delete old encrypted keys until you're sure new CID works.

### 5. **Document CIDs**

Keep a log of what each CID does:
```bash
# CHANGELOG.md
## 2025-01-15
- Base Alignment v2: QmVjCaNCS45BECxgbjHExDn7VikFLpeZXjXDEF4Nta691e
  - Added soundcloudPath check
  - Fixed contract ABI mismatch
```

## Common Issues

### "Failed to verify signature"

Your PKP doesn't have permission for this CID.

Fix:
```bash
DOTENV_PRIVATE_KEY=... dotenvx run -- bun run scripts/add-pkp-permission.mjs QmYourCID
```

### "Song has no soundcloudPath"

The song wasn't cataloged properly. Run match-and-segment first.

### Keys don't decrypt

You probably used the wrong CID when encrypting. Re-encrypt with the correct CID.

### Frontend still uses old CID

Restart your dev server after `.env.local` updates.

## Architecture Notes

### Why CID-Based Encryption?

Lit Protocol locks encrypted data to **specific code** (IPFS CID). This prevents:
- Malicious code from stealing API keys
- Users from modifying Lit Actions to extract secrets
- Unauthorized access to encrypted data

The tradeoff: every code change = new CID = re-encrypt everything.

### Can We Use PKP-Based ACCs Instead?

**No.** If you lock to a PKP instead of CID:
- Anyone with that PKP can decrypt
- You lose the immutability guarantee
- Malicious code could steal keys

CID-based encryption is the correct security model.

### Why Not Use Capacity Credits?

Capacity credits still require authentication (session signature). The real issue isn't authentication, it's **authorization** (which CID can decrypt which keys).

## Quick Reference

```bash
# Full deployment
./scripts/deploy-lit-action.sh src/karaoke/ACTION.js "Name" ENV_VAR

# Local test only
node scripts/test-local-lit-action.mjs src/karaoke/ACTION.js --param value

# Upload only
node scripts/upload-lit-action.mjs src/karaoke/ACTION.js "Name"

# Encrypt only
node scripts/encrypt-keys-v8.mjs --cid QmCID --key KEY_NAME --output PATH

# Permissions only
bun run scripts/add-pkp-permission.mjs QmCID
```

## Environment Variables

Required in `.env`:
```bash
# API Keys (for encryption)
ELEVENLABS_API_KEY=sk_...
GENIUS_API_KEY=...
OPENROUTER_API_KEY=sk-or-v1-...

# PKP Credentials
PRIVATE_KEY=0x...  # For signing transactions
```

Required in `app/.env.local`:
```bash
# Lit Action CIDs
VITE_LIT_ACTION_BASE_ALIGNMENT=QmVjCaNCS45BECxgbjHExDn7VikFLpeZXjXDEF4Nta691e
VITE_LIT_ACTION_MATCH_SEGMENT=QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu
VITE_LIT_ACTION_TRANSLATE=QmUY8xCVvk85ZwxWeUpA1jBzHCsfHm12uVwVUrFsyvhdWk

# Optional: Staging CIDs
VITE_LIT_ACTION_BASE_ALIGNMENT_STAGING=Qm...
```

## Troubleshooting Checklist

- [ ] Local test passes?
- [ ] Uploaded to IPFS successfully?
- [ ] Keys re-encrypted for new CID?
- [ ] PKP permissions added for new CID?
- [ ] `.env.local` updated with new CID?
- [ ] Frontend dev server restarted?
- [ ] Song cataloged in contract (for base-alignment)?
- [ ] Contract has soundcloudPath (for base-alignment)?
