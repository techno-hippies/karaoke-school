# PKP-Lens-Flow

**Decentralized TikTok content monetization with subscription access control**

## Architecture

```
LOCAL ONLY (Cold Wallet - Never Deployed)
┌──────────────────────────────────────────────────────────┐
│  Step 1: PKP Minting (Chronicle Yellowstone)            │
│  Step 2: Lens Account Creation (Lens testnet + Grove)   │
│  Step 2.5: Deploy Unlock Lock (Base Sepolia)            │
└──────────────────────────────────────────────────────────┘

SERVICES (Local-first, can deploy later)
┌──────────────────────────────────────────────────────────┐
│  Step 3: TikTok Crawler (Python - hrequests)            │
│  Step 3.5: Audio Transcription (Voxtral API)            │
│  Step 3.6: Multilingual Translation (OpenRouter/Gemini) │
│  Step 4: Encrypt Videos (Lit Protocol)                  │
│  Step 5: Grove Upload (TypeScript)                      │
│  Step 6: ISRC Fetcher (Spotify API)                     │
│  Step 7: MLC Scraper (Public API)                       │
│  Step 8: Metadata Re-upload (Grove)                     │
└──────────────────────────────────────────────────────────┘

STORAGE
┌──────────────────────────────────────────────────────────┐
│  Grove Storage (Lens)     → Videos, metadata, licensing  │
│  Local JSON (data/)       → PKP, Lens, manifests         │
│  Unlock Locks (Base)      → Subscription contracts       │
└──────────────────────────────────────────────────────────┘
```

## Pipeline Flow

```
1. Mint PKP                            (local/1-mint-pkp.ts) ✅
   Input:  CLI --creator @handle
   Output: data/pkps/{handle}.json

   Mints PKP on Chronicle Yellowstone testnet

2. Create Lens Account                 (local/2-create-lens-account.ts) ✅
   Input:  data/pkps/{handle}.json
   Output: data/lens/{handle}.json

   Creates Lens account on testnet, uploads metadata to Grove storage
   Metadata includes TikTok handle and PKP address

2.5. Deploy Unlock Lock                (local/2.5-deploy-lock.ts) ✅
   Input:  data/pkps/ + data/lens/
   Output: Updated data/lens/{handle}.json with lock address

   Deploys subscription lock on Base Sepolia (0.01 ETH/month)
   Updates Lens metadata with lock address for discovery
   Lock beneficiary = master EOA (holds subscription payments)

3. Crawl TikTok Videos                 (services/crawler/tiktok_crawler.py) ✅
   Input:  CLI --creator @handle --copyrighted N --copyright-free N
   Output: data/videos/{handle}/manifest.json + video files

   Fetches top N copyrighted videos (with Spotify tracks)
   Fetches top N copyright-free videos (original audio)
   Downloads videos, thumbnails, profile picture

3.5. Transcribe Audio                 (local/3.5-transcribe-audio.ts) ✅
   Input:  data/videos/{handle}/manifest.json + video files
   Output: Updated manifest with English transcriptions + word-level timestamps

   Extracts audio from videos using ffmpeg
   Transcribes to English using Mistral's Voxtral API
   Generates word-level timestamps for karaoke-style captions
   Distributes timing proportionally across words within segments

3.6. Translate Transcriptions         (local/3.6-translate-transcriptions.ts) ✅
   Input:  data/videos/{handle}/manifest.json with English transcriptions
   Output: Updated manifest with Vietnamese + Mandarin translations

   Translates English transcriptions via OpenRouter (Gemini Flash 2.5 Lite)
   Preserves word-level timing for multilingual karaoke rendering
   Distributes translated word timing proportionally to original segments
   Supports custom language selection via --languages flag

4. Encrypt Videos with Lit Protocol   (local/3-encrypt-videos.ts) ✅
   Input:  data/videos/{handle}/manifest.json + lock address
   Output: Encrypted video files + updated manifest

   Encrypts each video using Lit Protocol
   Access control: requires valid Unlock subscription key
   Overwrites plaintext videos with encrypted ciphertext
   Stores encryption metadata (dataToEncryptHash, accessControlConditions)

5. Upload to Grove Storage             (local/4-upload-grove.ts) ✅
   Input:  data/videos/{handle}/manifest.json (with encrypted videos)
   Output: Updated manifest with Grove URIs (lens://...)

   Uploads all encrypted videos, thumbnails, metadata to Grove
   ACL: lensAccountOnly (gated by subscription)

6. Fetch ISRCs from Spotify            (local/5-fetch-isrc.ts) ✅
   Input:  data/videos/{handle}/manifest.json (Spotify track IDs)
   Output: Updated manifest with ISRC codes

   Uses Spotify Web API to get ISRCs for copyrighted tracks
   Skips copyright-free videos

7. Fetch MLC Licensing Data            (local/6-fetch-mlc.ts) ✅
   Input:  data/videos/{handle}/manifest.json (ISRCs)
   Output: Updated manifest with MLC song codes, writers, publishers

   Queries MLC Public API for licensing information
   Extracts writers, publishers, shares, IPI numbers

8. Re-upload Enriched Metadata         (local/7-reupload-metadata.ts) ✅
   Input:  data/videos/{handle}/manifest.json (with ISRC + MLC data)
   Output: Updated Grove URIs with enriched metadata

   Re-uploads video metadata to Grove with licensing data
   Adds timestamps for data staleness tracking
```

