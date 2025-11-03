# Karaoke School v1 - Project Overview

## Core Services

This monorepo contains multiple interconnected services for AI-powered language learning through music:

### 1. **Karaoke Pipeline** (`karaoke-pipeline/`)
- **Purpose**: Process TikTok videos into karaoke segments with multi-language translations
- **Status**: Fully operational with 10-step unified pipeline (steps 2-10)
- **Key Features**: Spotify resolution, ISWC discovery, AI segmentation, audio enhancement
- **Entry**: `bun run pipeline:all`

### 2. **Contracts** (`contracts/`)
- **Purpose**: Event-only smart contracts for blockchain-native karaoke tracking
- **Network**: ZKSync Era (Lens Chain)
- **Key**: No storage, pure events for gas efficiency
- **Entry**: `forge build && forge script script/DeployEvents.s.sol`

### 3. **App** (`app/`)
- **Purpose**: React/TypeScript frontend for karaoke experience
- **Stack**: Vite, React, Tailwind, shadcn/ui
- **Key Features**: Audio player, lyrics display, performance tracking
- **Entry**: `bun run dev`

### 4. **Subgraph** (`subgraph/`)
- **Purpose**: Index contract events for fast GraphQL queries
- **Framework**: The Graph protocol
- **Entities**: Segments, translations, TikTok videos, performances
- **Entry**: `npm run build && graph deploy`

### 5. **Services**
- **audio-download-service**: Soulseek audio retrieval
- **quansic-service**: ISWC code discovery
- **bmi-service**: Broadcast Music Inc. integration
- **lit-actions**: Off-chain performance grading
- **demucs-modal**: Audio separation (vocal/instrumental)
- **ffmpeg-service**: Audio processing utilities
- **sponsorship-api**: Creator monetization

## Architecture Layers

```
┌─────────────────────────────────────┐
│ LAYER 1: GRC-20 (Public Metadata)   │  ← Industry identifiers
├─────────────────────────────────────┤
│ LAYER 2: Smart Contracts (Events)   │  ← Karaoke data
├─────────────────────────────────────┤
│ LAYER 3: Subgraph (Indexing)        │  ← Fast queries
├─────────────────────────────────────┤
│ LAYER 4: Grove/IPFS (Storage)       │  ← Audio & metadata
├─────────────────────────────────────┤
│ LAYER 5: Story Protocol (Copyright) │  ← Revenue splits
└─────────────────────────────────────┘
```

## Development Workflow

```bash
# 1. Process karaoke segments
cd karaoke-pipeline && bun run pipeline:all

# 2. Deploy/update contracts
cd contracts && forge build && forge script script/DeployEvents.s.sol --zk --broadcast

# 3. Update subgraph
cd subgraph && npm run codegen && npm run build && graph deploy

# 4. Run app locally
cd app && bun run dev
```

## Key Integration Points

**TikTok → Blockchain Flow**:
1. TikTok videos scraped from creators
2. Audio processed through 10-step pipeline
3. Metadata uploaded to Grove/IPFS
4. Contract events emitted (no storage)
5. Subgraph indexes for fast queries
6. Story Protocol tracks copyright splits

**Database**: Neon PostgreSQL (`frosty-smoke-70266868`)
**Pipeline Table**: `song_pipeline`

## Current Status (2025-10-30)

- ✅ 36 segments fully processed (fal-enhanced audio)
- ✅ 106 artists minted to GRC-20
- ✅ 63 works minted to GRC-20
- ✅ 8,196 TikTok videos scraped (5,653 copyrighted)
- ✅ Multi-language translations (zh, vi, id)
- ⏳ Story Protocol IP Asset registration
- ⏳ Subgraph deployment
- ⏳ App integration

## Quick Reference

| Service | Local | Production | Command | Status |
|---------|-------|------------|---------|--------|
| karaoke-pipeline | - | - | `bun run pipeline:all` | ✅ Active |
| contracts | - | - | `forge build` | ✅ Active |
| app | :5173 | - | `bun run dev` | ✅ Active |
| subgraph | :8000 | - | `npm run build` | ⚠️ Setup |
| audio-download | :3001 | [Akash](https://ks0q2dcfot8rd3vje7s8nds5ok.ingress.europlots.com) | `bun start` | ✅ Active |
| quansic-service | :3001 | - | `node server.js` | ✅ Active |

## Documentation

Each service has detailed `AGENTS.md` documentation. The root `CLAUDE.md` contains complete technical architecture. Use `@AGENTS.md` in `CLAUDE.md` files to reference service-specific documentation.
