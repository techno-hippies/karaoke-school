# Audio Processor v2 - Complete Pipeline Setup

This document explains how to set up and test the complete karaoke processing pipeline with fal.ai drum enhancement and ElevenLabs vocal alignment.

## Overview

Audio Processor v2 implements the complete end-to-end pipeline:

1. **Ownership Verification** - Checks KaraokeCreditsV1 contract on Base Sepolia
2. **API Key Decryption** - Decrypts ElevenLabs and fal.ai keys in Lit Action
3. **Audio Verification** - Validates SoundCloud audio availability
4. **Modal Processing** - Download + trim + Demucs stem separation
5. **fal.ai Enhancement** - AI-enhanced drum quality using audio-to-audio
6. **ElevenLabs Alignment** - Word-level vocal timestamps for karaoke subtitles
7. **Grove Upload** - (Prepared) Decentralized storage with PKP
8. **Registry Update** - (Prepared) Updates KaraokeCatalog contract

## Prerequisites

### 1. Get API Keys

You need API keys from:

- **ElevenLabs**: https://elevenlabs.io/app/settings/api-keys
- **fal.ai**: https://fal.ai/dashboard/keys

Add them to your environment:

```bash
cd lit-actions
export ELEVENLABS_API_KEY="sk-..."
export FAL_API_KEY="..."
```

### 2. Add Keys to .env

The keys have been added to `.env` with placeholder values:

```bash
ELEVENLABS_API_KEY="encrypted:PLACEHOLDER_REPLACE_AFTER_ENCRYPTING"
FAL_API_KEY="encrypted:PLACEHOLDER_REPLACE_AFTER_ENCRYPTING"
```

### 3. Upload Lit Action to IPFS

Upload the updated audio-processor-v1.js to IPFS:

```bash
cd lit-actions

DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
dotenvx run -- node scripts/upload-lit-action.mjs \
  src/karaoke/audio-processor-v1.js \
  "Audio Processor v2 - Complete pipeline with fal.ai + ElevenLabs"
```

This will output a CID like: `QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

### 4. Encrypt API Keys for the New CID

Encrypt both API keys and lock them to the new CID:

```bash
# Encrypt ElevenLabs key
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
dotenvx run -- node scripts/encrypt-keys-v8.mjs \
  --cid <NEW_CID> \
  --key elevenlabs_api_key \
  --output src/karaoke/keys/elevenlabs_api_key_v2.json

# Encrypt fal.ai key
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
dotenvx run -- node scripts/encrypt-keys-v8.mjs \
  --cid <NEW_CID> \
  --key fal_api_key \
  --output src/karaoke/keys/fal_api_key_v1.json
```

Replace `<NEW_CID>` with the CID from step 3.

### 5. Add PKP Permission

Grant the PKP permission to execute the new Lit Action:

```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
dotenvx run -- bun run scripts/add-pkp-permission.mjs <NEW_CID>
```

### 6. Update Test CID

Update the CID in `src/test/test-audio-processor.mjs`:

```javascript
const AUDIO_PROCESSOR_V2_CID = '<NEW_CID>';
```

### 7. Update .env.local

Update the CID in `app/.env.local`:

```bash
VITE_LIT_ACTION_AUDIO_PROCESSOR=<NEW_CID>
```

## Running the Test

After completing all setup steps:

```bash
cd lit-actions

DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
dotenvx run -- bun run src/test/test-audio-processor.mjs
```

### Expected Output

```
🎹 Audio Processor v2 Test (Complete Pipeline)

Testing:
  1. Segment ownership verification (KaraokeCreditsV1 on Base Sepolia)
  2. Modal endpoint (download + trim + stems)
  3. fal.ai drum enhancement (audio-to-audio)
  4. ElevenLabs vocal alignment (word-level timestamps)
  5. Grove upload preparation
  6. KaraokeCatalog registry update preparation

================================================================================
🎵 Testing: Sia - Chandelier
   Section: Verse 1 (23s)
================================================================================

🔑 Loading PKP credentials...
✅ PKP loaded: 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30

🔐 Loading encrypted API keys...
✅ ElevenLabs key loaded
✅ fal.ai key loaded

🔌 Connecting to Lit Protocol...
✅ Connected to Lit Network

🔐 Creating authentication context...
✅ Auth context created

📍 Test wallet address: 0x...

🔍 Checking segment ownership...
   Genius ID: 378195
   Segment: verse-1

🚀 Executing Audio Processor Lit Action (v2 - Complete Pipeline)...
⏱️  Expected time: ~45s for full pipeline
   Step 1: Verify segment ownership on-chain
   Step 2: Decrypt API keys (ElevenLabs + fal.ai)
   Step 3: Verify audio availability
   Step 4: Process with Modal (download + trim + stems)
   Step 5: Enhance drums with fal.ai
   Step 6: Get vocal alignment from ElevenLabs
   Step 7: Prepare for Grove upload and registry update

