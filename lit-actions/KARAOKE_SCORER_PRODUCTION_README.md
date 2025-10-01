# Karaoke Scorer v1 - Production Documentation

## Overview

The Karaoke Scorer is a Lit Protocol v8 Lit Action that:
1. Decrypts a Voxstral API key (locked to IPFS CID)
2. Transcribes audio using Mistral's Voxstral API
3. Calculates a score by comparing transcript to expected lyrics
4. Signs a transaction with a PKP (Programmable Key Pair)
5. Submits the score to an on-chain smart contract

**Status**: ✅ **PRODUCTION READY**

---

## Current Deployment

### IPFS CID
```
QmZLFxWYVm7LFGHkdRaEwpngVDwvLzqbcPPvQo6DTRdjuu
```

### Contract Addresses
- **KaraokeScoreboardV1**: `0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A` (Lens Chain Testnet)
- **Network**: Lens Chain Testnet (Chain ID: 37111)
- **RPC**: https://rpc.testnet.lens.xyz
- **Explorer**: https://explorer.testnet.lens.xyz

### PKP Details
- **Address**: `0x254AA0096C9287a03eE62b97AA5643A2b8003657`
- **Public Key**: `049c9112f956e95b113abe411c5be8d07a0349820275b84418d8100162e5c18529961e40595418ef8af0a21ea89332696599a92e481e41ecc5c6c153a03634db3b`
- **Token ID**: `26513068104172488118271353818530549108277473541061908496364044062550686881239`
- **Owner**: `0x0C6433789d14050aF47198B2751f6689731Ca79C`
- **Permitted CIDs**: See `contracts/output/pkp-credentials.json`

### Encrypted Keys
All keys are locked to the IPFS CID and stored in `src/stt/keys/`:
- **voxstral_api_key.json** - Mistral Voxstral API key
- **contract_address.json** - KaraokeScoreboardV1 contract address

---

## Architecture & Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                         │
│  - User records audio                                       │
│  - Converts to base64                                       │
│  - Calls Lit Action via SDK                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Lit Protocol (nagaDev)                                     │
│  - Auth Manager (v8 SDK)                                    │
│  - Execute Lit Action from IPFS                             │
│  - 3 nodes reach consensus                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Lit Action (QmZLF...)                                      │
│  1. Decrypt Voxstral API key                                │
│  2. Call Mistral API for transcription                      │
│  3. Calculate score (Levenshtein distance)                  │
│  4. Build unsigned transaction                              │
│  5. Sign with PKP (JSON.parse + joinSignature)              │
│  6. Submit to blockchain (runOnce, non-blocking)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Smart Contract (KaraokeScoreboardV1)                       │
│  - Stores scores on-chain                                   │
│  - Indexed by (clipId, userAddress)                         │
│  - Only PKP can submit scores                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Learnings (Hard-Won Lessons)

### 1. Lit Protocol v8 SDK Changes

#### Authentication Pattern
**WRONG (v7 pattern)**:
```javascript
const sessionSigs = await litClient.getSessionSigs({ ... });
```

**CORRECT (v8 pattern)**:
```javascript
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';

const authManager = createAuthManager({
  storage: storagePlugins.localStorageNode({
    appName: "karaoke-scorer",
    networkName: "naga-dev",
    storagePath: "./lit-auth-storage"
  }),
});

const authContext = await authManager.createEoaAuthContext({
  authConfig: {
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    resources: [
      {
        resource: new LitActionResource('*'),
        ability: 'lit-action-execution'
      }
    ]
  },
  config: {
    account: viemAccount
  },
  litClient: litClient
});
```

**Key Points**:
- Must use `createAuthManager` with storage plugins
- Must use `createEoaAuthContext` (not `getOrCreateAuthContext`)
- Resources must be instances of `LitActionResource`, not plain objects
- Storage path is required for Node.js (`localStorageNode`)

---

### 2. Signature Parsing (CRITICAL!)

The v8 SDK returns signatures as **JSON strings**, not objects.

#### The Bug That Caused 2-Hour Timeout
**WRONG**:
```javascript
const signature = await Lit.Actions.signAndCombineEcdsa({ ... });
const sig = ethers.utils.splitSignature(signature.signature);
```

**CORRECT**:
```javascript
const signature = await Lit.Actions.signAndCombineEcdsa({ ... });

// v8 returns JSON string - must parse first!
const jsonSignature = JSON.parse(signature);

// Defensive: handle both with and without 0x prefix
jsonSignature.r = jsonSignature.r.startsWith('0x') ? jsonSignature.r : '0x' + jsonSignature.r;
jsonSignature.s = jsonSignature.s.startsWith('0x') ? jsonSignature.s : '0x' + jsonSignature.s;

// Use joinSignature (not splitSignature!)
const hexSignature = ethers.utils.joinSignature(jsonSignature);

// Now serialize transaction
const signedTx = ethers.utils.serializeTransaction(unsignedTx, hexSignature);
```

