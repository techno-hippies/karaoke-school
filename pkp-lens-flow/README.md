# PKP-Lens-Flow

**Decentralized TikTok content monetization with subscription access control**

## Architecture

```
LOCAL ONLY (Cold Wallet - Never Deployed)
┌──────────────────────────────────────────────────────────┐
│  Step 1: PKP Minting (Chronicle Yellowstone)            │
│  Step 3.5: Add Genius Artist ID (Manual Edit)           │
│  Step 4: Create Lens Account (Lens testnet + Grove)     │
│  Step 5: Deploy Unlock Lock (Base Sepolia)              │
└──────────────────────────────────────────────────────────┘

SERVICES (Local-first, can deploy later)
┌──────────────────────────────────────────────────────────┐
│  Step 2: TikTok Crawler (Python - hrequests)            │
│  Step 2.9: Video Conversion (ffmpeg - HEVC→H.264) ⚠️     │
│  Step 3: Upload Profile Avatar (Grove)                  │
│  Step 6: Audio Transcription (Voxtral API)              │
│  Step 7: Multilingual Translation (OpenRouter/Gemini)   │
│  Step 8: Encrypt Videos (Lit Protocol)                  │
│  Step 9: Grove Upload (TypeScript)                      │
│  Step 10: ISRC Fetcher (Spotify API)                    │
│  Step 11: MLC Scraper (Public API)                      │
│  Step 12: Metadata Re-upload (Grove)                    │
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

2. Crawl TikTok Profile + Videos       (services/crawler/tiktok_crawler.py) ✅
   Input:  CLI --creator @handle [--lens-handle desired_handle] --copyrighted N --copyright-free N
   Output: data/videos/{handle}/manifest.json + video files

   Fetches TikTok profile (nickname, bio, avatar)
   Fetches top N copyrighted videos (with Spotify tracks)
   Fetches top N copyright-free videos (original audio)
   Downloads videos, thumbnails, profile picture

   Lens handle defaults to TikTok handle (without @) if not specified.
   Example: --creator @billieeilish → Lens handle: billieeilish
            --creator @charlidamelio --lens-handle charli → Lens handle: charli

2.9. Convert Videos to H.264 + HLS Segments (local/2.9-convert-videos.ts) ✅
   Input:  data/videos/{handle}/manifest.json + video files
   Output: Converted H.264 videos + HLS segments + .hevc backups

   CRITICAL: Must run BEFORE encryption!
   Two-step process:
   1. Convert TikTok videos from HEVC/H.265 to H.264 (browser compat)
   2. Segment H.264 videos to HLS format (.m3u8 + .ts segments)

   Backs up original HEVC files with .hevc extension
   Creates segments directory per video with playlist + segments
   Updates manifest with conversion & HLS metadata

   Why needed:
   - HEVC not supported in Chrome/Safari (black screen)
   - H.264 is universally supported
   - HLS segments enable streaming playback (better UX)

3. Upload Profile Avatar to Grove      (local/1.5-upload-profile-avatar.ts) ✅
   Input:  data/videos/{handle}/manifest.json + avatar.jpg
   Output: Updated manifest with Grove avatar URI

   Uploads profile avatar to Grove with immutable ACL (public)
   Updates manifest with lens:// URI for use in Lens account creation
   Must run before Lens account creation for proper metadata

3.5. Add Genius Artist ID (MANUAL STEP) ⚠️
   Input:  data/videos/{handle}/manifest.json
   Output: Updated manifest with geniusArtistId in profile

   FOR ARTISTS ONLY: If the creator has music on Genius.com, manually add
   their Genius artist ID to manifest.json under profile.geniusArtistId

   Example:
   {
     "profile": {
       "nickname": "Addison Rae",
       "bio": "...",
       "geniusArtistId": 1177  // ← Add this line
     }
   }

   This enables the artist profile view with Songs tab in the frontend
   Find artist ID: https://genius.com/artists/{artist-name}
   If not an artist, skip this step

4. Create Lens Account                 (local/2-create-lens-account.ts) ✅
   Input:  data/pkps/{handle}.json + data/videos/{handle}/manifest.json
   Output: data/lens/{handle}.json

   Creates Lens account on testnet with real TikTok profile data
   Uses nickname, bio, avatar URI, and bio translations from manifest
   Uploads enriched metadata to Grove storage
   Metadata includes TikTok handle, PKP address, bio translations, and
   Genius artist ID (if provided) for artist profiles

5. Deploy Unlock Lock                  (local/2.5-deploy-lock.ts) ✅
   Input:  data/pkps/ + data/lens/
   Output: Updated data/lens/{handle}.json with lock address

   Deploys subscription lock on Base Sepolia (0.01 ETH/month)
   Updates Lens metadata with lock address for discovery
   Lock beneficiary = master EOA (holds subscription payments)

6. Transcribe Audio                    (local/3.5-transcribe-audio.ts) ✅
   Input:  data/videos/{handle}/manifest.json + video files
   Output: Updated manifest with English transcriptions + word-level timestamps

   Extracts audio from videos using ffmpeg
   Transcribes to English using Mistral's Voxtral API
   Generates word-level timestamps for karaoke-style captions
   Distributes timing proportionally across words within segments

7. Translate Transcriptions + Bio      (local/3.6-translate-transcriptions.ts) ✅
   Input:  data/videos/{handle}/manifest.json with English transcriptions
   Output: Updated manifest with Vietnamese + Mandarin translations

   Translates profile bio to multiple languages
   Translates English transcriptions via OpenRouter (Gemini Flash 2.5 Lite)
   Preserves word-level timing for multilingual karaoke rendering
   Distributes translated word timing proportionally to original segments
   Supports custom language selection via --languages flag

8. Encrypt HLS Segments with Lit Protocol (local/3-encrypt-videos.ts) ✅
   Input:  data/videos/{handle}/manifest.json + HLS segments + lock address
   Output: Encrypted segment files + updated manifest

   Hybrid encryption strategy for streaming:
   1. Generate ONE symmetric key per video (AES-256)
   2. Encrypt each segment with UNIQUE IV but SAME key
   3. Encrypt symmetric key ONCE with Lit Protocol (Unlock ACC)

   Overwrites plaintext segments with encrypted ciphertext
   Stores per-segment metadata (filename, iv, authTag)
   Stores Lit-encrypted symmetric key in manifest

   Benefits:
   - Frontend decrypts key once via Lit Protocol
   - Frontend decrypts segments on-the-fly with Web Crypto API
   - Enables streaming playback with HLS.js

9. Upload HLS Segments to Grove Storage (local/4-upload-grove.ts) ✅
   Input:  data/videos/{handle}/manifest.json (with encrypted segments)
   Output: Updated manifest with Grove URIs (lens://...)

   Uploads all encrypted content to Grove:
   - HLS playlists (.m3u8 files)
   - Encrypted segments (.ts files)
   - Thumbnails (jpg/png)
   - Video metadata (json with encryption info)

   ACL: lensAccountOnly (gated by subscription)
   Stores segment URIs as map: filename → Grove URI
   Includes bio translations in profile metadata

10. Fetch ISRCs from Spotify           (local/5-fetch-isrc.ts) ✅
   Input:  data/videos/{handle}/manifest.json (Spotify track IDs)
   Output: Updated manifest with ISRC codes

   Uses Spotify Web API to get ISRCs for copyrighted tracks
   Skips copyright-free videos

10.5. Map Spotify → Genius              (local/8-map-spotify-to-genius.ts) ✅
   Input:  data/videos/{handle}/manifest.json (Spotify metadata)
   Output: Updated manifest with Genius song IDs + metadata

   Two-phase matching system:
   - Phase 1: Direct Spotify ID match from Genius media (100% confidence)
   - Phase 2: Fuzzy metadata matching (title + artist similarity)
   Adds Genius ID, URL, and match confidence to each video
   Enables frontend linking: /song/{geniusId}

11. Fetch MLC Licensing Data           (local/6-fetch-mlc.ts) ✅
   Input:  data/videos/{handle}/manifest.json (ISRCs)
   Output: Updated manifest with MLC song codes, writers, publishers

   Queries MLC Public API for licensing information
   Extracts writers, publishers, shares, IPI numbers

12. Re-upload Enriched Metadata        (local/7-reupload-metadata.ts) ✅
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
│   ├── 1.5-upload-profile-avatar.ts   # ✅ Upload avatar to Grove (before Lens)
│   ├── 2-create-lens-account.ts       # ✅ Create Lens accounts (Lens testnet)
│   ├── 2.5-deploy-lock.ts             # ✅ Deploy Unlock locks (Base Sepolia)
│   ├── 2.9-convert-videos.ts          # ✅ Convert HEVC→H.264 (browser compat)
│   ├── 3-encrypt-videos.ts            # ✅ Encrypt videos with Lit Protocol
│   ├── 3.5-transcribe-audio.ts        # ✅ Transcribe audio with Voxtral
│   ├── 3.6-translate-transcriptions.ts # ✅ Translate transcriptions + bio
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
- [x] Step 2: TikTok Crawler (dual filtering: copyrighted + copyright-free, profile data)
- [x] Step 3: Upload Profile Avatar to Grove (immutable ACL for public access)
- [x] Step 3.5: Add Genius Artist ID (MANUAL - for artists only)
- [x] Step 4: Lens Account Creation (Lens testnet with real TikTok profile data + Genius ID)
- [x] Step 5: Unlock Lock Deployment (Base Sepolia)
- [x] Step 6: Audio Transcription (Voxtral API with word-level timestamps)
- [x] Step 7: Multilingual Translation (Vietnamese + Mandarin via OpenRouter, bio + transcriptions)
- [x] Step 8: Lit Protocol Encryption (access control via Unlock keys)
- [x] Step 9: Grove Upload (encrypted videos + metadata with ACL)
- [x] Step 10: ISRC Fetching (Spotify Web API)
- [x] Step 10.5: Spotify → Genius Mapping (fuzzy matching + direct ID match)
- [x] Step 11: MLC Licensing Data (MLC Public API)
- [x] Step 12: Metadata Re-upload (enriched with licensing)

**Next Steps:**
- [ ] Frontend HLS playback with custom DecryptingLoader
- [ ] Frontend subscription purchase flow (Unlock integration)
- [ ] Frontend karaoke-style caption rendering (word-level highlighting)
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

# Step 2: Crawl TikTok (setup Python environment first)
cd services/crawler && bash setup.sh && cd ../..
bun run crawl-tiktok -- --creator @charlidamelio --copyrighted 3 --copyright-free 3
# Output: data/videos/charlidamelio/manifest.json + 6 videos + profile picture

# Step 3: Upload Profile Avatar to Grove
bun run upload-profile-avatar --creator @charlidamelio
# Output: manifest.json with Grove avatar URI (lens://...)

# Step 3.5: Add Genius Artist ID (MANUAL - for artists only)
# Open data/videos/charlidamelio/manifest.json and add:
# "profile": {
#   "nickname": "charli d'amelio",
#   "bio": "...",
#   "geniusArtistId": 1177  // ← Add this if creator is a music artist
# }
# Find artist ID at: https://genius.com/artists/charli-damelio
# Skip this step if not an artist

# Step 4: Create Lens Account
bun run create-lens --creator @charlidamelio
# Output: data/lens/charlidamelio.json (with real TikTok profile data + Genius ID)

# Step 5: Deploy Unlock Subscription Lock
bun run deploy-lock --creator @charlidamelio
# Output: Lock contract on Base Sepolia, updated Lens metadata

# Step 6: Transcribe Audio with Voxtral
bun run transcribe-audio --creator @charlidamelio
# Output: manifest.json with English transcriptions + word-level timestamps

# Step 7: Translate Transcriptions + Bio
bun run translate-transcriptions --creator @charlidamelio
# Output: manifest.json with Vietnamese + Mandarin translations (bio + transcriptions)
# Optional: Use --languages flag to specify languages (default: vi,zh)

# Step 8: Encrypt HLS Segments with Lit Protocol
bun run encrypt-videos --creator @charlidamelio
# Output: Encrypted segments + manifest with encryption metadata (per-segment IVs)

# Step 9: Upload HLS Segments to Grove Storage
bun run upload-grove --creator @charlidamelio
# Output: manifest.json with Grove URIs for playlists + segments (lens://...)

# Step 10: Fetch ISRCs from Spotify
bun run fetch-isrc --creator @charlidamelio
# Output: manifest.json with ISRC codes

# Step 11: Fetch MLC Licensing Data
bun run fetch-mlc --creator @charlidamelio
# Output: manifest.json with song codes, writers, publishers

# Step 12: Re-upload Enriched Metadata
bun run reupload-metadata --creator @charlidamelio
# Output: Updated Grove URIs with licensing data
```