## Folder Structure

```
pkp-lens-flow/
├── local/                              # LOCAL ONLY - Cold wallet operations
│   ├── 1-mint-pkp.ts                  # ✅ Mint PKPs (Chronicle Yellowstone)
│   ├── 2-create-lens-account.ts       # ✅ Create Lens accounts (Lens testnet)
│   ├── 2.5-deploy-lock.ts             # ✅ Deploy Unlock locks (Base Sepolia)
│   ├── 3-encrypt-videos.ts            # ✅ Encrypt videos with Lit Protocol
│   ├── 4-upload-grove.ts              # ✅ Upload encrypted content to Grove
│   ├── 5-fetch-isrc.ts                # ✅ Fetch ISRCs from Spotify
│   ├── 6-fetch-mlc.ts                 # ✅ Fetch MLC licensing data
│   └── 7-reupload-metadata.ts         # ✅ Re-upload enriched metadata
│
├── services/
│   └── crawler/                        # ✅ TikTok scraping (Python)
│       ├── tiktok_crawler.py          # Main crawler with dual filtering
│       ├── test_filters.py            # Copyright filter testing
│       └── test_dual_filter.py        # Dual filter testing
│
├── data/                               # All outputs (gitignored)
│   ├── pkps/                          # PKP data per creator
│   │   └── {handle}.json              # PKP public key, eth address, token ID
│   ├── lens/                          # Lens account data
│   │   └── {handle}.json              # Lens handle, account address, lock info
│   └── videos/                        # Scraped video content
│       └── {handle}/
│           ├── manifest.json          # Full pipeline state
│           ├── avatar.jpg             # Profile picture
│           ├── video_*.mp4            # Downloaded videos
│           └── thumbnail_*.jpg        # Video thumbnails
│
├── .env                                # Environment variables (encrypted with dotenvx)
└── package.json
```

## Current Status

**All core pipeline steps complete!** ✅

- [x] Step 1: PKP Minting (Chronicle Yellowstone)
- [x] Step 2: Lens Account Creation (Lens testnet)
- [x] Step 2.5: Unlock Lock Deployment (Base Sepolia)
- [x] Step 3: TikTok Crawler (dual filtering: copyrighted + copyright-free)
- [x] Step 3.5: Audio Transcription (Voxtral API with word-level timestamps)
- [x] Step 3.6: Multilingual Translation (Vietnamese + Mandarin via OpenRouter)
- [x] Step 4: Lit Protocol Encryption (access control via Unlock keys)
- [x] Step 5: Grove Upload (encrypted videos + metadata with ACL)
- [x] Step 6: ISRC Fetching (Spotify Web API)
- [x] Step 7: MLC Licensing Data (MLC Public API)
- [x] Step 8: Metadata Re-upload (enriched with licensing)

**Next Steps:**
- [ ] Frontend karaoke-style caption rendering (word-level highlighting)
- [ ] Frontend subscription purchase flow (Unlock integration)
- [ ] Frontend decryption flow (Lit Protocol authentication)
- [ ] Lens feed posting integration

## Prerequisites

1. **Test Tokens**
   - Chronicle Yellowstone: https://chronicle-yellowstone-faucet.getlit.dev/ (for PKP minting)
   - Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet (for Unlock locks)

2. **API Keys**
   - Spotify Client ID + Secret: https://developer.spotify.com/dashboard
   - Voxtral API Key (Mistral AI): https://console.mistral.ai/
   - OpenRouter API Key: https://openrouter.ai/keys
   - (MLC API is public, no key needed)