**Key Points**:
- Signature is a JSON string, not an object
- Must use `JSON.parse()` first
- Must use `joinSignature()`, not `splitSignature()`
- Must handle 0x prefix defensively

**Source**: `src/tabs/LitActions/PKPSigning.tsx` in Lit Protocol docs

---

### 3. Transaction Submission Timeout

#### The Problem
Using `waitForResponse: true` causes the Lit Action to timeout waiting for transaction confirmation.

**WRONG**:
```javascript
txHash = await Lit.Actions.runOnce(
  { waitForResponse: true, name: `submit_${Date.now()}` },
  async () => {
    const tx = await provider.sendTransaction(signedTx);
    return tx.hash; // Waits for confirmation = TIMEOUT
  }
);
```

**CORRECT**:
```javascript
txHash = await Lit.Actions.runOnce(
  { waitForResponse: false, name: `submit_${Date.now()}` },
  async () => {
    const tx = await provider.sendTransaction(signedTx);
    return tx.hash; // Returns immediately
  }
);
```

**Why**: Transaction confirmation can take 30+ seconds. Lit Actions have a ~60 second timeout.

---

### 4. PKP Public Key Format

The PKP needs the **uncompressed ECDSA public key** (130 hex chars, starts with `04`), not the ETH address.

#### How to Get It
```bash
# Query from Lit Protocol PKP contract
cast call 0x10aB76Ab4a1351cE7FBfbaF6431E5732037DfCF6 \
  "getPubkey(uint256)" <TOKEN_ID> \
  --rpc-url https://yellowstone-rpc.litprotocol.com
```

#### Format
- Starts with `04`
- 130 hex characters (65 bytes)
- Example: `049c9112f956e95b113abe411c5be8d07a0349820275b84418d8100162e5c18529961e40595418ef8af0a21ea89332696599a92e481e41ecc5c6c153a03634db3b`

#### Usage in Lit Action
```javascript
const pkpPublicKeyFormatted = pkpPublicKey.startsWith('0x') ? pkpPublicKey : '0x' + pkpPublicKey;
const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKeyFormatted);
```

---

### 5. Key Encryption & CID Locking

Keys must be encrypted and locked to the specific IPFS CID of the Lit Action.

#### Process
1. Upload Lit Action → get CID
2. Encrypt keys locked to that CID
3. Update PKP permissions with that CID

#### Encryption Script
```bash
VOXSTRAL_API_KEY=<key> node scripts/encrypt-keys-v8.mjs \
  --cid QmZLFxWYVm7LFGHkdRaEwpngVDwvLzqbcPPvQo6DTRdjuu \
  --key voxstral_api_key \
  --output src/stt/keys/voxstral_api_key.json
```

#### Access Control Conditions
```javascript
{
  "conditionType": "evmBasic",
  "contractAddress": "",
  "standardContractType": "",
  "chain": "ethereum",
  "method": "",
  "parameters": [":currentActionIpfsId"],
  "returnValueTest": {
    "comparator": "=",
    "value": "QmZLFxWYVm7LFGHkdRaEwpngVDwvLzqbcPPvQo6DTRdjuu"
  }
}
```

**Critical**: The `:currentActionIpfsId` parameter automatically gets the CID of the executing Lit Action. Only Lit Actions running from that exact CID can decrypt.

---

### 6. PKP Permissions

The PKP must have the Lit Action CID added to its permissions.

#### Update Script
```bash
cd contracts
npx dotenvx run -- bun run scripts/update-pkp-permissions.ts <CID>
```

#### What It Does
- Adds the CID to the PKP's permitted actions list
- Sets scope: `sign-anything`
- Auth method type: `2` (IPFS CID)

#### View Current Permissions
```javascript
const permissions = await litClient.viewPKPPermissions({
  tokenId: pkpCreds.tokenId,
});
console.log(permissions.actions); // List of permitted CIDs
```

---

### 7. Network & RPC Configuration

#### Lens Chain Testnet
- **Chain ID**: 37111
- **RPC**: https://rpc.testnet.lens.xyz
- **Currency**: $GRASS
- **Type**: zkSync Era (Layer 2)

#### Provider Setup in Lit Action
```javascript
const lensChainRpcUrl = 'https://rpc.testnet.lens.xyz';
const provider = new ethers.providers.JsonRpcProvider(lensChainRpcUrl);

const unsignedTx = {
  to: contractAddress,
  data: callData,
  gasLimit: 500000,
  gasPrice: await provider.getGasPrice(),
  nonce: await provider.getTransactionCount(pkpEthAddress),
  chainId: 37111, // Lens Chain testnet
  value: 0
};
```

