# Encrypted API Keys for Lit Actions

This directory contains encrypted API keys for karaoke Lit Actions.

**IMPORTANT**: When deploying a new Lit Action version, keys must be re-encrypted and locked to the new CID. The deployment script handles this automatically.

## Required Keys

### 1. OpenRouter API Key (Grok-4-fast)
**File**: `openrouter_api_key.json`
**Purpose**: Used for AI-powered lyrics matching and section chunking
**Cost**: ~$0.0003 per song

### 2. Grove API Key
**File**: `grove_api_key.json`
**Purpose**: Used for uploading song metadata to decentralized storage
**Cost**: TBD (depends on Grove pricing)

### 3. Genius API Key
**File**: `genius_api_key.json`
**Purpose**: Used for fetching song metadata and media links
**Cost**: FREE

## Encryption Process

After uploading the Lit Action to IPFS and getting the CID:

```bash
cd /media/t42/th42/Code/karaoke-school-v1/lit-actions

# Set environment variables
export OPENROUTER_API_KEY=sk-or-v1-...
export GROVE_API_KEY=...
export GENIUS_API_KEY=...

# Get the CID from upload (example: QmXXX...)
CID="QmXXX..."

# Encrypt OpenRouter key
bun run scripts/encrypt-keys-v8.mjs \
  --cid $CID \
  --key openrouter_api_key \
  --output src/karaoke/keys/openrouter_api_key.json

# Encrypt Grove key
bun run scripts/encrypt-keys-v8.mjs \
  --cid $CID \
  --key grove_api_key \
  --output src/karaoke/keys/grove_api_key.json

# Encrypt Genius key
bun run scripts/encrypt-keys-v8.mjs \
  --cid $CID \
  --key genius_api_key \
  --output src/karaoke/keys/genius_api_key.json
```

## Key File Structure

Each encrypted key file has this structure:

```json
{
  "ciphertext": "...",
  "dataToEncryptHash": "...",
  "accessControlConditions": [
    {
      "conditionType": "evmBasic",
      "contractAddress": "",
      "standardContractType": "",
      "chain": "ethereum",
      "method": "",
      "parameters": [":currentActionIpfsId"],
      "returnValueTest": {
        "comparator": "=",
        "value": "QmXXX..."
      }
    }
  ],
  "encryptedAt": "2025-10-07T...",
  "cid": "QmXXX..."
}
```

## Security

- Keys are encrypted using Lit Protocol
- Only the specific Lit Action (identified by CID) can decrypt them
- Access control is enforced by Lit nodes during execution
- No keys are stored in plaintext in this repository

## Testing

After encrypting keys, test with:

```bash
bun run test:match-segment-v1
```

Or test with a specific Genius ID:

```bash
bun run test:match-segment-v1 378195
```

## Troubleshooting

### Error: "Access control conditions check failed"

This means the encrypted key is locked to a different CID than the Lit Action trying to use it.

**Cause**: When you deploy a new Lit Action version, it gets a new IPFS CID. The old encrypted keys are locked to the old CID and won't work.

**Fix**: The deployment script (`scripts/deploy-lit-action.sh`) automatically:
1. Re-encrypts keys locked to the new CID
2. Updates `app/src/lib/lit/keys/active.ts` with the new encrypted key

If this didn't happen:
1. Check that the deployment script completed successfully
2. Verify `app/src/lib/lit/keys/active.ts` shows the new CID in the access control conditions
3. Restart your frontend dev server