3. **Environment Variables** (`.env` file)
   ```bash
   # Master EOA private key (controls PKPs and locks)
   PRIVATE_KEY=your_private_key_here

   # Spotify API credentials
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret

   # Voxtral API (Mistral AI) for transcription
   VOXTRAL_API_KEY=your_voxtral_key_here

   # OpenRouter API for translation
   OPENROUTER_API_KEY=your_openrouter_key_here
   ```

   Use `dotenvx` for encryption:
   ```bash
   npx dotenvx encrypt
   ```

## Usage

### Full Pipeline

```bash
cd pkp-lens-flow
bun install

# Step 1: Mint PKP
bun run mint-pkp --creator @charlidamelio
# Output: data/pkps/charlidamelio.json

# Step 2: Create Lens Account
bun run create-lens --creator @charlidamelio
# Output: data/lens/charlidamelio.json

# Step 2.5: Deploy Unlock Subscription Lock
bun run deploy-lock --creator @charlidamelio
# Output: Lock contract on Base Sepolia, updated Lens metadata

# Step 3: Crawl TikTok (setup Python environment first)
cd services/crawler && bash setup.sh && cd ../..
bun run crawl-tiktok -- --creator @charlidamelio --copyrighted 3 --copyright-free 3
# Output: data/videos/charlidamelio/manifest.json + 6 videos

# Step 3.5: Transcribe Audio with Voxtral
bun run transcribe-audio --creator @charlidamelio
# Output: manifest.json with English transcriptions + word-level timestamps

# Step 3.6: Translate Transcriptions
bun run translate-transcriptions --creator @charlidamelio
# Output: manifest.json with Vietnamese + Mandarin translations
# Optional: Use --languages flag to specify languages (default: vi,zh)

# Step 4: Encrypt Videos with Lit Protocol
bun run encrypt-videos --creator @charlidamelio
# Output: Encrypted videos + manifest with encryption metadata

# Step 5: Upload to Grove Storage
bun run upload-grove --creator @charlidamelio
# Output: manifest.json with Grove URIs (lens://...)

# Step 6: Fetch ISRCs from Spotify
bun run fetch-isrc --creator @charlidamelio
# Output: manifest.json with ISRC codes

# Step 7: Fetch MLC Licensing Data
bun run fetch-mlc --creator @charlidamelio
# Output: manifest.json with song codes, writers, publishers

# Step 8: Re-upload Enriched Metadata
bun run reupload-metadata --creator @charlidamelio
# Output: Updated Grove URIs with licensing data
```

### Individual Steps

```bash
# Mint PKP only
bun run mint-pkp --creator @handle

# Create Lens account only (requires PKP)
bun run create-lens --creator @handle

# Deploy lock only (requires PKP + Lens)
bun run deploy-lock --creator @handle

# Crawl TikTok with custom counts
bun run crawl-tiktok -- --creator @handle --copyrighted 5 --copyright-free 2

# Transcribe audio only
bun run transcribe-audio --creator @handle

# Translate transcriptions with custom languages
bun run translate-transcriptions --creator @handle --languages vi,zh,es

# Test copyright filters without downloading
cd services/crawler
python3 test_filters.py handle
python3 test_dual_filter.py handle --copyrighted 2 --copyright-free 2
```

### Example Output

**PKP Data** (`data/pkps/charlidamelio.json`):
```json
{
  "tiktokHandle": "@charlidamelio",
  "pkpPublicKey": "0x0461e222...",
  "pkpEthAddress": "0xD25C5a638D108d222b5622f0DDBBF763A5AAa3fe",
  "pkpTokenId": "891099264949...",
  "ownerEOA": "0x0C6433789d14050aF47198B2751f6689731Ca79C",
  "network": "chronicle-yellowstone",
  "mintedAt": "2025-10-15T13:40:21.240Z",
  "transactionHash": "0xf44c2c161..."
}
```

**Lens Account** (`data/lens/charlidamelio.json`):
```json
{
  "tiktokHandle": "@charlidamelio",
  "pkpEthAddress": "0xD25C5a638D108d222b5622f0DDBBF763A5AAa3fe",
  "lensHandle": "@charlidameliotiktok",
  "lensAccountAddress": "0x...",
  "lensAccountId": "0x...",
  "network": "lens-testnet",
  "createdAt": "2025-10-15T14:03:22.152Z",
  "metadataUri": "lens://14bef6c53e0769ae...",
  "subscriptionLock": {
    "address": "0x3ed620cd13a71f35f90e296a78853b5e7bdbceaf",
    "chain": "base-sepolia",
    "deployedAt": "2025-10-15T16:22:49.342Z",
    "transactionHash": "0xe3034570f7de..."
  }
}
```

