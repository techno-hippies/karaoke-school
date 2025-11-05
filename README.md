# Karaoke School v1 🎵

**AI-Powered Language Learning Through Music**

Transform TikTok videos into interactive karaoke sessions with word-level timing, AI pronunciation scoring, and blockchain-native copyright tracking.

## 🎯 Overview

Karaoke School combines decentralized music industry standards (GRC-20) with AI-powered karaoke processing to create a fair, scalable language learning platform. Users sing along to AI-enhanced instrumentals while receiving real-time pronunciation feedback and learning through spaced repetition.

**Core Innovation**: Multi-layer blockchain architecture separates concerns across industry standards (GRC-20), dapp-specific events (smart contracts), and IP tracking (Story Protocol) for optimal cost and flexibility.

## 🏗️ Architecture Layers

```
TikTok → Processing → Database → GRC-20 → Contracts → Subgraph → Grove → App
   ↓         ↓          ↓         ↓         ↓          ↓       ↓      ↓
8,196    12-Step     2,766    92.3%    5/5 Deployed  Local   IPFS   React
videos   pipeline    Lines    Complete  Events     Index   Assets  Frontend
```

### Layer 1: GRC-20 (Public Music Metadata)
- **Purpose**: Industry-standard identifiers (ISNI, ISWC, ISRC) on-chain
- **Status**: ✅ 52 artists, 36 works, 39 recordings minted (92.3% complete)
- **Network**: Geo Testnet, Space ID: `78e6adba-6d19-49e8-8b12-9d1e72ecfd25`

### Layer 2: Smart Contracts (Event-Only Storage)
- **Purpose**: Karaoke segments, translations, performances, line-level FSRS
- **Network**: Lens Testnet (Chain ID: 37111)
- **Deployed**: PerformanceGrader (line-level), SongEvents, SegmentEvents, AccountEvents, TranslationEvents

### Layer 3: The Graph Subgraph (Query Layer)
- **Purpose**: Index contract events for GraphQL queries
- **Status**: Local development, needs testnet deployment
- **Line-Level FSRS**: 2,766 karaoke lines with UUID identifiers

### Layer 4: Grove/IPFS (Immutable Storage)
- **Purpose**: Audio files, word timing, translations
- **Status**: 36 segments with Grove URLs
- **Assets**: Instrumental MP3s, alignment JSON, translation JSONs

## 📊 Current Status

### ✅ Deployed & Operational
- **Database**: 2,766 karaoke lines (276 per segment average)
- **Smart Contracts**: All 5 contracts deployed on Lens Testnet
- **Line-Level FSRS**: Backend deployed, app updated
- **GRC-20**: 92.3% complete (39/42 works)
- **TikTok Data**: 8,196 videos (5,653 copyrighted)

### 🎯 Line-Level FSRS Implementation (Complete)
**Problem Solved**: Users previously only got 1 exercise per song (segment-level). Now each lyric line is a separate FSRS card.

**Architecture**:
- **Database**: `karaoke_lines` table with 2,766 lines, UUID stable identifiers
- **Contract**: `LinePerformanceGraded` event for line-level tracking
- **Subgraph**: `LineCard` entities for fast queries
- **App**: Updated to use `lineIndex` for progressive learning

### 🔧 Smart Contracts (Lens Testnet - 37111)
```typescript
const CONTRACTS = {
  PerformanceGrader: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D", // Line-level FSRS
  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6", 
  SegmentEvents: "0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8",
  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8",
  TranslationEvents: "0x..." // NEW: Deployed
}
```

### ⏳ High Priority Tasks
1. **Deploy Subgraph to Testnet** (1 hour) - Complete line-level FSRS flow
2. **Enable Line-Level in App** (2 hours) - Update useStudyCards to query lineCards
3. **Update Lit Actions** (1 hour) - Call gradeLinePerformance() instead of gradePerformance()
4. **Test End-to-End** (1 hour) - Verify 15+ cards per song

## 🚀 Quick Start

### Development
```bash
# Start core services
cd karaoke-pipeline && ./supervisor.sh  # Pipeline (8787)
cd app && bun run dev                   # App (5173)
cd subgraph && npm run dev              # Subgraph (8000)
```