---

### 8. Testing Strategy

#### Incremental Testing
When debugging timeouts, use early returns to isolate:

```javascript
// Test transcription only
calculatedScore = calculateScore(transcript, expectedLyrics);

Lit.Actions.setResponse({
  response: JSON.stringify({
    success: true,
    transcript,
    score: calculatedScore,
    debug: 'Early return - contract submission skipped'
  })
});
return; // Exit before contract submission
```

#### Test Script
```bash
cd lit-actions
bun run test:scorer
```

Checks:
1. ✅ Transcription returned
2. ✅ Score calculated (0-100)
3. ✅ Transaction hash present
4. ✅ No errors
5. ✅ Execution successful

---

## Security Issues

### 🚨 CRITICAL: Expected Lyrics Spoofing

**Current Issue**: `expectedLyrics` is passed as a `jsParam`, which means:
- Anyone can pass fake lyrics to get a perfect score
- No verification that the lyrics match the actual clip
- Scores can be completely spoofed

**Example Attack**:
```javascript
// Attacker passes their transcript as expectedLyrics
executeJs({
  ipfsId: 'QmZLF...',
  jsParams: {
    clipId: 'never-gonna-give-you-up',
    expectedLyrics: 'blah blah blah', // Fake!
    audioDataBase64: '<their audio that says "blah blah blah">'
  }
});
// Result: 100/100 score 🚨
```

### ✅ Solution: Read from Registry Contract

The Lit Action should:
1. Query a `ClipRegistry` contract for the clip's expected lyrics
2. Use the on-chain source of truth
3. Only the clip registry owner can set lyrics

**Implementation**:
```solidity
// ClipRegistryV1.sol
mapping(string clipId => ClipData) public clips;

struct ClipData {
    string expectedLyrics;
    string songTitle;
    string artist;
    bool isActive;
}
```

**Lit Action Change**:
```javascript
// Instead of: const expectedLyrics = jsParams.expectedLyrics;

// Query from contract:
const registryABI = ['function getClip(string) view returns (string expectedLyrics, string songTitle, string artist, bool isActive)'];
const registry = new ethers.Contract(REGISTRY_ADDRESS, registryABI, provider);
const clipData = await registry.getClip(clipId);

if (!clipData.isActive) {
  throw new Error('Clip not found or inactive');
}

const expectedLyrics = clipData.expectedLyrics;
```

---

## Maintenance Guide

### When to Update

#### 1. New Lit Action Code
If you modify `src/stt/karaoke-scorer-v1.js`:

```bash
# 1. Upload to IPFS
npx dotenvx run -- node scripts/upload-lit-action.mjs \
  src/stt/karaoke-scorer-v1.js "Karaoke Scorer v1"
# → Get new CID

# 2. Re-encrypt keys for new CID
VOXSTRAL_API_KEY=<key> node scripts/encrypt-keys-v8.mjs \
  --cid <NEW_CID> \
  --key voxstral_api_key \
  --output src/stt/keys/voxstral_api_key.json

# 3. Update PKP permissions
cd contracts
npx dotenvx run -- bun run scripts/update-pkp-permissions.ts <NEW_CID>

# 4. Update frontend to use new CID
```

#### 2. New Contract Deployment
If you deploy a new `KaraokeScoreboardV2`:

```bash
# Delete old encrypted contract address
rm src/stt/keys/contract_address.json

# Update CONTRACT_DEPLOYED_ADDRESS in test script
# Run test - it will auto-encrypt the new address

# Or manually encrypt:
echo "0xNEW_ADDRESS" | node -e "..." # Use encrypt script
```

#### 3. Rotate API Keys
If Voxstral API key changes:

```bash
# Re-encrypt with new key
VOXSTRAL_API_KEY=<new_key> node scripts/encrypt-keys-v8.mjs \
  --cid <CURRENT_CID> \
  --key voxstral_api_key \
  --output src/stt/keys/voxstral_api_key.json

# No need to update CID or permissions if code didn't change
```

---

### Monitoring

#### Check PKP Balance
```bash
cast balance 0x254AA0096C9287a03eE62b97AA5643A2b8003657 \
  --rpc-url https://rpc.testnet.lens.xyz
```

Should have at least **0.01 $GRASS** for transactions.

#### Fund PKP
```bash
cast send 0x254AA0096C9287a03eE62b97AA5643A2b8003657 \
  --value 0.1ether \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY
```

