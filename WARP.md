# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Karaoke School** is a Web3 karaoke learning platform that processes TikTok videos into high-quality karaoke segments with word-level alignment for language learning. The platform uses:

- **Lens Protocol** for social features and content distribution
- **Lit Protocol (PKP)** for account abstraction and off-chain compute
- **Grove/Irys** for decentralized storage
- **Neon PostgreSQL** for metadata and enrichment
- **The Graph (GRC-20)** for blockchain knowledge graph

## Architecture

The repository is organized as a **monorepo** with multiple independent services:

### Frontend Apps
- **`app/`** - Main React app (Vite + React 19 + Lens SDK + Lit Protocol)
- **`archived/reference-app/`** - Previous version with different features (archived)

### Backend Services (Bun/TypeScript)
- **`cloudflare-worker-scraper/`** - TikTok scraper + music metadata enrichment API (Cloudflare Workers + Hono)
- **`neon-pipeline/`** - Catalog-first karaoke song database builder (Neon DB + Karafun CSV)
- **`grc20-integration/`** - GRC-20 knowledge graph minting (blockchain artist/work entities)
- **`lit-actions/`** - Serverless Lit Protocol actions for audio processing, scoring, translations
- **`sponsorship-api/`** - Lens transaction sponsorship API with quota management

### Microservices (Docker + Akash)
- **`cisac-service/`** - CISAC ISWC scraper (Playwright + 2captcha, ~$0.002/hour)
- **`bmi-service/`** - BMI Songview scraper (Playwright)
- **`quansic-service/`** - Quansic music metadata enrichment (Playwright auth)
- **`ffmpeg-service/`** - Audio cropping service (ffmpeg + Hono)
- **`demucs-modal/`** - Audio source separation (Demucs, Modal.com)
- **`demucs-local/`** - Local Demucs service

### Smart Contracts
- **`contracts/`** - Lens Chain event contracts (Foundry + ZKsync)
- **`subgraph/`** - The Graph subgraph for indexing events

### Archived/Experimental
- **`archived/`** - Previous iterations and experimental code

## Environment Management

**CRITICAL**: This project uses `@dotenvx/dotenvx` for encrypted environment variables.

### Rules
- **ALWAYS** use `dotenvx run -f .env -- [command]` for running scripts
- **NEVER** prefix commands with `export DOTENV_PRIVATE_KEY=...`
- **NEVER** inline secrets in commands
- Assume `DOTENV_PRIVATE_KEY` is already set in `.claude/settings.local.json`

### Examples
```bash
# ✅ Good
dotenvx run -f .env -- bun src/import/01-import-karafun.ts

# ❌ Bad
export DOTENV_PRIVATE_KEY='...' && dotenvx run -f .env -- bun ...
cd some-dir && export API_KEY='...' && bun script.ts
```

## Common Commands

### Frontend Development (`app/`)
```bash
cd app
bun install
bun run dev              # Start Vite dev server (http://localhost:5173)
bun run build            # Build for production
bun run lint             # Run ESLint
bun run storybook        # Start Storybook (component library)
bun run build-storybook  # Build Storybook static site
```

### Cloudflare Worker (`cloudflare-worker-scraper/`)
```bash
cd cloudflare-worker-scraper
bun install
bun run dev              # Start local Wrangler dev server
bun run deploy           # Deploy to Cloudflare Workers
bun run tail             # Stream live logs
```

### Neon Pipeline (`neon-pipeline/`)
```bash
cd neon-pipeline
bun install
bun run import:karafun   # Import Karafun catalog to Neon DB
bun run match:local      # Match catalog to local audio files
bun run enrich:metadata  # Enrich with Genius/MusicBrainz/MLC
```

### GRC-20 Integration (`grc20-integration/`)
```bash
cd grc20-integration
bun install

# Setup and import (uses dotenvx automatically)
bun run setup            # Create GRC-20 space
bun run define-types     # Define entity types
bun run corroborate      # Run data corroboration ETL
bun run enrich-mb 100    # Enrich 100 artists with MusicBrainz
bun run import-artists   # Mint artists to GRC-20
bun run import-works     # Mint works to GRC-20
bun run query-test       # Test GraphQL queries
```

### Lit Actions (`lit-actions/`)
```bash
cd lit-actions
npm install

# Test actions (uses dotenvx automatically via package.json scripts)
npm run test:audio-processor-v4
npm run test:match-segment-v6
npm run test:auto-purchase
npm run test:scorer-v4

# Manage PKPs
npm run mint-pkp
npm run update-pkp-permissions

# Deploy actions
npm run upload-action
npm run encrypt-keys
```

### Smart Contracts (`contracts/`)
```bash
cd contracts
source .env

# Compile with ZKsync support
forge build --zksync

# Deploy to Lens Chain testnet
forge script script/DeployEvents.s.sol:DeployEvents \
  --rpc-url lens-testnet \
  --broadcast \
  --zksync \
  -vvvv

# Run tests
forge test --zksync
```

### Subgraph (`subgraph/`)
```bash
cd subgraph
bun install
bun run codegen         # Generate types from schema
bun run build           # Build subgraph
bun run auth            # Authenticate with The Graph Studio
bun run deploy          # Deploy to The Graph Studio
```

