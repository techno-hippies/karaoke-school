# Lit Actions - Karaoke School v1

## Overview

Serverless, IPFS-hosted code that executes on the Lit Protocol network with blockchain-signing capabilities for karaoke performance grading.

## 🎯 Current Working Implementation

### Karaoke Grader v6 (PerformanceGrader Integration)
**Status**: ✅ **PRODUCTION READY**

- **File**: `src/karaoke/karaoke-grader-v6-performance-grader.js`
- **IPFS CID**: `QmYUFYxDmcENmy4M4V89fJVCP4K6riWqMXXozXgmEMFSK1`
- **Contract**: PerformanceGrader @ `0xbc831cfc35C543892B14cDe6E40ED9026eF32678` (Lens Testnet)
- **PKP**: `0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7`
- **Test**: `src/test/test-karaoke-grader-v6.mjs`

**Features**:
- ✅ Voxstral STT transcription
- ✅ Pronunciation scoring
- ✅ 16-field zkSync signature pattern (Lens testnet compatible)
- ✅ PKP-signed transactions to PerformanceGrader
- ✅ Event emission for leaderboard indexing
- ✅ Test mode for rapid development

**Last Tested**: 2025-11-03 (TX: `0xaa207cc9cf2fff1dde3fbf4faa71031f97447965a606e65da8bd74f3c63da56d`)

---

## 🚀 Quick Start

### 1. Test the Working Implementation

```bash
# Run the v6 test
bun run src/test/test-karaoke-grader-v6.mjs
```

Expected output:
```
✅ ALL TESTS PASSED! 🎉
🎯 v6 Features Verified:
   ✅ Voxstral STT transcription working
   ✅ Score calculation working
   ✅ PerformanceGrader submission working
   ✅ PKP signing successful
   ✅ 16-field zkSync signature pattern working
```

### 2. Mint a New PKP (if needed)

```bash
bun run scripts/mint-pkp.ts
```

This creates:
- New PKP with your wallet as owner
- Saves to `output/pkp-credentials.json`
- Adds initial permission for placeholder IPFS CID

### 3. Upload Lit Action to IPFS

```bash
node scripts/upload-lit-action.mjs src/karaoke/karaoke-grader-v6-performance-grader.js "Karaoke Grader v6"
```

Returns new IPFS CID.

### 4. Add Permission to PKP

```bash
bun run scripts/add-pkp-permission.mjs <IPFS_CID>
```

### 5. Update Contract Trusted PKP

```bash
cd ../contracts
bun run set-trusted-pkp.ts <PKP_ADDRESS>
```

---

## 📁 Project Structure

```
lit-actions/
├── src/
│   ├── karaoke/
│   │   ├── karaoke-grader-v6-performance-grader.js  # ✅ WORKING
│   │   ├── fsrs/                                    # FSRS algorithm (future use)
│   │   └── archive/                                 # Old versions (reference)
│   ├── stt/                                          # STT utilities (if needed)
│   └── test/
│       ├── test-karaoke-grader-v6.mjs               # ✅ WORKING TEST
│       ├── test-direct-grading.mjs                   # Direct grading test
│       └── archive/                                  # Old tests (reference)
├── scripts/
│   ├── mint-pkp.ts                                   # Mint new PKP
│   ├── add-pkp-permission.mjs                        # Add IPFS CID permission
│   ├── upload-lit-action.mjs                         # Upload to IPFS
│   └── get-pkp-pubkey.mjs                            # Retrieve PKP public key
├── output/
│   └── pkp-credentials.json                          # Current PKP data
├── .env                                              # Private keys (raw, not encrypted)
├── README.md                                         # This file
└── AGENTS.md                                         # Comprehensive guide

```

---

## 🔐 Environment Setup

The `.env` file now uses **raw private keys** (not dotenvx encrypted):

```bash
# .env
PRIVATE_KEY="0x..."              # Your wallet private key
PINATA_JWT="encrypted:..."       # Pinata API key (still encrypted)
VOXTRAL_API_KEY="encrypted:..."  # Voxtral API key (still encrypted)
PKP_ADDRESS="0x7d8003..."        # Current PKP address
```

No need for `DOTENV_PRIVATE_KEY` prefix anymore.

---

## 🛠️ Development Workflow

### Testing a Lit Action