#### Query Score
```bash
cast call 0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A \
  "getScore(string,address)(uint96,uint48,uint16)" \
  "test-clip-1" "0x0C6433789d14050aF47198B2751f6689731Ca79C" \
  --rpc-url https://rpc.testnet.lens.xyz
```

Returns: `(score, timestamp, attemptCount)`

---

## File Structure

```
lit-actions/
├── src/
│   ├── stt/
│   │   ├── karaoke-scorer-v1.js      # Main Lit Action
│   │   └── keys/
│   │       ├── voxstral_api_key.json      # Encrypted Voxstral key
│   │       ├── contract_address.json      # Encrypted contract address
│   │       ├── db_auth_token.json         # (unused by karaoke scorer)
│   │       └── db_endpoint_url.json       # (unused by karaoke scorer)
│   └── test/
│       ├── test-karaoke-scorer.mjs   # End-to-end test script
│       ├── test-audio.mp3            # Test audio file
│       └── simple-eoa-test.js        # (unrelated)
├── scripts/
│   ├── encrypt-keys-v8.mjs           # Encrypt keys locked to CID
│   ├── upload-lit-action.mjs         # Upload to IPFS via Pinata
│   └── pinata/
│       └── deploy.js                 # (deprecated, use upload-lit-action.mjs)
├── package.json
├── .env                              # PRIVATE_KEY, PINATA_JWT
└── KARAOKE_SCORER_PRODUCTION_README.md  # This file

contracts/
├── src/
│   └── KaraokeScoreboardV1.sol       # On-chain score storage
├── scripts/
│   ├── mint-pkp.ts                   # Mint new PKP
│   ├── fund-pkp.ts                   # Fund PKP with gas
│   ├── update-pkp-permissions.ts     # Add CID to PKP permissions
│   └── get-pkp-pubkey.ts            # Query PKP public key
├── output/
│   └── pkp-credentials.json          # PKP token ID, public key, address
└── .env                              # PRIVATE_KEY (encrypted)
```

---

## Common Errors & Solutions

### Error: "Request timed out"
**Cause**: `waitForResponse: true` in `runOnce`
**Fix**: Change to `waitForResponse: false`

### Error: "signature missing v and recoveryParam"
**Cause**: Not parsing JSON signature
**Fix**: Add `JSON.parse(signature)` before `joinSignature()`

### Error: "Access control conditions check failed"
**Cause**: CID mismatch between encrypted key and executing Lit Action
**Fix**: Re-encrypt keys with correct CID, update PKP permissions

### Error: "invalid public or private key"
**Cause**: Using ETH address instead of public key
**Fix**: Query public key from PKP contract, update credentials file

### Error: "authContext.authNeededCallback is not a function"
**Cause**: Using v7 auth pattern
**Fix**: Use `createAuthManager` + `createEoaAuthContext`

### Error: "getResourceKey is not a function"
**Cause**: Using plain object instead of `LitActionResource`
**Fix**: `new LitActionResource('*')`

---

## Performance

- **Transcription**: ~2-3 seconds (Mistral API)
- **Scoring**: < 10ms (local calculation)
- **Signing**: ~1 second (PKP threshold signature)
- **Submission**: ~1-2 seconds (transaction broadcast)
- **Total**: ~4-6 seconds end-to-end

---

## Next Steps

### 1. 🚨 HIGH PRIORITY: Fix Security Issue
Implement `ClipRegistryV1` contract to store expected lyrics on-chain.

### 2. Frontend Integration
Use the test script as reference for:
- Auth Manager setup
- IPFS execution
- Result handling

### 3. Production Checklist
- [ ] Deploy ClipRegistry contract
- [ ] Update Lit Action to read from registry
- [ ] Re-upload to IPFS (new CID)
- [ ] Re-encrypt keys for new CID
- [ ] Update PKP permissions
- [ ] Fund PKP with sufficient gas
- [ ] Monitor PKP balance alerts
- [ ] Set up transaction failure alerts

---

## References

- **Lit Protocol v8 Docs**: https://developer.litprotocol.com/
- **PKP Signing Example**: `src/tabs/LitActions/PKPSigning.tsx` in naga-v8-interactive-docs
- **Mistral Voxstral API**: https://docs.mistral.ai/capabilities/speech-to-text/
- **Lens Chain Testnet**: https://docs.lens.xyz/
- **KaraokeScoreboardV1**: See `contracts/src/KaraokeScoreboardV1.sol`

---

## Contact

For issues or questions:
- Check this README first
- Review test script: `src/test/test-karaoke-scorer.mjs`
- Check Lit Protocol docs for v8 SDK changes

**Last Updated**: 2025-10-01
**Version**: v1.0.0
**Status**: ✅ Production Ready (with security fix needed)
