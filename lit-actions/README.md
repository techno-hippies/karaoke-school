# Lit Actions - Karaoke Game

This repository contains Lit Protocol v8 Lit Actions for the karaoke game.

## 🎤 Karaoke Scorer

**Latest Version**: v3 ✅ **Production Ready** (simplified architecture)
**Previous Version**: v2 ✅ Works but unnecessarily complex
**Legacy Version**: v1 ⚠️ Deprecated (security vulnerability)

The karaoke scorer transcribes audio, calculates scores, and submits them on-chain using PKP signing.

### Quick Start

```bash
# Install dependencies
bun install

# Run v3 test (recommended - simplified)
bun run test:scorer-v3

# Run v2 test (works but complex)
bun run test:scorer-v2

# Run v1 test (deprecated)
bun run test:scorer
```

### 📚 Full Documentation

**READ THIS FIRST**: [KARAOKE_SCORER_PRODUCTION_README.md](./KARAOKE_SCORER_PRODUCTION_README.md)

This comprehensive guide includes:
- Complete architecture & flow diagrams
- Hard-won lessons from debugging
- Lit Protocol v8 SDK migration guide
- Signature parsing (critical!)
- Transaction timeout fixes
- Security issues & fixes
- Maintenance procedures
- Troubleshooting guide

### ✅ Security Fix & Simplification

**Problem (v1)**: `expectedLyrics` was passed as a jsParam, allowing score spoofing.

**Fix (v2+v3)**: Integrated with `ClipRegistryV1` contract. Lyrics are fetched from on-chain registry via Grove storage, preventing spoofing attacks.

**v3 Improvements Over v2**:
- ✅ Removed unnecessary encryption of public contract addresses
- ✅ Hardcoded `ClipRegistry` and `Scoreboard` addresses directly in Lit Action
- ✅ Only encrypts actual secrets (Voxstral API key)
- ✅ Simpler jsParams (fewer parameters to manage)
- ✅ Faster execution (no pointless decryption)
- ✅ Easier to audit (contract addresses visible in code)

**Migration**: Use v3 for all new implementations.

---

### Current Deployment

**v3 (Recommended - Simplified)**:
- **IPFS CID**: `QmZmPnp5tGFnLstWEL3wTsAyUQSeBSwqPuPgAZuTN3swjJ`
- **Scoreboard Contract**: `0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A` (hardcoded in v3)
- **ClipRegistry Contract**: `0x59fCAe6753041C7b2E2ad443e4F2342Af46b81bf` (hardcoded in v3)
- **PKP**: `0x254AA0096C9287a03eE62b97AA5643A2b8003657`
- **Network**: Lens Chain Testnet (Chain ID 37111)
- **Encrypted**: Voxstral API key only

**v2 (Works but unnecessarily complex)**:
- **IPFS CID**: `QmWQX6N8wUs4xPk7DqN77QbqPb93LtsKtPuDGBU4WGeDB4`
- **Encrypted**: Voxstral API key + contract addresses (pointless)

**v1 (Deprecated)**:
- **IPFS CID**: `QmZLFxWYVm7LFGHkdRaEwpngVDwvLzqbcPPvQo6DTRdjuu` ⚠️ Security vulnerability

### Test Results (v3)

```
✅ ALL TESTS PASSED! 🎉 (6/6)

✅ Transcription: "One, two, three, four. This is me opening a door."
✅ Score: 0/100 (test audio vs. "Down Home Blues" lyrics)
✅ TX Hash: 0x559e60c01bf6b656b9a8f87ec400522e4e22266f381b34cf5bab2793520ec524
⏱️  Execution: 5.4s (faster than v2!)

🎯 v3 Improvements Verified:
   ✅ Contract addresses hardcoded (no unnecessary encryption)
   ✅ Only Voxstral API key encrypted (actual secret)
   ✅ Simpler jsParams (fewer parameters)
   ✅ Lyrics from on-chain ClipRegistry (security fix maintained)
```

---

## Project Structure

```
lit-actions/
├── src/
│   ├── stt/
│   │   ├── karaoke-scorer-v1.js      # 🎤 Main Lit Action
│   │   └── keys/                     # 🔐 Encrypted API keys (locked to CID)
│   └── test/
│       ├── test-karaoke-scorer.mjs   # ✅ End-to-end test
│       └── test-audio.mp3            # 🎵 Test audio
├── scripts/
│   ├── encrypt-keys-v8.mjs           # 🔒 Encrypt keys for CID
│   └── upload-lit-action.mjs         # 📤 Upload to IPFS
├── KARAOKE_SCORER_PRODUCTION_README.md  # 📚 Full documentation
└── package.json

contracts/ (sibling directory)
├── src/
│   └── KaraokeScoreboardV1.sol       # 📊 On-chain score storage
└── scripts/
    ├── mint-pkp.ts                   # 🔑 Mint new PKP
    ├── fund-pkp.ts                   # 💰 Fund PKP
    └── update-pkp-permissions.ts     # ✅ Update PKP CID permissions
```

---

## Common Tasks

### Upload New Version
```bash
npx dotenvx run -- node scripts/upload-lit-action.mjs \
  src/stt/karaoke-scorer-v1.js "Karaoke Scorer v1"
# → Returns new CID
```

### Re-encrypt Keys
```bash
VOXSTRAL_API_KEY=<key> node scripts/encrypt-keys-v8.mjs \
  --cid <CID> \
  --key voxstral_api_key \
  --output src/stt/keys/voxstral_api_key.json
```

### Update PKP Permissions
```bash
cd ../contracts
npx dotenvx run -- bun run scripts/update-pkp-permissions.ts <CID>
```

### Run Tests
```bash
bun run test:scorer
```

---

## Next Steps

1. **✅ COMPLETED**: ClipRegistry integration (v2+v3)
2. **✅ COMPLETED**: Simplified architecture (v3)
3. **Frontend Integration**: Update to use v3 CID with clipId parameter
4. **Monitoring**: Set up PKP balance alerts
5. **Production Deploy**: Follow checklist in production README

---

## Need Help?

1. Check [KARAOKE_SCORER_PRODUCTION_README.md](./KARAOKE_SCORER_PRODUCTION_README.md) first
2. Review test script: `src/test/test-karaoke-scorer.mjs`
3. Check Lit Protocol v8 docs: https://developer.litprotocol.com/

**This took a long time to debug. Read the production README before making changes!**