**Manifest** (`data/videos/charlidamelio/manifest.json`):
```json
{
  "tiktokHandle": "@charlidamelio",
  "lensHandle": "@charlidameliotiktok",
  "lensAccountAddress": "0xD25C5a638D108d222b5622f0DDBBF763A5AAa3fe",
  "scrapedAt": "2025-10-15T15:30:00.000Z",
  "profile": {
    "nickname": "charli d'amelio",
    "bio": "...",
    "stats": { "followerCount": 155700000, "videoCount": 2500 },
    "groveUris": {
      "avatar": "lens://f486be2d3c...",
      "metadata": "lens://3d229c35d5..."
    }
  },
  "videos": [
    {
      "postId": "7445733962606603563",
      "postUrl": "https://www.tiktok.com/@charlidamelio/video/7445733962606603563",
      "copyrightType": "copyrighted",
      "stats": { "views": 15200000, "likes": 2100000 },
      "music": {
        "title": "That's So True",
        "spotifyUrl": "https://open.spotify.com/track/...",
        "spotify": {
          "isrc": "USUG12406903",
          "metadata": { "name": "That's So True", "artists": [...] },
          "fetchedAt": "2025-10-15T15:49:40.942Z"
        },
        "mlc": {
          "songCode": "TX6LRG",
          "writers": [
            { "firstName": "GRACIE", "lastName": "ABRAMS" },
            { "firstName": "AUDREY", "lastName": "HOBERT", "ipiNumber": "01163030600" }
          ],
          "originalPublishers": [...],
          "fetchedAt": "2025-10-15T15:50:02.307Z"
        }
      },
      "groveUris": {
        "video": "lens://f486be2d3c...",
        "thumbnail": "lens://3d229c35d5...",
        "metadata": "lens://958f63a3f1..."
      },
      "transcription": {
        "languages": {
          "en": {
            "language": "en",
            "text": "That's so true...",
            "segments": [
              {
                "start": 0,
                "end": 2.8,
                "text": "What you do to get you off?",
                "words": [
                  { "word": "What", "start": 0, "end": 0.4 },
                  { "word": "you", "start": 0.4, "end": 0.8 }
                ]
              }
            ]
          },
          "vi": {
            "language": "vi",
            "text": "Bạn làm gì để giải tỏa?",
            "segments": [
              {
                "start": 0,
                "end": 2.8,
                "text": "Bạn làm gì để giải tỏa?",
                "words": [
                  { "word": "Bạn", "start": 0, "end": 0.4 }
                ]
              }
            ]
          },
          "zh": {
            "language": "zh",
            "text": "你做什么来让你兴奋？",
            "segments": [
              {
                "start": 0,
                "end": 2.8,
                "text": "你做什么来让你兴奋？",
                "words": [
                  { "word": "你做什么来让你兴奋？", "start": 0, "end": 2.8 }
                ]
              }
            ]
          }
        },
        "generatedAt": "2025-10-15T19:53:20.055Z",
        "voxtralModel": "voxtral-mini-latest",
        "translationModel": "google/gemini-2.5-flash-lite-preview-09-2025"
      }
    }
  ]
}
```

## Key Design Decisions

1. **Local-first**: Everything works locally before thinking about deployment
2. **Cold wallet controls everything**: Master EOA owns PKPs, manages locks, withdraws subscription payments
3. **Multilingual karaoke captions**: English transcription → Vietnamese + Mandarin translation with word-level timestamps
4. **Lit Protocol encryption**: Videos encrypted with access control conditions (requires valid Unlock key)
5. **Grove for content storage**: Decentralized storage with ACL (lensAccountOnly) for encrypted content
6. **Lens metadata for discovery**: Lock address stored in Lens account attributes (no backend API needed)
7. **Dual content filtering**: Both copyrighted (with licensing) and copyright-free (original audio) videos
8. **Licensing data enrichment**: ISRC → MLC song codes → writers/publishers for royalty tracking
9. **Unlock for subscriptions**: ERC721 locks on Base Sepolia (0.01 ETH/month, master EOA beneficiary)
10. **V1 simplicity**: No splits contracts yet, manual withdrawals, can upgrade later
11. **Timestamp everything**: fetchedAt timestamps on ISRC/MLC data for staleness tracking
12. **Transcribe before encrypt**: Audio transcription happens before encryption to ensure plaintext access

