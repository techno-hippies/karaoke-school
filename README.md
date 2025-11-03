# Karaoke School v1 🎵

**AI-Powered Language Learning Through Music**

Learn languages by singing along to your favorite songs! Karaoke School transforms TikTok videos into interactive karaoke sessions with word-level timing, AI pronunciation scoring, and spaced repetition learning.

## 🎯 What is Karaoke School?

Karaoke School is a revolutionary language learning platform that combines:

- **🎤 Interactive Karaoke**: Sing along with AI-enhanced instrumentals
- **🌍 Multi-Language Support**: Translations in Chinese, Vietnamese, Indonesian, and more  
- **🤖 AI Pronunciation Scoring**: Get instant feedback on your pronunciation
- **📈 Smart Learning**: Spaced repetition algorithm (FSRS) optimizes your study sessions
- **💰 Fair Creator Compensation**: Blockchain tracks copyright and automatically pays creators

## 🚀 Quick Start

### For Learners
1. **Visit the App**: Connect your wallet and create a passkey
2. **Choose a Song**: Browse from 36+ fully processed tracks
3. **Start Learning**: Use karaoke mode or study mode
4. **Track Progress**: Monitor your pronunciation scores and learning journey

### For Developers
```bash
# Run the app locally
cd app && bun run dev

# Process new karaoke segments  
cd karaoke-pipeline && ./supervisor.sh

# Deploy smart contracts
cd contracts && forge build
```

## 🎮 How It Works

### The Magic Behind the Scenes:
1. **TikTok → Karaoke**: AI automatically finds the best 3-minute segments from TikTok videos
2. **Audio Enhancement**: Separates vocals, enhances instrumentals, and creates perfect backing tracks  
3. **Word-Level Timing**: AI precisely tracks each word's timing for perfect synchronization
4. **Smart Translations**: AI provides accurate translations with word-level alignment
5. **Blockchain Tracking**: All content is tracked on-chain for fair creator compensation

### Learning Modes:
- **Karaoke Mode**: Sing along with word highlighting and instant feedback
- **Study Mode**: Spaced repetition flashcards based on FSRS algorithm
- **Performance Mode**: Record and get detailed pronunciation analysis

## 📊 Current Content

- ✅ **36+ Songs** fully processed and ready
- ✅ **3+ Languages** with accurate translations
- ✅ **8,196 TikTok Videos** processed (5,653 with copyright tracking)
- ✅ **52 Artists** properly credited via blockchain
- ✅ **AI Pronunciation Scoring** via Lit Actions
- ✅ **Creator Revenue Sharing** (82% to original artists, 18% to TikTok creators)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────┐
│    Your Browser (React App)             │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│    Blockchain (Smart Contracts)         │
│ • Lens Protocol (Social)                │
│ • GRC-20 (Music Metadata)               │
│ • Performance Tracking                  │
└─────────────────────────────────────────┘
                   ↓  
