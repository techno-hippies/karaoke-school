# Karaoke Pipeline - Complete Developer Guide

## 🚀 Robust Local Architecture (V2.0)

The pipeline features a robust local-first architecture with process supervision, health monitoring, and auto-restart capabilities.

### **Recent Major Additions:**
- ✅ **PKP/Lens Web3 Integration** - Programmable Key Pairs and Lens Protocol accounts
- ✅ **TikTok Video Transcription** - Creator speech transcription and translation
- ✅ **GRC-20 Minting Pipeline** - Industry-standard music metadata with mint-ready data
- ✅ **Advanced Wikidata Integration** - 40+ library identifiers and international metadata
- ✅ **Process Supervision** - Auto-restart on failure, health monitoring

### **Quick Start:**

```bash
# 1. Start all services with supervision
cd /media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline
./supervisor.sh

# 2. Run pipeline via HTTP API (stable, reliable)
curl -X POST "http://localhost:8787/trigger?step=6&limit=20"  # Audio download
curl -X POST "http://localhost:8787/trigger?step=8&limit=10"  # Demucs separation
curl -X POST "http://localhost:8787/trigger?step=10&limit=5"  # TikTok transcription

# 3. Check system health
curl http://localhost:8787/health
./supervisor.sh --status
```

### **Service Architecture:**
```
┌─────────────────────────────────────┐
│ Standalone Pipeline Server          │
│ • Port 8787 (Worker-compatible)     │
│ • All pipeline steps as HTTP API    │
│ • Webhooks, triggers, health checks │
└─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────┐
│ Audio Download Service              │
│ • Port 3001                         │
│ • yt-dlp + Soulseek P2P strategies  │
│ • Fire-and-forget processing        │
└─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────┐
│ Demucs GPU Service                  │
│ • Port 8001                         │
│ • Vocal/instrumental separation     │
│ • Callback to pipeline when done    │
└─────────────────────────────────────┘
```

## 🆕 Web3 & Metadata Features

### **PKP/Lens Web3 Identity**

**Lit Protocol PKPs** enable Web3 identity for artists and creators:
```bash
# Mint PKPs for artists without Web3 identity
bun src/processors/mint-artist-pkps.ts --limit=20

# Create Lens accounts for artists with PKPs  
bun src/processors/create-artist-lens.ts --limit=20

# Mint PKPs for TikTok creators
bun src/processors/mint-creator-pkps.ts --limit=20

# Create Lens accounts for creators
bun src/processors/create-creator-lens.ts --limit=20
```