## Tech Stack

**Blockchain:**
- Lit Protocol v8 (Chronicle Yellowstone) - PKP minting with ECDSA signing
- Lens Protocol v3 (Lens testnet) - Decentralized social accounts
- Grove Storage (Lens) - Decentralized content storage with ACL
- Unlock Protocol v13/14 (Base Sepolia) - ERC721 subscription locks

**APIs:**
- Voxtral API (Mistral AI) - Audio transcription with word-level timestamps
- OpenRouter - LLM routing for multilingual translation (Gemini Flash 2.5 Lite)
- Spotify Web API - ISRC fetching via Client Credentials OAuth
- MLC Public API - Song code lookups, licensing data

**Languages:**
- TypeScript/Bun - Blockchain interactions, Grove uploads, transcription/translation
- Python 3 - TikTok scraping with hrequests (anti-detection)

**Key Libraries:**
- `@lit-protocol/lit-client` v8.0.2 - PKP minting and authentication
- `@lens-protocol/client` - Lens account creation and metadata
- `@lens-chain/storage-client` - Grove uploads with ACL
- `@unlock-protocol/contracts` - Lock deployment
- `viem` v2.21+ - Ethereum interactions
- `hrequests` - HTTP requests with browser impersonation
- `yt-dlp` - TikTok video downloading

**Security:**
- `@dotenvx/dotenvx` - Encrypted environment variables
- Master EOA private key never leaves local machine
- PKPs controlled by cold wallet (can delegate later)

## Discovery Flow (No Backend Required)

The system uses Lens account metadata for discovery, eliminating the need for a backend API:

```typescript
// 1. User visits frontend, searches for creator
const creator = "charlidameliotiktok"

// 2. Frontend fetches Lens account by username
const { data: account } = useAccount({
  username: { localName: creator }
})

// 3. Fetch metadata from Grove
const response = await fetch(
  `https://grove.infra.lens.build/${account.metadata.uri.replace('lens://', '')}`
)
const metadata = await response.json()

// 4. Extract lock address from metadata attributes
const lockAddress = metadata.lens.attributes.find(
  attr => attr.key === 'subscription_lock'
)?.value
// Result: "0x3ed620cd13a71f35f90e296a78853b5e7bdbceaf"

const chain = metadata.lens.attributes.find(
  attr => attr.key === 'subscription_chain'
)?.value
// Result: "base-sepolia"

// 5. Check if user has valid subscription key
const publicLock = new ethers.Contract(lockAddress, PublicLockABI, provider)
const hasValidKey = await publicLock.getHasValidKey(userAddress)

// 6. If no key, show purchase flow
if (!hasValidKey) {
  const keyPrice = await publicLock.keyPrice()
  await publicLock.purchase([userAddress], [userAddress], [userAddress], {
    value: keyPrice
  })
}

// 7. If has valid key, fetch encrypted video from Grove
const videoUri = "lens://f486be2d3c56199da42f1410fcbc353270b9d0882e73da6403e9f8eb24944ba1"
const encryptedVideo = await fetchFromGrove(videoUri)

// 8. Get encryption metadata from manifest
const videoMetadata = await fetchFromGrove(metadataUri)
const { dataToEncryptHash, accessControlConditions } = videoMetadata.encryption

// 9. Decrypt with Lit Protocol (user proves they have valid key)
import { nagaDev } from "@lit-protocol/networks"
const litClient = await createLitClient({ network: nagaDev })

// User authenticates to prove they meet access conditions
const authContext = await authManager.createEoaAuthContext({
  config: { account: userAccount },
  authConfig: {
    domain: window.location.host,
    statement: "Decrypt subscription content",
    resources: [["access-control-condition-decryption", "*"]]
  },
  litClient
})

// Decrypt the video
const decryptedVideo = await litClient.decrypt({
  data: {
    ciphertext: encryptedVideo,
    dataToEncryptHash
  },
  accessControlConditions,
  authContext,
  chain: "baseSepolia"
})

// 10. Play decrypted video
const videoBlob = new Blob([decryptedVideo], { type: 'video/mp4' })
const videoUrl = URL.createObjectURL(videoBlob)
videoElement.src = videoUrl
```

**Key Benefits:**
- No centralized API needed
- Data stored on-chain and in decentralized storage
- Lock address discoverable from Lens metadata
- Content access controlled by Unlock key ownership
- Videos encrypted end-to-end with Lit Protocol
- Only subscribers can decrypt content