┌─────────────────────────────────────────┐
│    AI Services                          │
│ • Audio Enhancement (fal.ai)           │
│ • Word Timing (ElevenLabs)             │
│ • Translations (Gemini)                │
│ • Pronunciation Scoring (Lit)          │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│    Creator Content (TikTok)            │
│ • 8,196 videos processed               │
│ • Automatic copyright detection        │
│ • Revenue tracking & distribution      │
└─────────────────────────────────────────┘
```

## 🔐 Features & Benefits

### For Language Learners:
- **Instant Feedback**: Know exactly how to improve your pronunciation
- **Engaging Content**: Learn with songs you love, not boring textbooks
- **Personalized Learning**: AI adapts to your learning pace and weak points
- **Progress Tracking**: See your improvement over time with detailed analytics

### For Content Creators:
- **Automatic Revenue**: Get paid when your content is used for learning
- **Copyright Protection**: Blockchain ensures fair attribution and compensation
- **Global Reach**: Your content helps people worldwide learn languages
- **Transparency**: All usage and payments are trackable on-chain

### For the Music Industry:
- **Industry Standards**: Uses ISWC/ISRC codes for proper music identification
- **Copyright Compliance**: Automatic royalty distribution to rights holders
- **New Revenue Streams**: Educational use generates additional income
- **Anti-Piracy**: Immutable blockchain records prevent unauthorized use

## 🎯 Use Cases

### Individual Learning
- **Pronunciation Practice**: Perfect your accent with AI feedback
- **Vocabulary Building**: Learn new words in context through songs
- **Cultural Learning**: Understand idioms and expressions from native content
- **Listening Skills**: Improve comprehension through repeated exposure

### Educational Institutions
- **Language Classes**: Supplement curriculum with engaging music-based learning
- **Homework Assignments**: Students practice pronunciation with automated grading
- **Progress Monitoring**: Teachers track student improvement through detailed analytics
- **Cultural Immersion**: Explore music and culture from around the world

### Corporate Training
- **Employee Development**: Language skills training for global teams
- **Cultural Sensitivity**: Learn expressions and cultural context through music
- **Engagement**: Make language learning fun and memorable for busy professionals

## 📱 Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Blockchain**: Lens Protocol, GRC-20, Smart Contracts
- **AI Services**: fal.ai, ElevenLabs, Gemini
- **Storage**: Grove/IPFS for immutable content
- **Audio**: Demucs, FFmpeg for audio processing
- **Learning**: FSRS algorithm for spaced repetition

## 🌍 Supported Languages

- **Chinese (Simplified)**: Complete translations with word-level timing
- **Vietnamese**: High-quality translations and audio alignment  
- **Indonesian**: Full language support with cultural context
- **English**: Original lyrics with precise timing
- **More coming soon**: Spanish, French, German, Japanese, Korean

## 💡 Why This Matters

Traditional language learning is boring and ineffective. Karaoke School makes learning:
- **Fun**: Use songs you love instead of boring textbooks
- **Effective**: AI provides instant, personalized feedback
- **Cultural**: Learn expressions and context, not just words
- **Fair**: Creators get compensated for educational use of their content
- **Accessible**: Blockchain ensures global access and fair distribution

## 🚀 Getting Started

### As a Learner:
1. Visit the app and create your passkey wallet
2. Browse available songs and choose your favorites
3. Start with karaoke mode to get comfortable
4. Switch to study mode for structured learning
5. Track your progress and celebrate improvements!

### As a Developer:
1. Check out the [technical documentation](./CLAUDE.md)
2. Review the [service architecture](./AGENTS.md) 
3. Run locally with `bun run dev` in the app directory
4. Join the community and contribute improvements!

---

**Transform how the world learns languages - one song at a time! 🎵✨**

*Built with ❤️ for global language learners and content creators*

---

## 📊 Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: GRC-20 (Public Music Metadata - Like CISAC On-Chain)  │
│ Purpose: Immutable reference for music industry identifiers     │
├─────────────────────────────────────────────────────────────────┤
│ • Musical Works (ISWC when available, Spotify ID fallback)     │
│ • Artists (ISNI when available, Spotify/Genius fallback)        │
│                                                                  │
│ NOT dapp-specific! Public good infrastructure anyone can query  │
│ Cost: ~$0.20 per 1000 entities (can mint millions)              │
│ Query: The Graph GRC-20 API                                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Referenced by
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: Smart Contracts (Dapp-Specific Data)                   │
│ Purpose: Karaoke segments, translations, TikTok videos           │
├─────────────────────────────────────────────────────────────────┤
│ Contracts (Lens Chain):                                          │
│   • SegmentEvents.sol - Karaoke segments with timing            │
│   • TranslationEvents.sol - Multi-language translations         │
│   • TikTokVideoEvents.sol - Creator videos                      │
│   • PerformanceGrader.sol - User scores (via Lit Actions)       │
│                                                                  │
│ All contracts emit events, NO STORAGE (gas efficient)           │
│ Cost: ~50k gas per segment + ~10k per translation               │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Indexed by
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: Subgraph (Fast Queries)                                │
│ Purpose: Index contract events for app queries                  │
├─────────────────────────────────────────────────────────────────┤
│ Entities:                                                        │
│   • Segment (timing, instrumentalUri, alignmentUri)             │
│   • Translation (languageCode, translationUri)                  │
│   • TikTokVideo (creator PKP, Story IP Asset ID)                │
│   • Performance (user scores, leaderboard)                      │
│                                                                  │
│ Query: GraphQL endpoint (custom schema)                         │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Assets stored in
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: Grove/IPFS (Immutable Assets)                          │
│ Purpose: Decentralized storage for audio and metadata           │
├─────────────────────────────────────────────────────────────────┤
│ Asset Types:                                                     │
│   • Instrumental MP3s (fal.ai enhanced, ~190s)                  │
│   • TikTok clips (cropped 50s segments)                         │
│   • Word alignment JSON (ElevenLabs timing)                     │
│   • Translation JSON (line + word level, 3+ languages)          │
│   • Segment metadata JSON (references all above)                │
│                                                                  │
│ NEW FORMAT: Separate translation files per language             │
│ Cost: $0.01 per MB via Irys                                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Copyright tracked in
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5: Story Protocol (IP Assets & Revenue)                   │
│ Purpose: Copyright tracking and automatic revenue distribution  │
├─────────────────────────────────────────────────────────────────┤
│ IP Assets:                                                       │
│   • TikTok videos (82% original artist, 18% creator)            │
│   • References GRC-20 work entity ID in metadata                │
│   • Parent-child relationships to original works                │
│   • Automatic royalty splits on commercial use                  │
│                                                                  │
│ Status: Not yet implemented                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Core Services

### 1. Karaoke Pipeline (`karaoke-pipeline/`)
**Purpose**: Process TikTok videos into karaoke segments with multi-language translations

**12-Step Unified Pipeline**:
1. Scrape TikTok
2. Resolve Spotify
3. ISWC Discovery
4. Enrich MusicBrainz
5. Discover Lyrics
6. Download Audio
6.5. Forced Alignment
7. Genius Enrichment
7.5. Lyrics Translation
8. Audio Separation
9. AI Segment Selection
10. Audio Enhancement
11. Crop TikTok Clips
11.5. Upload TikTok Videos
12. Grove Upload + Event Emission 🆕

**Recent Additions**:
- ✅ PKP/Lens Web3 Integration
- ✅ TikTok Video Transcription
- ✅ GRC-20 Minting Pipeline
- ✅ Advanced Wikidata Integration

**Quick Commands**:
```bash
# Start pipeline
cd karaoke-pipeline
./supervisor.sh