### Docker Microservices
All services follow the same pattern:
```bash
cd [service-name]
bun install

# Local development
bun run dev

# Docker build and push
docker build -t t3333chn0000/[service-name]:v1.0.0 .
docker push t3333chn0000/[service-name]:v1.0.0

# Deploy to Akash (see each service's README.md)
akash tx deployment create deploy-akash.yaml --from mykey
```

## Data Flow Overview

### Complete Pipeline: TikTok → Karaoke App

1. **TikTok Scraping** (`cloudflare-worker-scraper/`)
   - Scrape videos with copyright detection
   - Extract Spotify Track IDs

2. **Metadata Enrichment** (automatic cascade)
   - Spotify Tracks → Spotify Artists → Genius Songs
   - MusicBrainz Artists (ISNI) → Recordings (ISRC) → Works (ISWC)
   - Quansic enrichment (IPN, Luminate, platform IDs)
   - CISAC ISWC verification (authoritative)
   - MLC licensing data

3. **Audio Processing** (`lit-actions/`)
   - Download audio (freyr-service)
   - Demucs source separation (vocals + instrumental)
   - Gemini segmentation (~190s karaoke clip)
   - fal.ai enhancement (high-quality instrumental)
   - FFmpeg cropping (50s TikTok clip)
   - ElevenLabs word-level alignment

4. **Storage & Minting**
   - Upload to Grove/Irys (get CIDs)
   - Store metadata in Neon DB
   - Mint to GRC-20 knowledge graph

5. **App Frontend** (`app/`)
   - Query GRC-20 via GraphQL
   - Fetch Grove assets
   - Display karaoke UI with word timing
   - Record user performance

6. **Performance Grading** (`lit-actions/`)
   - Submit to Lit Action (off-chain)
   - Grade pronunciation/timing
   - Post score on-chain (PerformanceGrader contract)
   - Create Performance entity in GRC-20

## Testing

### Run Tests by Service

```bash
# Frontend (app/)
cd app
# No test command configured yet

# Cloudflare Worker
cd cloudflare-worker-scraper
bun run test

# Lit Actions - Multiple test suites
cd lit-actions
npm run test:audio-processor-v4
npm run test:match-segment-v6
npm run test:scorer-v4

# Contracts
cd contracts
forge test --zksync
```

## Key Technical Patterns

### Data Corroboration
Multiple data sources are merged into "golden records" with consensus tracking:
- Artists: Genius + Spotify + MusicBrainz → `grc20_artists`
- Works: MusicBrainz + Quansic + MLC → `grc20_works`
- Quality gates determine when records are "ready to mint"

### JSONB-First Database Design
All tables store complete API responses in `raw_data` JSONB column, with indexed extracted columns for queries. Never loses data.

### Rate Limiting
- MusicBrainz: 1 req/sec
- Genius: 100ms delay
- Quansic: 200ms delay
- Spotify: Batch requests (50 max)

### Session Management
- Quansic: Persistent browser cookies (~1 hour sessions)
- CISAC: JWT token caching (~59 minutes, saves 75% captcha costs)

### ISWC Discovery Strategy
1. **MusicBrainz** - First attempt (36% coverage, free)
2. **Quansic ISRC lookup** - PRIMARY (95% coverage via recording → work)
3. **CISAC** - Verification only (authoritative, costs $0.002/hour)

## Important Files

- **`CLAUDE.md`** - Environment and security rules (READ FIRST)
- **`DEMUCS_SETUP.md`** - Audio separation setup guide
- **`grc20-integration/README.md`** - Data pipeline and minting guide
- **`cloudflare-worker-scraper/README.md`** - API endpoints and enrichment cascade
- **`lit-actions/WORKFLOW.md`** - Lit Protocol action deployment workflow

## Known Issues

### ISNI Mismatches
Artists can have multiple ISNIs. MusicBrainz and Quansic may store different ones, causing 404s on enrichment. Fallback lookups implemented but only ~60% success rate.

### Spotify Track Matching
11 artists (5%) missing Spotify IDs due to:
- Language suffixes in names
- Unicode whitespace characters
- Country codes in parentheses

### MusicBrainz ISWC Coverage
Only 36% of works have ISWCs. Use Quansic ISRC → ISWC lookup as PRIMARY source (95% coverage).

## Git Workflow

- Only commit when hitting a working milestone with tested code
- Don't add or commit untested code
- Use descriptive commit messages

## Security Notes

- Never log, read, or expose sensitive data (keys, passwords)
- Use environment variables from settings for secrets
- Don't hardcode or inline secrets in commands
- API keys rotated regularly across services

## Package Managers

- **Frontend (`app/`)**: Bun (preferred) or npm
- **Backend services**: Bun
- **Lit Actions**: npm (for compatibility)
- **Contracts**: Foundry (Forge)

## Deployment Platforms

- **Frontend**: Vercel/Netlify (static builds)
- **Cloudflare Worker**: Cloudflare Workers
- **Microservices**: Akash Network (~$2-4/month per service)
- **Database**: Neon PostgreSQL (serverless)
- **Storage**: Grove/Irys (IPFS)
- **Compute**: Modal.com (Demucs), Lit Protocol (scoring)