**Benefits:**
- **Immutable identity** via Lens handle (can't be changed by Spotify)
- **Cross-platform presence** (same identity across all Web3 apps)
- **Revenue splits** via Story Protocol (18% for derivative works)
- **Minimal metadata** (85% smaller using GRC-20 as source of truth)

### **TikTok Video Transcription**

New transcription pipeline captures creator speech (not song lyrics):
```bash
# Process 10 TikTok videos for transcription + translation
bun src/processors/10-transcribe-tiktok-videos.ts --limit=10
```

**Features:**
- **Voxtral (Mistral STT)** for transcription
- **Gemini Flash 2.5-lite** for multi-language translation
- **Embedding generation** for future lrclib vector similarity search
- **Separate from lyrics** - captures what creators say, not sing

### **GRC-20 Integration**

Industry-standard music metadata with mint-ready pipelines:
- **ISNI coverage**: 88% of artists processed
- **Complete relationships**: Groups ↔ members tracking
- **Multiple sources**: MusicBrainz, Spotify, Genius, Quansic
- **Dependency-ordered minting**: Single-pass algorithm for relationships

```bash
# Populate GRC-20 artists from multiple sources
bun scripts/migration:populate-grc20-artists

# Validate mint readiness
bun scripts/migration:validate-grc20-mint-readiness
```

## Development Workflow

## Complete Pipeline Steps

| Step | Name | Status Transition | Processor | New |
|------|------|-------------------|-----------|-----|
| 1 | Scrape TikTok | `n/a → tiktok_scraped` | `01-scrape-tiktok.ts` | |
| 2 | Resolve Spotify | `tiktok_scraped → spotify_resolved` | `02-resolve-spotify.ts` | |
| 3 | ISWC Discovery | `spotify_resolved → iswc_found` | `03-resolve-iswc.ts` | |
| 4 | Enrich MusicBrainz | `iswc_found → metadata_enriched` | `04-enrich-musicbrainz.ts` | |
| 5 | Discover Lyrics | `metadata_enriched → lyrics_ready` | `05-discover-lyrics.ts` | |
| 6 | Download Audio | `lyrics_ready → audio_downloaded` | `06-download-audio.ts` | |
| 6.5 | Forced Alignment | `audio_downloaded → alignment_complete` | `06-forced-alignment.ts` | |
| 7 | Genius Enrichment | `lyrics_ready+ → lyrics_ready` | `07-genius-enrichment.ts` | |
| 7.5 | Lyrics Translation | `alignment_complete → translations_ready` | `07-translate-lyrics.ts` | |
| 8 | Audio Separation | `translations_ready → stems_separated` | `08-separate-audio.ts` | 🆕 |
| 9 | AI Segment Selection | `stems_separated → segments_selected` | `09-select-segments.ts` | |
| 10 | Audio Enhancement | `segments_selected → enhanced` | `10-enhance-audio.ts` | |
| 11 | Crop TikTok Clips | `enhanced → clips_cropped` | `11-crop-clips.ts` | |
| 11.5 | Upload TikTok Videos | `clips_cropped → clips_cropped` | `11-upload-grove-videos.ts` | |

### **🆕 New Processors (Web3 & Advanced):**

| Processor | Purpose | Usage |
|-----------|---------|-------|
| `mint-artist-pkps.ts` | Mint PKPs for artists | `bun src/processors/mint-artist-pkps.ts --limit=20` |
| `mint-creator-pkps.ts` | Mint PKPs for TikTok creators | `bun src/processors/mint-creator-pkps.ts --limit=20` |
| `create-artist-lens.ts` | Create Lens accounts for artists | `bun src/processors/create-artist-lens.ts --limit=20` |
| `create-creator-lens.ts` | Create Lens accounts for creators | `bun src/processors/create-creator-lens.ts --limit=20` |
| `10-transcribe-tiktok-videos.ts` | Creator speech transcription | `bun src/processors/10-transcribe-tiktok-videos.ts --limit=10` |
| `05-enrich-wikidata.ts` | Wikidata artist enrichment | ` bun src/processors/05-enrich-wikidata.ts --limit=20` |
| `05b-enrich-wikidata-works.ts` | Wikidata works enrichment | `bun src/processors/05b-enrich-wikidata-works.ts --limit=20` |
| `05c-enrich-wikidata-work-contributors.ts` | Work contributors | `bun src/processors/05c-enrich-wikidata-work-contributors.ts --limit=20` |
| `08-enrich-quansic-artists.ts` | Quansic artist data enrichment | `bun src/processors/08-enrich-quansic-artists.ts --limit=20` |
| `11-upload-grove-videos.ts` | Upload TikTok videos to Grove | `bun src/processors/11-upload-grove-videos.ts --limit=20` |

**Run Complete Flow**:
```bash
# 1. Scrape fresh content
bun run scrape @gioscottii 10

# 2. Run full unified pipeline
bun run unified:all

# 3. Check results
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const result = await query('SELECT status, COUNT(*) FROM song_pipeline GROUP BY status');
  console.table(result);
"

# 4. Run Web3 processes
bun src/processors/mint-artist-pkps.ts --limit=20
bun src/processors/create-artist-lens.ts --limit=20
bun src/processors/10-transcribe-tiktok-videos.ts --limit=10
```

**Debug Specific Step**:
```bash
# Test ISWC discovery on 1 track
bun run unified --step=3 --limit=1

# Check logs in real-time  
tail -f /tmp/pipeline-*.log

# Test new processors
bun src/processors/05-enrich-wikidata.ts --limit=1
bun src/processors/10-transcribe-tiktok-videos.ts --limit=1
```

## Error Handling

**Common Issues**:

**Duplicate Key Errors**:
```bash
# Track already processed - safe to ignore
# Run with fresh content or different step
bun run pipeline --step=3 --limit=1  # Try different step
```

**API Rate Limits**:
```bash
# Built-in delays and error handling
# Check log files for specific API errors
grep -i "error\|failed" /tmp/pipeline-*.log
```

**Missing Environment Variables**:
```bash
# Verify .env file exists and has all required keys
cat .env | grep -E "(SPOTIFY|QUANSIC|GROVE|NEON)"
```

**Pipeline Stuck in Status**:
```sql
-- Check for tracks stuck in intermediate status
SELECT id, title, artist_name, status, updated_at
FROM song_pipeline 
WHERE status IN ('spotify_resolved', 'iswc_found', 'metadata_enriched', 'lyrics_ready')
AND updated_at < NOW() - INTERVAL '1 hour';
```

## Performance Optimization

**Batch Processing**:
```bash
# Process larger batches for efficiency
bun run unified --step=3 --limit=100    # ISWC discovery
bun run unified --step=6 --limit=20     # Audio download (slower)
bun run unified --step=11 --limit=50    # Crop TikTok clips
```

**Parallel Processing** (future):
```bash
# Multiple steps can run independently
# Steps 2-4: Metadata enrichment (can parallelize)
# Steps 5-6: Asset processing (sequential)
```

**Monitoring**:
```bash
# Track success rates by step
SELECT 
  'Step 2 (Spotify)' as step_name,
  COUNT(*) FILTER (WHERE spotify_track_id IS NOT NULL) as success,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE spotify_track_id IS NOT NULL) * 100.0 / COUNT(*), 2) as success_rate
FROM song_pipeline 
WHERE status IN ('spotify_resolved', 'iswc_found', 'metadata_enriched', 'lyrics_ready', 'audio_downloaded')
UNION ALL
SELECT 
  'Step 3 (ISWC)',
  COUNT(*) FILTER (WHERE iswc IS NOT NULL),
  COUNT(*),
  ROUND(COUNT(*) FILTER (WHERE iswc IS NOT NULL) * 100.0 / COUNT(*), 2)
FROM song_pipeline 
WHERE status IN ('iswc_found', 'metadata_enriched', 'lyrics_ready', 'audio_downloaded');
```

## Complete Scripts & Utilities Reference

The pipeline includes comprehensive utility scripts organized into functional categories. See **[`scripts/README.md`](scripts/README.md)** for detailed operational guide.

### **📊 Monitoring Scripts**
```bash
# Pipeline Status Dashboard
bun scripts:status              # Real-time pipeline status with creator stats
bun scripts:monitor             # Alias for status
bun scripts:flagged             # Find tracks needing manual review

# Test commands
bun test:status                 # Quick pipeline health check
bun test:demucs                 # Demucs service connectivity
bun test:genius                 # Genius API validation
```

### **🔄 Migration Scripts**
```bash
# Database Schema & Migration
bun scripts:migration:karaoke-segments    # Apply karaoke segments migration
bun scripts:migration:language-data       # Clean up language data structures
bun scripts:migration:update-images       # Update track images from Spotify

# GRC-20 Population (NEW)
bun scripts:migration:populate-grc20-artists   # Populate GRC-20 artists with metadata
bun scripts:migration:populate-grc20-works     # Populate works from pipeline
bun scripts:migration:validate-grc20-mint-readiness # Check mint readiness
```

### **🎵 Processing Scripts**
```bash
# Core Pipeline Operations
bun scripts:processing:orchestrator    # Run unified pipeline orchestrator
bun scripts:processing:separations     # Process all audio separations

# Backfill & Enrichment
bun scripts:backfill                   # Backfill Genius annotations
bun scripts:backfill:genius-artists   # Backfill missing Genius artist IDs
```

### **🆕 PKP/Lens & Web3 Scripts**
```bash
# Mint PKPs (Programmable Key Pairs)
bun src/processors/mint-artist-pkps.ts --limit=20      # For artists
bun src/processors/mint-creator-pkps.ts --limit=20     # For TikTok creators

# Create Lens Protocol accounts
bun src/processors/create-artist-lens.ts --limit=20    # For artists with PKPs
bun src/processors/create-creator-lens.ts --limit=20   # For creators with PKPs
```

### **🎙️ Transcription & Advanced Scripts**
```bash
# TikTok Video Transcription
bun src/processors/10-transcribe-tiktok-videos.ts --limit=10

# Advanced Metadata Enrichment
bun src/processors/05-enrich-wikidata.ts --limit=20              # Wikidata artist data
bun src/processors/05b-enrich-wikidata-works.ts --limit=20       # Wikidata works data
bun src/processors/05c-enrich-wikidata-work-contributors.ts --limit=20 # Work contributors
bun src/processors/08-enrich-quansic-artists.ts --limit=20        # Quansic enrichment

# Video & Media Processing
bun src/processors/11-upload-grove-videos.ts --limit=20          # Upload to Grove IPFS
```

---

## File Structure

```
karaoke-pipeline/
├── run-pipeline.ts           # Main CLI orchestrator
├── src/
│   ├── db/                  # Database connections
│   │   ├── neon.ts         # PostgreSQL client
│   │   ├── spotify.ts      # Spotify-specific queries
│   │   └── ...
│   ├── processors/          # Individual step processors
│   │   ├── 01-scrape-tiktok.ts
│   │   ├── 02-resolve-spotify.ts
│   │   ├── 03-resolve-iswc.ts
│   │   ├── 04-enrich-musicbrainz.ts
│   │   ├── 05-discover-lyrics.ts
│   │   └── 06-download-audio.ts
│   └── services/           # External API integrations
│       ├── spotify.ts
│       ├── quansic.ts
│       ├── lrclib.ts
│       └── ...
├── schema/
│   ├── 03-song-pipeline.sql
│   └── migrations/
└── package.json
```

## Testing Commands

**Single Track Test**:
```bash
# Run pipeline on single track through step 2
bun run test:pipeline

# Manual testing with specific track
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const track = await query('SELECT * FROM song_pipeline WHERE status = \$1 LIMIT 1', ['tiktok_scraped']);
  console.log('Test track:', track[0]);
"
```

**End-to-End Test**:
```bash
# Small batch test
bun run scrape @username 5          # Fresh content
bun run pipeline --all --limit=5    # Process all steps to completion
```

## Scripts Reference

For operational scripts and utilities, see **[`scripts/README.md`](scripts/README.md)** for comprehensive documentation.

**Key Package Scripts:**
- `bun run unified:all` - Run entire unified pipeline
- `bun run unified --step=N` - Run specific step
- `bun run scrape @username N` - Scrape TikTok videos
- `bun run test:pipeline` - Test single track

**Core CLI Arguments:**
- `--all`: Run all steps
- `--step=N`: Run specific step
- `--limit=N`: Number of tracks to process (default: 50)

See package.json for complete script definitions and scripts/README.md for operational commands.

## Production Deployment

**CLI Usage** (current):
```bash
# Manual execution
bun run pipeline:all

# Cron job (if needed)
*/30 * * * * cd /path/to/karaoke-pipeline && bun run pipeline:all
```

**Cloudflare Workers** (legacy):
```bash
# Workers orchestrator exists but not used
# Uses separate status-driven pipeline
wrangler deploy
```

## Integration Points

**Upstream**: TikTok creators/urls
**Downstream**: 
- Karaoke applications (consume lyrics + audio)
- GRC-20 minting contracts
- IP asset protocols

**Data Output**:
```sql
-- Final product tracks
SELECT 
  title,
  artist_name, 
  spotify_track_id,
  lyrics_url,
  audio_cid,
  'READY FOR KARAOKE' as status
FROM song_pipeline 
WHERE status = 'audio_downloaded';
```

## Troubleshooting Checklist

**Before Running**:
- [ ] `.env` file exists with all required variables
- [ ] Neon DB connection working
- [ ] Spotify API credentials valid
- [ ] Quansic service accessible

**During Run**:
- [ ] Monitor log files: `/tmp/pipeline-*.log`
- [ ] Check database for stuck tracks
- [ ] Verify API rate limits not hit

**After Run**:
- [ ] Confirm track counts in final `audio_downloaded` status
- [ ] Validate CIDs resolve on IPFS gateway
- [ ] Test lyrics URLs are accessible

## Future Enhancements

- **Parallel processing**: Steps 2-4 can run in parallel
- **Retry logic**: Automatic retries for failed tracks
- **Web dashboard**: Visual pipeline monitoring  
- **API triggers**: HTTP endpoints for manual step control
- **Advanced filtering**: Filter by genre, artist, date ranges

---

## See Also

- **[README.md](README.md)** - Main pipeline overview and quick start guide
- **[scripts/README.md](scripts/README.md)** - Operational scripts and monitoring tools

- **[scripts/migration/README-POPULATION.md](scripts/migration/README-POPULATION.md)** - GRC-20 data population strategies

All technical implementation details are now consolidated in this comprehensive developer guide.
