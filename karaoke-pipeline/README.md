# Karaoke Pipeline

**Complete 19-step unified pipeline to process TikTok videos into karaoke-ready segments with multi-language translations, Web3 identity, and GRC-20 minting**

**🚀 Current Status**: Production-ready with robust local architecture, Web3 integration, and comprehensive metadata enrichment.

---

## Quick Start

### Option 1: Robust Local System (Recommended)
```bash
# 1. Start supervised services
./supervisor.sh

# 2. Run pipeline via API
curl -X POST "http://localhost:8787/trigger?step=6&limit=20"

# 3. Check health
curl http://localhost:8787/health
```

### Option 2: Direct Bun Runner
```bash
# 1. Scrape fresh content
bun run scrape @charleenweii 20

# 2. Run full pipeline
bun run unified:all

# 3. Check results
bun scripts:status
```

---

## Core Features

### **🎵 Pipeline Processing**
- **19-step orchestrator** from TikTok scrape to GRC-20 minting
- **Robust supervision** with auto-restart and health monitoring
- **Multiple service architecture** with HTTP API endpoints

### **🌐 Web3 Integration**
- **PKP/Lens accounts** for artists and creators
- **GRC-20 mint-ready data** with industry-standard metadata
- **Immutable Web3 identity** via Lens Protocol

### **📊 Advanced Metadata**
- ** Wikidata integration** (40+ library identifiers)
- **MusicBrainz relationships** (groups ↔ members tracking)
- **Multi-source enrichment** (ISNI, ISRC, ISWC)

### **🎙️ AI Processing**
- **Full-song audio enhancement** with 190s chunking & 2s crossfade
- **AI-powered viral clip selection** (30-60s verse+chorus via Claude)
- **TikTok transcription** (creator speech, separate from lyrics)
- **Multi-language translation** with word-level timing
- **Vector similarity** for context matching

---

## Status Flow

```
tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched → 
lyrics_ready → audio_downloaded → alignment_complete → translations_ready → 
stems_separated → segments_selected → enhanced → clips_cropped → images_generated
```

---

## Full-Song Enhancement Workflow

### Step 10: fal.ai Chunking & Enhancement
**Processes ENTIRE songs** (not just 190s segments):
1. Splits songs into 190s chunks with 2s overlap
2. Submits all chunks to fal.ai in parallel ($0.20/chunk)
3. Downloads enhanced chunks from fal.ai
4. Merges with FFmpeg crossfade for seamless transitions
5. Uploads merged full-song instrumental to Grove
6. Stores chunk metadata in `karaoke_segments.fal_chunks` (JSONB)

**Example**: 200s song → 2 chunks (0-190s, 188-200.4s) → $0.40 total

### Step 11: AI Viral Clip Selection
**Uses Claude 3.5 Sonnet to select optimal clips**:
1. Loads all karaoke lines with timestamps
2. AI analyzes song structure to find best verse+chorus
3. Ensures 30-60s duration (ideally 40-50s)
4. Crops selected segment from merged instrumental
5. Uploads viral clip to Grove
6. Updates `karaoke_segments` with clip metadata

**Example**: Ocean Eyes → Selected 49.2s-91.9s (42.7s verse+chorus)

---

## Key Scripts

```bash
# Pipeline Operations
bun unified:all                    # Run complete pipeline
bun scripts:status                 # Check pipeline health
bun scripts:flagged                # Find tracks needing review

# GRC-20 & Web3
bun scripts:migration:populate-grc20-artists  # Populate metadata
bun src/processors/mint-artist-pkps.ts         # Mint PKPs
bun src/processors/create-artist-lens.ts       # Create Lens accounts

# Advanced Features
bun src/processors/10-transcribe-tiktok-videos.ts  # Transcribe creator speech
bun src/processors/05-enrich-wikidata.ts            # Wikidata enrichment
```

## 🛠️ Operational Scripts

### 📊 Monitoring Scripts
**Status Checking & Health Monitoring:**
```bash
# Real-time pipeline status dashboard
bun scripts:status

# Find tracks needing manual review
bun scripts:flagged

# Direct monitoring script
bun scripts/monitoring/check-pipeline-status.ts
bun scripts/monitoring/find-flagged.ts
```