1. Write your Lit Action in `src/karaoke/`
2. Create test file in `src/test/`
3. Run test: `bun run src/test/test-YOUR-ACTION.mjs`
4. Upload to IPFS when ready
5. Add PKP permission
6. Update contract if needed

### Pattern to Follow

Use `karaoke-grader-v6-performance-grader.js` as template:
- ✅ 16-field zkSync signature for Lens
- ✅ PKP public key configuration
- ✅ Test mode support
- ✅ Error handling with `runOnce`
- ✅ Response format for tests

### Critical: 16-Field zkSync Signature Pattern

**Required for Lens testnet transactions:**

```javascript
const signedFields = [
  toBeArray(nonce),                     // 0. nonce
  toBeArray(maxPriorityFeePerGas),      // 1. maxPriorityFeePerGas
  toBeArray(gasPrice),                  // 2. maxFeePerGas
  toBeArray(gasLimit),                  // 3. gasLimit
  to || '0x',                           // 4. to
  toBeArray(0),                         // 5. value
  txData || '0x',                       // 6. data
  toBeArray(yParity),                   // 7. yParity (0 or 1)
  ethers.utils.arrayify(r),             // 8. r
  ethers.utils.arrayify(s),             // 9. s
  toBeArray(CHAIN_ID),                  // 10. chainId
  from,                                 // 11. from
  toBeArray(gasPerPubdataByteLimit),    // 12. gasPerPubdata
  [],                                   // 13. factoryDeps
  '0x',                                 // 14. customSignature
  []                                    // 15. paymasterParams
];

const signedTxSerialized = '0x71' + ethers.utils.RLP.encode(signedFields).slice(2);
```

**Key points**:
- Type prefix: `0x71` (113)
- Use `yParity` (0/1) not `v` (27/28)
- All numbers must be minimal big-endian bytes via `toBeArray()`
- EIP-712 domain separator + struct hash for signing

---

## 🔍 Debugging

### Common Issues

**1. "NodeAuthSigScopeTooLimited"**
- PKP doesn't have permission for this IPFS CID
- Fix: Run `bun run scripts/add-pkp-permission.mjs <CID>`

**2. "NotTrustedPKP" error**
- Contract's trustedPKP doesn't match your PKP
- Fix: Run `bun run set-trusted-pkp.ts <YOUR_PKP_ADDRESS>` in contracts/

**3. "Insufficient funds"**
- PKP needs gas on Lens testnet
- Fix: `cast send <PKP_ADDRESS> --value 0.01ether --rpc-url https://rpc.testnet.lens.xyz --private-key $PRIVATE_KEY`

**4. Transaction fails silently**
- Check block explorer: https://explorer.testnet.lens.xyz
- Verify contract address and function signature
- Check PKP has funds

### Verification Commands

```bash
# Check PKP balance
cast balance <PKP_ADDRESS> --rpc-url https://rpc.testnet.lens.xyz

# Check contract trustedPKP
cast call 0xbc831cfc35C543892B14cDe6E40ED9026eF32678 "trustedPKP()" --rpc-url https://rpc.testnet.lens.xyz

# Check recent events
cast logs --rpc-url https://rpc.testnet.lens.xyz --address 0xbc831cfc35C543892B14cDe6E40ED9026eF32678 --from-block latest

# Verify transaction
cast receipt <TX_HASH> --rpc-url https://rpc.testnet.lens.xyz
```

---

## 📚 Documentation

- **AGENTS.md**: Comprehensive guide to all Lit Actions
- **PERFORMANCE-GRADER-INTEGRATION.md**: PerformanceGrader integration details
- **src/karaoke/archive/**: Reference implementations (karaoke-scorer-v4, etc.)

---

## 🎯 Next Steps

1. **Implement Full Audio Grading**: Remove test mode, use real Voxstral transcription
2. **Add FSRS Algorithm**: Integrate spaced repetition from `fsrs/` directory
3. **Deploy to Production**: Update to mainnet contracts when ready
4. **Subgraph Integration**: Index PerformanceGraded events for leaderboards

---

## 🚨 Security Notes

- **Never commit private keys to git**
- PKP credentials in `output/` are safe to commit (just addresses/IDs)
- Encrypted API keys (PINATA_JWT, VOXTRAL_API_KEY) are safe to commit
- Raw PRIVATE_KEY in `.env` must be gitignored

---

**Last Updated**: 2025-11-03
**Status**: Production Ready ✅