### Individual Steps

```bash
# Mint PKP only
bun run mint-pkp --creator @handle

# Crawl TikTok with custom counts
bun run crawl-tiktok -- --creator @handle --copyrighted 5 --copyright-free 2

# Upload profile avatar to Grove
bun run upload-profile-avatar --creator @handle

# Create Lens account (requires PKP + manifest with avatar)
bun run create-lens --creator @handle

# Deploy lock (requires PKP + Lens)
bun run deploy-lock --creator @handle

# Transcribe audio
bun run transcribe-audio --creator @handle

# Translate transcriptions + bio with custom languages
bun run translate-transcriptions --creator @handle --languages vi,zh,es

# Test copyright filters without downloading
cd services/crawler
python3 test_filters.py handle
python3 test_dual_filter.py handle --copyrighted 2 --copyright-free 2
```

## Frontend Integration (HLS Decryption)

Once the pipeline is complete, the frontend implements streaming decryption with HLS.js:

### Flow

1. **Fetch video metadata** from Grove (includes encryption info + segment URIs)
2. **Decrypt symmetric key** via Lit Protocol (once per video)
3. **Setup HLS.js** with custom DecryptingLoader
4. **Decrypt segments on-the-fly** as they load
5. **Stream playback** immediately (no waiting for full download)

