# Encrypted API Keys for Match and Segment v1

This directory contains encrypted API keys for the match-and-segment-v1.js Lit Action.

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
