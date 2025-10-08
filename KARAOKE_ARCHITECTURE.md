# Karaoke School Architecture

**Last Updated**: 2025-10-08

## Overview

Karaoke School supports two types of karaoke content:

1. **Native Songs** (SongCatalogV1): Copyright-free/public domain songs with full audio
2. **User-Generated Segments** (Genius API): 30-second segments from copyrighted songs

Both can have Genius metadata for unified discovery and analytics.

---

## 🎵 Content Types

### Native Songs (Free, Full Audio)

**Source**: SongCatalogV1 contract (Lens Testnet)
**Copyright**: Public domain or copyright-free
**Audio**: Full song (2-4 minutes)
**Timestamps**: Word-level (ElevenLabs)
**Cost**: FREE

**Upload Flow**:
```
song-uploader tool
├─ Prepare: audio.mp3, lyrics.txt, metadata.json
├─ ElevenLabs: Generate word-level timestamps
├─ Grove: Upload full audio + metadata (IPFS)
└─ SongCatalogV1.addSong(): Register on-chain
```

**Example**: "Down Home Blues" by Ethel Waters (1923)
- Copyright expired
- Full 3:24 audio available
- Word-level karaoke overlay
- Optional geniusId: 987654 (for linking)

### User-Generated Segments (Paid, 30-Second Clips)

**Source**: Genius.com API + SoundCloud (via maid.zone)
**Copyright**: Copyrighted (fair use)
**Audio**: 30-second segments (Verse 1, Chorus, etc.)
**Timestamps**: Line-level (LRClib + Gemini)
**Cost**: 1 credit per segment (~$0.50)

**Generation Flow**:
```
User searches Genius → Song not in SongCatalogV1
├─ Cold Start: match-and-segment-v2.js (FREE)
│  ├─ Fetch Genius metadata
│  ├─ Fetch LRClib synced lyrics
│  ├─ Gemini 2.5 Flash: Segment into sections
│  └─ Return: [Verse 1, Chorus, Verse 2, Bridge, ...]
│
├─ User selects segment → Checks credits
│  └─ If no credits → PurchaseCreditsDialog
│
└─ User purchases → audio-processor-v1.js (1 credit)
   ├─ Download from maid.zone (SoundCloud)
   ├─ Trim to 30-second segment (FFmpeg)
   ├─ Separate stems (Demucs v4): vocals, drums
   ├─ Upload to storage (Grove or S3)
   └─ Mark segment as owned (permanent)
```

**Example**: "Anti-Hero" by Taylor Swift (2022)
- Still copyrighted
- Segments: Intro, Verse 1, Chorus, Verse 2, Bridge, Outro
- Each segment: ~30 seconds
- User owns segment after purchase (no re-payment)

---

## 🔗 Genius Integration

Native songs **can have** Genius metadata:

```json
{
  "id": "down-home-blues-ethel-waters",
  "geniusId": 987654,
  "geniusArtistId": 12345,
  "title": "Down Home Blues",
  "artist": "Ethel Waters"
}
```

### Benefits of Dual Registration

1. **Deduplication**:
   - User searches "Down Home Blues" on Genius
   - Frontend checks: `SongCatalogV1.songExistsByGeniusId(987654)`
   - If found → Show "🎵 Full Song - Free" badge
   - Redirect to Native version (no credits needed)

2. **Unified Leaderboards**:
   - SongQuizV2 uses `geniusArtistId` for artist challenges
   - Native + Genius songs compete together

3. **Cross-Platform Analytics**:
   - TrendingTrackerV1 aggregates by `geniusArtistId`
   - "Ethel Waters trending" shows all sources

---

## 📊 Smart Contracts

### SongCatalogV1 (Lens Testnet: 37111)

**Purpose**: Registry for copyright-free songs
**Address**: `0x88996135809cc745E6d8966e3a7A01389C774910`

**Key Fields**:
- `id`: Human-readable slug (primary key)
- `geniusId`: Optional Genius link (0 = no link)
- `audioUri`: Grove URI (full song)
- `metadataUri`: Grove URI (word-level timestamps)

**Integration**:
- StudyProgressV1: `ContentSource.Native` (source=0)
- TrendingTrackerV1: Tracks plays/clicks
- SongQuizV2: Uses geniusArtistId (if provided)

### KaraokeCreditsV1 (Base Sepolia: 84532)

**Purpose**: Credit economy for user-generated segments
**Status**: ✅ Ready to deploy

**Key Features**:
- Purchase credits: USDC (Particle Network) or ETH
- Use credits: Unlock 30-sec segments (permanent)
- Deduplication: Prevents charging for songs in SongCatalogV1
- PKP grants: Free credits for anti-botnet