### Implementation Example

```typescript
// 1. Fetch metadata from Grove
const metadata = await fetchVideoMetadata(groveMetadataUri);
const { encryption, groveUris } = metadata;

// 2. Decrypt symmetric key via Lit Protocol
const litClient = await createLitClient({ network: nagaDev });
const decryptResult = await litClient.decrypt({
  ciphertext: encryption.encryptedSymmetricKey,
  dataToEncryptHash: encryption.dataToEncryptHash,
  unifiedAccessControlConditions: encryption.unifiedAccessControlConditions,
  chain: 'baseSepolia',
  authContext: pkpAuthContext,
});
const symmetricKey = decryptResult.decryptedData;

// 3. Setup HLS.js with custom DecryptingLoader
const hls = new Hls();
hls.config.loader = class DecryptingLoader extends Hls.DefaultConfig.loader {
  async load(context, config, callbacks) {
    const filename = context.url.split('/').pop();

    // Skip decryption for playlist file
    if (filename.endsWith('.m3u8')) {
      return super.load(context, config, callbacks);
    }

    // Find segment metadata
    const segmentMeta = encryption.segments.find(s => s.filename === filename);

    // Fetch encrypted segment from Grove
    const encrypted = await fetch(groveUris.segments[filename]);
    const encryptedData = await encrypted.arrayBuffer();

    // Decrypt with Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      symmetricKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const iv = base64Decode(segmentMeta.iv);
    const authTag = base64Decode(segmentMeta.authTag);

    // Append auth tag to ciphertext (required for AES-GCM)
    const ciphertextWithTag = new Uint8Array(encryptedData.byteLength + authTag.byteLength);
    ciphertextWithTag.set(new Uint8Array(encryptedData), 0);
    ciphertextWithTag.set(authTag, encryptedData.byteLength);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertextWithTag
    );

    // Return to HLS.js for playback
    callbacks.onSuccess({ url: context.url, data: decrypted }, { code: 200, text: 'OK' }, context);
  }
};

// 4. Load playlist and play
hls.loadSource(groveUris.playlist);
hls.attachMedia(videoElement);
```

