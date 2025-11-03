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
IRYS_PRIVATE_KEY=...
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