**Packages**:
| Credits | USDC | Discount |
|---------|------|----------|
| 1       | $0.50 | -       |
| 10      | $4.50 | 10%     |
| 20      | $8.00 | 20%     |
| 50      | $17.50 | 30%    |

**Deduplication Check**:
```solidity
function useCredit(uint8 source, string calldata songId, string calldata segmentId) {
  // If Genius song exists in Native catalog, reject
  if (source == Genius && geniusId > 0) {
    bool existsInCatalog = SongCatalogV1(songCatalog).songExistsByGeniusId(geniusId);
    require(!existsInCatalog, "Song available for free");
  }
  // ... deduct credit
}
```

### StudyProgressV1 (Lens Testnet)

**Purpose**: Track practice sessions and FSRS data
**ContentSource**: Enum (Native=0, Genius=1)

**Integration**:
- Native songs: `recordStudySession(user, 0, catalogId, ...)`
- Genius songs: `recordStudySession(user, 1, geniusId, ...)`

### TrendingTrackerV1 (Lens Testnet)

**Purpose**: Track song popularity across all sources
**ContentSource**: Enum (Native=0, Genius=1)

**Integration**:
- Tracks clicks, plays, completions
- Aggregates by time window (hourly, daily, weekly)
- Cross-source trending (Native + Genius)

### SongQuizV2 (Lens Testnet)

**Purpose**: Daily quizzes with multilingual support
**Key**: Uses `geniusId` + `geniusArtistId`

**Integration**:
- Works with Native songs (if geniusId provided)
- Works with Genius songs
- Artist-wide challenges

---

## 🔄 User Flows

### Flow 1: Search and Discover

```
User searches "Chandelier Sia"
├─ Query Genius API: Returns geniusId=378195
├─ Check SongCatalogV1.songExistsByGeniusId(378195)
│  ├─ If TRUE → Show "🎵 Full Song - Free"
│  │  └─ Play from SongCatalogV1 (word-level karaoke)
│  │
│  └─ If FALSE → Show "🎤 Segments - 1 Credit Each"
│     └─ Proceed to Flow 2 (segment generation)
```

### Flow 2: Generate Karaoke Segments (Cold Start)

```
User clicks "Chandelier" (not in catalog)
├─ Check if segments exist in database
│  ├─ If NO → Show GenerateKaraokeDrawer
│  │  └─ Call match-and-segment-v2.js (FREE, requires 0.001 ETH balance)
│  │     ├─ Fetch Genius metadata
│  │     ├─ Fetch LRClib lyrics
│  │     ├─ Gemini: Segment into sections
│  │     └─ Store segments off-chain
│  │
│  └─ If YES → Show SegmentPickerDrawer
│     ├─ List: Verse 1, Chorus, Verse 2, Bridge, ...
│     ├─ Show: "Start" (owned) or "1 Credit" (locked)
│     └─ User selects segment → Flow 3
```

### Flow 3: Purchase Credits

```
User clicks "1 Credit" but has 0 credits
├─ Show PurchaseCreditsDialog
│  ├─ Select package (1, 10, 20, 50 credits)
│  ├─ Payment: Particle Network (any crypto → USDC)
│  │  ├─ User pays in BTC, SOL, ETH, whatever
│  │  ├─ Particle bundles: swap → bridge → USDC on Base
│  │  └─ Single signature (AA smart account)
│  │
│  └─ KaraokeCreditsV1.purchaseCreditsUSDC(packageId)
│     └─ Mint credits to user
│
└─ Update frontend: userCredits += purchased amount
```

### Flow 4: Unlock Segment

```
User clicks "1 Credit" with sufficient credits
├─ KaraokeCreditsV1.useCredit(1, "378195", "chorus-1")
│  ├─ Check: Song not in SongCatalogV1 (deduplication)
│  ├─ Deduct: 1 credit from balance
│  └─ Mark: segment as owned (permanent)
│
├─ Call audio-processor-v1.js
│  ├─ Download audio from maid.zone
│  ├─ Trim to 30-second segment
│  ├─ Separate stems (vocals, drums)
│  └─ Return: vocalsUrl, drumsUrl
│
└─ Store karaoke data in database
   └─ User can now record/perform this segment
```

### Flow 5: Record & Grade

```
User performs karaoke (VideoRecorder)
├─ Record audio + video (optional)
├─ Submit to Lit Action for grading
│  ├─ Speech-to-text: Compare to expected lyrics
│  ├─ Calculate grade: A+, A, B, C, D, F
│  └─ Store in StudyProgressV1
│
└─ Show PerformanceGradePage
   ├─ Display grade + feedback
   └─ Optional: Post to feed (VideoPoster)
```

---

## 🛠️ Technical Stack

### Frontend
- **React** + TypeScript
- **Viem** + Wagmi (web3)
- **Particle Network** (AA wallets + payments)
- **Storybook** (component development)