# Run specific step
bun run unified --step=12 --limit=5

# Create PKPs for creators
bun src/processors/mint-creator-pkps.ts --limit=20

# Transcribe TikTok videos
bun src/processors/10-transcribe-tiktok-videos.ts --limit=10

# Monitor status
curl http://localhost:8787/health
```

### 2. Contracts (`contracts/`)
**Purpose**: Event-only smart contracts for blockchain-native karaoke tracking

**Deployed on Lens Testnet** (Chain ID: 37111):
- PerformanceGrader: `0x788A245B9AAB4E29D0152424b72bcB8Ac7c1E260`
- SongEvents: `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6`
- SegmentEvents: `0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8`
- AccountEvents: `0x3709f41cdc9E7852140bc23A21adCe600434d4E8`

**Events Structure** (Updated):
```solidity
// SegmentEvents.sol
event SegmentRegistered(bytes32 segmentHash, string grc20WorkId, string spotifyTrackId, string metadataUri);
event SegmentProcessed(bytes32 segmentHash, string instrumentalUri, string alignmentUri, uint8 translationCount, string metadataUri);

// TranslationEvents.sol (NOT DEPLOYED - HIGH PRIORITY)
event TranslationAdded(bytes32 segmentHash, string languageCode, string translationUri);
// Note: confidenceScore and translationSource REMOVED per recent commits
```

**Quick Commands**:
```bash
# Compile contracts
cd contracts
forge build

# Deploy missing TranslationEvents
forge script script/DeployTranslationEvents.s.sol --zk --broadcast --rpc-url https://rpc.testnet.lens.xyz

# Verify on block explorer
forge verify-contract <address> TranslationEvents --chain lens-testnet
```

### 3. App (`app/`)
**Purpose**: React/TypeScript frontend for karaoke experience

**Recent Changes** (from git commits):
- ✅ Fix audio currentTime tracking in useAudioPlayer
- ✅ Remove client-side lyrics filtering/offsetting
- ✅ Update MediaPage.tsx, useSegmentV2.ts, MediaPageContainer.tsx, SongPageContainer.tsx
- ✅ Add useSpotifyCoverImage.ts hook

**Stack**: Vite, React, TypeScript, Tailwind, shadcn/ui

**Quick Commands**:
```bash
# Start development server
cd app
bun run dev

# Build for production
bun run build

# Run Storybook
bun run storybook
```

### 4. Subgraph (`subgraph/`)
**Purpose**: Index contract events for fast GraphQL queries

**Status**: Schema updated with GRC-20 references, needs deployment to testnet

**Schema** (Updated):
```graphql
type Segment @entity {
  id: ID!
  grc20WorkId: String!              # Links to GRC-20
  spotifyTrackId: String!
  instrumentalUri: String
  alignmentUri: String              # ElevenLabs word timing
  translations: [Translation!]! @derivedFrom(field: "segment")
  translationCount: Int!
  registeredAt: BigInt!
  processedAt: BigInt
}