### Benefits

- ✅ **Fast playback**: Starts in ~1-2 seconds (vs 10-30s for full file)
- ✅ **Memory efficient**: Only decrypts segments as needed
- ✅ **Smooth seeking**: Fetches only required segments
- ✅ **Same security**: Unlock NFT still required to decrypt
- ✅ **Better UX**: Instant playback, progress bar works correctly

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
  "lensHandle": "@charlidamelio",
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
  "lensHandle": "@charlidamelio",
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
      "hls": {
        "segmented": true,
        "segmentedAt": "2025-10-16T20:45:00.000Z",
        "segmentDuration": 4,
        "segmentCount": 8,
        "playlistFile": "playlist.m3u8",
        "segmentsDir": "segments/7445733962606603563"
      },
      "encryption": {
        "encryptedSymmetricKey": "gwoKEgeHa8QkEjiBJLS84BqeF4x2...",
        "dataToEncryptHash": "05b046b23275aae33b846b8b6452ff21...",
        "unifiedAccessControlConditions": [
          {
            "conditionType": "evmContract",
            "contractAddress": "0x3ed620cd13a71f35f90e296a78853b5e7bdbceaf",
            "chain": "baseSepolia",
            "functionName": "getHasValidKey",
            "functionParams": [":userAddress"],
            "returnValueTest": { "comparator": "=", "value": "true" }
          }
        ],
        "segments": [
          { "filename": "playlist0.ts", "iv": "BUKpFlVGWWtukyWP", "authTag": "pt8MPso/R9ykxBVhn3B9Rg==" },
          { "filename": "playlist1.ts", "iv": "KK2n5OK3G6g8GTg5", "authTag": "SlLB+zn3xx0/y/xesZSycQ==" },
          { "filename": "playlist2.ts", "iv": "cXPKYMF6JgMRlN3z", "authTag": "rmcSoTZbO1eWi752+iCLfw==" }
        ],
        "encryptedAt": "2025-10-16T21:00:00.000Z"
      },
      "groveUris": {
        "playlist": "lens://a1b2c3d4e5...",
        "segments": {
          "playlist0.ts": "lens://f486be2d3c...",
          "playlist1.ts": "lens://3d229c35d5...",
          "playlist2.ts": "lens://958f63a3f1..."
        },
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
3. **HLS streaming encryption**: Videos segmented + encrypted for streaming playback (better UX)
4. **Hybrid encryption strategy**: AES-256-GCM per segment + Lit Protocol wraps symmetric key
5. **Multilingual karaoke captions**: English transcription → Vietnamese + Mandarin translation with word-level timestamps
6. **Lit Protocol access control**: Symmetric key encrypted with Unlock subscription check
7. **Grove for content storage**: Decentralized storage with ACL (lensAccountOnly) for encrypted segments
8. **Lens metadata for discovery**: Lock address stored in Lens account attributes (no backend API needed)
9. **Dual content filtering**: Both copyrighted (with licensing) and copyright-free (original audio) videos
10. **Licensing data enrichment**: ISRC → MLC song codes → writers/publishers for royalty tracking
11. **Unlock for subscriptions**: ERC721 locks on Base Sepolia (0.01 ETH/month, master EOA beneficiary)
12. **V1 simplicity**: No splits contracts yet, manual withdrawals, can upgrade later
13. **Timestamp everything**: fetchedAt timestamps on ISRC/MLC data for staleness tracking
14. **Transcribe before encrypt**: Audio transcription happens before encryption to ensure plaintext access

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
const creator = "charlidamelio"

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