### Smart Contracts
- **Solidity 0.8.19**
- **Foundry** (build/deploy)
- **Lens Testnet** (SongCatalog, StudyProgress, Trending, Quiz)
- **Base Sepolia** (KaraokeCredits)

### Backend Services
- **Lit Protocol**: Decentralized compute (Lit Actions)
  - match-and-segment-v2.js: Free segment generation
  - audio-processor-v1.js: Paid karaoke processing
- **Modal**: GPU compute (Demucs stem separation)
- **ElevenLabs**: Word-level timestamp generation
- **Grove**: IPFS storage via Lens

### External APIs
- **Genius.com**: Song metadata
- **LRClib**: Synced lyrics
- **SoundCloud** (via maid.zone): Audio streaming
- **Gemini 2.5 Flash**: AI segmentation

---

## 🚀 Deployment Status

| Component | Network | Status | Address |
|-----------|---------|--------|---------|
| SongCatalogV1 | Lens Testnet | ✅ Deployed | `0x88996...910` |
| StudyProgressV1 | Lens Testnet | ✅ Deployed | TBD |
| TrendingTrackerV1 | Lens Testnet | ✅ Deployed | TBD |
| SongQuizV2 | Lens Testnet | ✅ Deployed | TBD |
| KaraokeCreditsV1 | Base Sepolia | ⏳ Ready | Not deployed |
| KaraokeSegmentRegistryV1 | TBD | ❌ Not created | - |

---

## 📝 Next Steps

### 1. Deploy KaraokeCreditsV1
```bash
cd contracts
forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

### 2. Create KaraokeSegmentRegistryV1
- Store generated segments on-chain
- Track which songs have been processed
- Link segments to vocalsUri/drumsUri

### 3. Update Lit Actions
- audio-processor-v1.js: Call `addSegment()` after stem generation
- match-and-segment-v2.js: Check if segments already exist

### 4. Integrate Frontend
- Connect Particle Network wallet
- Query KaraokeCreditsV1 for balances
- Handle credit purchase flow
- Update SegmentPickerDrawer with ownership states

### 5. Add Anti-Botnet
- Minimum balance check (0.001 ETH)
- OR rate limit (1 free generation/day/address)

---

## 🔒 Security Considerations

1. **Deduplication**: Always check SongCatalogV1 before charging credits
2. **Fair Use**: 30-second segments for copyrighted content
3. **Treasury Security**: Use multisig for payment recipient
4. **PKP Access**: Protect Lit PKP private key
5. **Rate Limiting**: Prevent spam generation requests
6. **Price Updates**: Monitor ETH/USDC prices

---

## 📚 Documentation

- **Contracts**: `/contracts/*/README.md`
- **Deployment**: `/contracts/*/DEPLOYMENT.md`
- **Lit Actions**: `/lit-actions/src/karaoke/CONTRACT_SCHEMA.md`
- **Frontend**: `/app/src/stories/**/*.stories.tsx`
- **Song Upload**: `/song-uploader/README.md`

---

## 🎯 Key Design Decisions

### Why Two Content Types?

1. **Legal Compliance**: Can't upload copyrighted full songs
2. **Fair Use**: 30-second segments fall under fair use
3. **User Choice**: Free full songs for public domain, paid segments for hits
4. **Creator Support**: Credits can fund original artists (future)

### Why Genius Metadata on Native Songs?

1. **Unified Discovery**: Search works across all sources
2. **Deduplication**: Prevent double-charging
3. **Cross-Platform**: Artist challenges work for all content
4. **Analytics**: Better trending/discovery

### Why Base for Credits?

1. **Low Fees**: Base L2 = cheap transactions
2. **USDC Native**: Stable payment token
3. **EVM Compatible**: Works with existing tools
4. **Particle Support**: Seamless any-token payments

### Why Permanent Ownership?

1. **User Value**: Pay once, own forever
2. **No Subscriptions**: Simpler UX
3. **Fair Pricing**: ~$0.50 per segment is reasonable
4. **Bulk Discounts**: Reward power users

---

## 📊 Economics

### Revenue Model
- **Credits**: $0.50 per credit (adjustable)
- **Treasury**: Receives all payments (USDC or ETH)
- **Future**: Artist royalty splits (50/50?)

### Cost Structure
- **Modal GPU**: ~$0.10 per segment (Demucs processing)
- **Lit Actions**: ~$0.05 per generation (gas + compute)
- **Storage**: ~$0.02 per segment (IPFS/S3)
- **Margin**: ~$0.33 per credit (66% profit)

### Scaling
- **Free Tier**: 2 free credits per user (PKP grants)
- **Viral Loop**: Share performances → drive signups
- **Bulk Purchases**: Discounts encourage prepayment
- **Artist Partnerships**: Split revenue with rights holders

---

## License

MIT