type Translation @entity {
  id: ID!
  segment: Segment!
  languageCode: String!             # "zh", "vi", "id"
  translationUri: String!           # Grove URI
  # Note: confidenceScore and translationSource REMOVED per recent commits
  addedAt: BigInt!
}
```

**Quick Commands**:
```bash
# Update contract addresses in subgraph.yaml
# Change network: local → network: lens-testnet
# Update TranslationEvents address after deployment

# Generate and deploy
cd subgraph
npm run codegen
npm run build
graph deploy --studio ksc-1
```

### 5. Lit Actions (`lit-actions/`)
**Purpose**: Off-chain performance grading with PKP signing

**Key Actions**:
- `karaoke-scorer-v4.js` - Pronunciation scoring (Lens Testnet)
- `karaoke-grader-v5.js` - Unified karaoke grading (NEW)
- `study-scorer-v1.js` - FSRS-4.5 spaced repetition (Base Sepolia - legacy)

**Quick Commands**:
```bash
# Upload Lit Action
node scripts/upload-lit-action.mjs

# Update PKP permissions
bun run scripts/update-pkp-permissions.ts

# Test specific action
dotenvx run -- node src/test/test-karaoke-scorer.mjs
```

### 6. Supporting Services
- **demucs-runpod**: GPU audio separation (RunPod serverless)
- **audio-download-service**: Soulseek audio retrieval
- **quansic-service**: ISWC code discovery
- **bmi-service**: Broadcast Music Inc. integration
- **ffmpeg-service**: Audio processing utilities
- **sponsorship-api**: Creator monetization

---

## 🔄 Recent Git Changes (Applied)

### Major Changes:
1. **Step 12 Integration** - Segment event emission into unified pipeline
2. **NEW Grove Metadata Format** - Separate translation files per language
3. **Removed Event Fields** - confidence_score and translation_source from TranslationAdded events
4. **App Refactoring** - Removed client-side lyrics filtering, fixed audio currentTime tracking
5. **TikTok Clip Updates** - Use TikTok clip audio and timing instead of full segment

### Impact:
- Grove upload script needs implementation
- TranslationEvents contract needs deployment with updated event structure
- Subgraph schema needs update to match new event structure
- App components updated to use new data flow

---

## 📋 Development Workflow

### 1. Process Karaoke Segments
```bash
cd karaoke-pipeline
bun run unified --step=12 --limit=5  # Grove upload + event emission
```

### 2. Deploy Missing TranslationEvents Contract
```bash
cd contracts
forge script script/DeployTranslationEvents.s.sol \
  --zk \
  --rpc-url https://rpc.testnet.lens.xyz \
  --broadcast
```

### 3. Update & Deploy Subgraph
```bash
cd subgraph
# Update subgraph.yaml with new contract addresses
npm run codegen
npm run build
graph deploy --studio ksc-1
```

### 4. Update App Configuration
```bash
cd app
# Update subgraph URL in src/lib/graphql/client.ts
bun run dev
```

---

## 🎯 Priority Next Actions

### 🔴 HIGH PRIORITY
1. **Deploy TranslationEvents Contract**
   - Deploy to Lens Testnet
   - Update subgraph.yaml address
   - Event structure: `TranslationAdded(bytes32 segmentHash, string languageCode, string translationUri)`

2. **Create Grove Upload + Event Emission Script**
   - Location: `karaoke-pipeline/scripts/emit-segment-events.ts`
   - Connect database → contracts → subgraph → app flow
   - Implement NEW Grove metadata format with separate translation files

### 🟡 MEDIUM PRIORITY
3. **Deploy Subgraph to Testnet**
   - Update network: local → lens-testnet
   - Update all contract addresses
   - Deploy and update app with new URL

4. **Create PKPs for TikTok Creators**
   - Run: `bun src/processors/mint-creator-pkps.ts --limit=51`
   - Create Lens accounts for creators
   - Store in database for Story Protocol integration

### 🟢 LOW PRIORITY
5. **Implement Story Protocol IP Assets**
   - Register 5,653 copyrighted TikTok videos
   - Set 82/18 revenue split
   - Link to GRC-20 work IDs

6. **Complete Remaining ISWCs**
   - 3 works missing ISWCs
   - Wait for BMI/MLC services, then backfill

---

## 🛠️ Quick Reference Commands

### Pipeline
```bash
cd karaoke-pipeline
./supervisor.sh                          # Start all services
bun run unified --step=12 --limit=5      # Grove upload + events
bun src/processors/mint-creator-pkps.ts --limit=20  # Create PKPs
```

### Contracts
```bash
cd contracts
forge build                              # Compile
forge script script/DeployEvents.s.sol --rpc-url lens-testnet --broadcast  # Deploy
forge verify-contract <address> SegmentEvents --chain lens-testnet  # Verify
```

### Subgraph
```bash
cd subgraph
npm run codegen                          # Generate types
npm run build                            # Compile
graph deploy --studio ksc-1              # Deploy
```

### App
```bash
cd app
bun run dev                              # Development
bun run build                            # Production build
bun run storybook                        # Component docs
```

### Database (Neon)
```bash
# Check pipeline status
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) 
  FROM song_pipeline 
  GROUP BY status 
  ORDER BY COUNT(*) DESC;