### 🔄 Migration Scripts
**Database Schema & Data Management:**
```bash
# Apply karaoke segments migration
bun scripts:migration:karaoke-segments

# Clean up language data structures
bun scripts:migration:language-data

# Update track images from Spotify
bun scripts:migration:update-images
```

### 🎵 Processing Scripts
**Core Pipeline Operations:**
```bash
# Process audio separations (Demucs)
bun scripts:processing:separations

# Run unified pipeline orchestrator
bun scripts:processing:orchestrator

# Direct processing
bun scripts/processing/process-all-separations.ts
bun scripts/processing/run-orchestrator.ts
```

### 📝 Backfill Scripts
**Data Enrichment Operations:**
```bash
# Backfill Genius annotations
bun scripts:backfill

# Direct backfill
bun scripts/backfill/backfill-genius-data.ts
```

## 🚀 Common Operations

### Quick Start Commands
```bash
# 1. Set up environment
dotenvx run -f .env -- <command>

# 2. Check pipeline health
bun scripts:status

# 3. Process pending separations
bun scripts:processing:separations

# 4. Run full pipeline orchestrator
bun scripts:processing:orchestrator

# 5. Backfill any missing data
bun scripts:backfill
```

### Specific Pipeline Steps
```bash
# Run specific step via orchestrator
bun scripts:processing:orchestrator --step=8
bun scripts:processing:orchestrator --step=2 --limit=10

# Or via unified runner
bun run unified --step=3 --limit=1
```

### Health Check Commands
```bash
# Test database connection
bun test:status

# Test service connectivity
bun test:demucs     # Demucs service
bun test:genius     # Genius API validation

# Check for stuck tracks
SELECT id, title, artist_name, status, updated_at
FROM song_pipeline 
WHERE status IN ('spotify_resolved', 'iswc_found', 'metadata_enriched')
AND updated_at < NOW() - INTERVAL '1 hour';
```

## Development

**Project Structure:**
```
karaoke-pipeline/
├── run-unified.ts           # Main pipeline orchestrator
├── standalone-server.ts     # HTTP API server (port 8787)
├── supervisor.sh            # Process supervisor for local services
├── src/
│   ├── processors/           # 26 pipeline steps + orchestrator
│   ├── services/             # API integrations (21 services)
│   ├── db/                   # Database modules (10 files)
│   ├── schemas/              # GRC-20 & Story Protocol schemas
│   └── utils/                # Utilities (status reconciliation)
├── scripts/                  # Organized by category
│   ├── backfill/             # Data backfill operations
│   ├── migration/            # Database migrations & population
│   ├── monitoring/           # Status and health checks
│   ├── processing/           # Core pipeline operations
│   ├── validation/           # Data validation
│   └── contracts/            # Contract deployment
├── grc20-v2/                 # Standalone GRC-20 minting system
└── schema/migrations/        # SQL migration files
```

**External Services** (Akash-hosted, managed in project root):
```
../bmi-service/              # ISWC lookup fallback #2
../mlc-service/              # ISWC lookup fallback #1
../ffmpeg-service/           # Audio processing endpoints
../audio-download-service/   # yt-dlp + Soulseek download
../quansic-service/          # ISWC discovery service
```

**Environment Variables (.env):**
```bash
# Database
NEON_DATABASE_URL=postgresql://...

# APIs  
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
GENIUS_API_KEY=...

# Storage
GROVE_TOKEN=...
```

---

## Support & Documentation

**For complete developer guide:**
- **[AGENTS.md](AGENTS.md)** - Complete developer guide with architecture & all features
- **[CLAUDE.md](CLAUDE.md)** - Claude Code configuration & pre-approved commands
- **[scripts/migration/README-POPULATION.md](scripts/migration/README-POPULATION.md)** - GRC-20 population guide
- **[scripts/contracts/README.md](scripts/contracts/README.md)** - Contract deployment guide

**Quick help:**
- Status issues: Check `bun scripts:status`
- Step failures: Run single step with `--limit=1`
- Service health: `curl http://localhost:8787/health`
