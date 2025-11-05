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
├── run-pipeline.ts          # Main pipeline orchestrator
├── src/
│   ├── processors/           # 19 pipeline steps + Web3 processors  
│   ├── db/                   # Database connections
│   └── services/             # External API integrations
├── scripts/                  # Organized utility scripts

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
- **[AGENTS.md](AGENTS.md)** - Complete developer guide with all features
- **[scripts/README.md](scripts/README.md)** - Operational scripts and monitoring

**Quick help:**
- Status issues: Check `bun scripts:status`
- Step failures: Run single step with `--limit=1`
- Service health: `curl http://localhost:8787/health`