"

# Check segments ready for Grove upload
psql $DATABASE_URL -c "
  SELECT ks.spotify_track_id, gw.title, gw.artist_name
  FROM karaoke_segments ks
  JOIN grc20_works gw ON gw.spotify_track_id = ks.spotify_track_id
  WHERE ks.fal_segment_grove_url IS NOT NULL
  LIMIT 5;
"
```

---

## 🔐 Environment Configuration

### Required Environment Variables
```bash
# Neon Database
NEON_DATABASE_URL=postgresql://...

# Lens Protocol
VITE_LENS_ENVIRONMENT=testnet
VITE_LENS_APP_ADDRESS=0x...

# Lit Protocol
VITE_PKP_WALLET=0x...

# Grove Storage
GROVE_API_KEY=...

# Development
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.1
```

### Security Guidelines
- Always use `dotenvx run -f .env -- [command]`
- Never prefix or export `DOTENV_PRIVATE_KEY` inline
- Assume `DOTENV_PRIVATE_KEY` is in `.claude/settings.local.json`

---

## 🚨 Critical Missing Pieces

### 1. Grove Upload + Event Emission Script (BLOCKER)
**Status**: Not implemented
**Impact**: Cannot connect database to blockchain
**Location**: `karaoke-pipeline/scripts/emit-segment-events.ts`
**Timeline**: 2-3 hours to implement

### 2. TranslationEvents Deployment (HIGH PRIORITY)
**Status**: Placeholder address in subgraph
**Impact**: Translation events not being indexed
**Timeline**: 30 minutes to deploy

### 3. Subgraph Testnet Deployment (MEDIUM PRIORITY)
**Status**: Local only
**Impact**: App cannot query deployed data
**Timeline**: 1 hour to update and deploy

---

## 📊 Current Metrics

### GRC-20 Layer
- ✅ Artists: 52/52 (100%)
- ✅ Works: 36/39 (92.3%)
- ✅ Recordings: 39/39 (100%)

### Database
- ✅ Segments: 36 with fal-enhanced audio
- ✅ Translations: 3+ languages per track
- ✅ TikTok Videos: 8,196 scraped (5,653 copyrighted)

### Blockchain
- ✅ Contracts: 4/5 deployed on Lens Testnet
- ⏳ TranslationEvents: Not deployed
- ⏳ Subgraph: Not deployed to testnet

---

## 📚 Documentation Sources

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive technical architecture (outdated - needs update)
- **[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)** - Current system state (most accurate)
- **[karaoke-pipeline/AGENTS.md](karaoke-pipeline/AGENTS.md)** - Pipeline documentation
- **[app/README.md](app/README.md)** - Frontend application guide
- **[contracts/AGENTS.md](contracts/AGENTS.md)** - Smart contracts guide (outdated - mentions ZKSync instead of Lens)
- **[lit-actions/AGENTS.md](lit-actions/AGENTS.md)** - Lit Actions documentation
- **[subgraph/AGENTS.md](subgraph/AGENTS.md)** - Subgraph documentation

---

## ✅ Verification Checklist

### Before Proceeding:
- [ ] TranslationEvents contract deployed to Lens Testnet
- [ ] Grove upload script implemented and tested
- [ ] Subgraph updated with new event structure
- [ ] App configured with correct subgraph URL
- [ ] Database queries confirmed working

### Success Criteria:
- [ ] All 36 segments emitted on-chain
- [ ] Subgraph indexing contract events
- [ ] App displaying karaoke data via GraphQL
- [ ] End-to-end flow operational

---

**This document consolidates current, accurate information from all service documentation. Keep updated as architecture evolves.**