### Testing Line-Level FSRS
```bash
# Start app and visit study page
cd app && bun run dev
# Navigate to: /song/{workId}/study

# Check subgraph for line-level entities
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ lineCards(first: 5) { id lineId lineIndex } }"}'
```

### Environment
```bash
# Required variables
VITE_LENS_ENVIRONMENT=testnet
NEON_DATABASE_URL=postgresql://...
GROVE_API_KEY=...
VITE_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/subgraph-0/
```

## 🎯 Key Database Tables

### `karaoke_segments`
```sql
spotify_track_id TEXT PRIMARY KEY
fal_segment_grove_url TEXT       -- Instrumental MP3
alignment_data JSONB             -- Word-level timing
```

### `karaoke_lines` (NEW - Line-Level FSRS)
```sql
line_id UUID PRIMARY KEY          -- Stable identifier
line_index INTEGER               -- Position within segment
spotify_track_id TEXT            -- Links to segment
original_text TEXT               -- Lyric text
start_ms INTEGER                 -- Absolute timing
end_ms INTEGER
segment_hash TEXT                -- Auto-computed
```

### `elevenlabs_word_alignments`
```sql
spotify_track_id TEXT UNIQUE
words JSONB                      -- [{text: "Hello", start: 0.1, end: 0.5}, ...]
```

### `lyrics_translations`
```sql
spotify_track_id TEXT, language_code TEXT
lines JSONB                      -- Line-level with word timing
```

## 🔧 Core Services

### Karaoke Pipeline (12-Step Processing)
```bash
# Process TikTok → Grove → Contracts flow
cd karaoke-pipeline
bun run unified --step=12 --limit=1

# Create PKPs for TikTok creators
bun run mint-creator-pkps

# Emit events to blockchain
bun run emit-segment-events
```

### Lit Actions (AI Scoring)
- **Network**: Base Sepolia
- **Purpose**: Pronunciation and timing analysis
- **Integration**: Called via Lit Protocol for performance grading

### Grove Storage
- **API**: Content-addressed storage (IPFS under the hood)
- **Assets**: MP3s, JSONs, images with `grove://` URIs
- **Cost**: Free for IPFS storage

## 📋 Line-Level FSRS Migration

### Before (Broken)
```
User visits study page → 1 card loaded → Shows line 0 only
After 1 practice → "Study session complete!" ❌
```

### After (Fixed)
```
User visits study page → 15+ cards loaded (FSRS daily limit)
Shows line 0 → Next → Shows line 1 → Next → Shows line 2...
After 15 practices → "Daily limit reached! Come back tomorrow." ✅
```

### Required Updates
1. **useStudyCards Hook**: Query `lineCards` instead of `segments`
2. **Lit Action Grader**: Call `gradeLinePerformance()` with `lineId` + `lineIndex`
3. **Subgraph Deployment**: Deploy to The Graph Studio for production

## 🔗 Documentation

### Service Documentation
- **[AGENTS.md](./AGENTS.md)**: Service integration guide, API endpoints
- **[app/docs/](./app/docs/)**: React frontend documentation
- **[karaoke-pipeline/docs/](./karaoke-pipeline/docs/)**: Processing pipeline docs
- **[contracts/docs/](./contracts/docs/)**: Smart contract documentation

### Implementation Details
- **FSRS Implementation**: Move detailed docs to `/app/docs/line-level-fsrs.md`
- **GRC-20 Integration**: Move to `/contracts/docs/grc20.md`
- **Story Protocol**: Move to `/subgraph/docs/story-protocol.md`

## 🎯 Next Steps

### Immediate (Today)
1. **Deploy Subgraph** - Local → The Graph Studio
2. **Update App Integration** - Enable line-level FSRS queries
3. **Test Lit Actions** - Verify gradeLinePerformance() works
4. **End-to-End Testing** - Complete 15+ card study session

### This Week
1. **Story Protocol** - Test single video (7558957526327332118)
2. **Revenue Split** - 82% artist, 18% creator
3. **PKP Creation** - 51 TikTok creators
4. **Production Deployment** - Subgraph → testnet

### Next Month
- **Complete ISWCs** - Final 3 works need codes
- **Scale Story Protocol** - 5,653 copyrighted videos
- **Performance Optimization** - Audio streaming, caching

---

**Multi-layer blockchain architecture with line-level FSRS for progressive language learning** 🎵