✅ Lit Action execution completed
⏱️  Execution time: 48.3s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESULTS

💾 Saved full result to: output/audio-processor-result.json

✅ Success: true

--- Section Info ---
Section: Verse 1
Duration: 23s
Time range: 0s - 23s
Segment hash: 0x...

--- Processed Assets ---
Vocals MP3: 0.35MB
Enhanced Drums MP3: 0.38MB
Alignment words: 45

--- Processing Time ---
Modal (download + trim + stems): 14.7s
fal.ai (drum enhancement): 8.2s
ElevenLabs (vocal alignment): 6.1s
Grove (preparation): 0.1s
Total pipeline: 29.1s

--- Performance ---
Processing speedup ratio: 0.79
Note: Assets ready for Grove upload. Frontend should: 1) Upload to Grove, 2) Call KaraokeCatalog.processSegment()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

================================================================================
✅ TEST PASSED
================================================================================
```

## Processing Time Breakdown

| Step | Expected Time | Description |
|------|---------------|-------------|
| Ownership Check | ~0.5s | Base Sepolia RPC call |
| Key Decryption | ~0.5s | Decrypt 2 API keys |
| Audio Verification | ~1.0s | Check SoundCloud availability |
| Modal Processing | ~15s | Download + trim + Demucs separation |
| fal.ai Enhancement | ~8s | AI drum enhancement (synchronous) |
| ElevenLabs Alignment | ~6s | Word-level vocal timestamps |
| Grove Prep | ~0.1s | Get segment hash |
| **Total** | **~31s** | End-to-end pipeline |

## Troubleshooting

### "ElevenLabs API key required" Error

Make sure you:
1. Exported `ELEVENLABS_API_KEY` environment variable
2. Encrypted the key with the correct CID
3. Created `elevenlabs_api_key_v2.json` file

### "fal.ai API key required" Error

Make sure you:
1. Exported `FAL_API_KEY` environment variable
2. Encrypted the key with the correct CID
3. Created `fal_api_key_v1.json` file

### "Segment not owned" Error

Run the setup script to unlock the test segment:

```bash
DOTENV_PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24 \
dotenvx run -- bash scripts/setup-test-credits.sh
```

### "Access control conditions check failed" Error

The encrypted keys are locked to a specific CID. If you uploaded a new version of the Lit Action:
1. Get the new CID
2. Re-encrypt both keys with the new CID
3. Update the test file with the new CID

### Test Times Out

The complete pipeline takes ~45s, which is close to the Lit Action timeout. If it times out:
- Check Modal API status
- Check fal.ai API status
- Check ElevenLabs API status
- Try with a shorter section (e.g., 15s instead of 23s)

## Next Steps

After successful testing:

1. **Implement Grove Upload** - Add PKP-signed upload to Grove storage
2. **Implement Registry Update** - Call `KaraokeCatalog.processSegment()` with Grove URIs
3. **Update Frontend** - Add UI for karaoke generation with progress indicators
4. **Add Error Handling** - Handle API failures gracefully
5. **Optimize Performance** - Parallel processing where possible

## File Changes

### Modified Files

- `src/karaoke/audio-processor-v1.js` - Complete pipeline implementation
- `src/test/test-audio-processor.mjs` - Updated test with fal.ai + ElevenLabs
- `.env` - Added FAL_API_KEY placeholder

### New Files to Create

- `src/karaoke/keys/elevenlabs_api_key_v2.json` - Encrypted ElevenLabs key
- `src/karaoke/keys/fal_api_key_v1.json` - Encrypted fal.ai key

## Architecture Notes

### Why ZIP Extraction?

Modal returns stems as base64-encoded ZIPs. We extract the MP3 files to:
1. Send raw drums to fal.ai for enhancement
2. Send raw vocals to ElevenLabs for alignment

### Why Synchronous APIs?

Lit Actions have a 30s timeout and cannot poll. We use:
- fal.ai synchronous API (`https://fal.run`) instead of queue
- ElevenLabs synchronous alignment endpoint

### Why Frontend Grove Upload?

Grove upload requires the `@lens-chain/storage-client` package, which is not available in Lit Action runtime. The Lit Action prepares the assets, and the frontend:
1. Uploads to Grove with user wallet
2. Calls `KaraokeCatalog.processSegment()` with Grove URIs

### Future: PKP Grove Upload

To implement full automation, we need to:
1. Add `@lens-chain/storage-client` to Lit Action dependencies
2. Use PKP to sign Grove upload
3. Use PKP to sign `processSegment()` transaction

This requires additional Lit Action capabilities that may not be available yet.
