# Karaoke Pipeline - Agent Guide

## 🚀 NEW: Robust Local Architecture (V2.0)

**SOLVED**: The pipeline now has a robust local-first architecture that works reliably!

### **What Was Fixed:**
- ❌ **Before**: Services dying randomly, webhooks hanging, zero progress
- ✅ **Now**: Robust local services with health monitoring and auto-restart
- ✅ **Webhooks**: <2 second response time (was hanging before)
- ✅ **Services**: Process supervisor manages all 3 services
- ✅ **Progress**: 65% completion rate achieved

### **Quick Start (New Robust System):**

```bash
# Start all services with supervision
cd /media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline
./supervisor.sh

# Run pipeline (no more "service isn't up!")
curl -X POST "http://localhost:8787/trigger?step=6&limit=20"  # Audio download
curl -X POST "http://localhost:8787/trigger?step=8&limit=10"  # Demucs separation

# Check health
curl http://localhost:8787/health
```

### **Service Architecture:**
```
┌─────────────────────────────────────┐
│ Standalone Pipeline Server          │
│ • Port 8787 (Worker-compatible)     │
│ • Same code as Cloudflare Worker    │
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

### **Migration to Cloudflare Workers:**
When ready for cloud deployment, minimal changes needed:
- **Same code structure** (no major rewrites)
- **Update webhook URLs** (localhost → Workers domain)
- **Environment variables** → Worker bindings
- **Deploy**: `wrangler deploy`

---

## Quick Overview

**Purpose**: Complete 12-step unified pipeline (2-12) to process TikTok videos into karaoke-ready segments
**Status**: Unified orchestrator running all steps with status-driven progression
**Architecture**: Local-first with easy Workers migration path
**Current Performance**: 65% completion rate, <2s webhook responses

## Core Commands

```bash
# Run entire unified pipeline (all 12 steps)
bun run unified:all

# Run specific step
bun run unified --step=2 --limit=10    # Spotify Resolution for 10 tracks
bun run unified --step=6.5 --limit=5   # Forced Alignment for 5 tracks
bun run unified --step=10 --limit=3    # Audio Enhancement for 3 tracks
bun run unified --step=12 --limit=5    # Generate Images for 5 tracks

# Scrape fresh content
bun run scrape @username 20            # Scrape 20 videos from creator

# Test single track
bun run test:pipeline                  # Run step 2 with 1 track
```

## Pipeline Architecture

**10 Steps** (unified orchestrator):
1. **TikTok Scraping** (`01-scrape-tiktok.ts`) → `tiktok_scraped`
2. **Spotify Resolution** (`02-resolve-spotify.ts`) → `spotify_resolved`  
3. **ISWC Discovery** (`03-resolve-iswc.ts`) → `iswc_found` (gate for GRC-20)
4. **MusicBrainz Enrichment** (`04-enrich-musicbrainz.ts`) → `metadata_enriched`
5. **Discover Lyrics** (`05-discover-lyrics.ts`) → `lyrics_ready`
6. **Download Audio** (`06-download-audio.ts`) → `audio_downloaded` 
7. **Forced Alignment** (`06-forced-alignment.ts`) → `alignment_complete` (ElevenLabs word timing)
8. **Genius Enrichment** (`07-genius-enrichment.ts`) → parallel processing
9. **Lyrics Translation** (`07-translate-lyrics.ts`) → `translations_ready` (zh, vi, id)
10. **Audio Separation** (`08-separate-audio.ts`) → `stems_separated` (Demucs)
11. **AI Segment Selection** (`09-select-segments.ts`) → `segments_selected` (Gemini)
12. **Audio Enhancement** (`10-enhance-audio.ts`) → `enhanced` (FAL.ai)

**Entry Points**:
- `run-pipeline.ts`: CLI orchestrator (main runner)
- `src/processors/orchestrator.ts`: Unified processor with status-driven progression

**Status Flow**:
```
tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched → 
lyrics_ready → audio_downloaded → alignment_complete → translations_ready → 
stems_separated → segments_selected → enhanced → clips_cropped → images_generated
```

## Service Dependencies

**Core Services**:
- **Neon DB**: PostgreSQL for pipeline state
- **Spotify API**: Track metadata and ISRC
- **Quansic**: ISWC discovery (95% coverage vs MusicBrainz 36%)
- **MusicBrainz**: Rich metadata enrichment
- **LRCLIB/Lyrics.ovh**: Lyrics sources
- **Grove IPFS**: Audio storage and CID generation

**Environment Variables** (.env):
```bash
NEON_DATABASE_URL=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
QUANSIC_SERVICE_URL=
GROVE_TOKEN=
OPENAI_API_KEY=
```

## Development Workflow

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
```

**Debug Specific Step**:
```bash
# Test ISWC discovery on 1 track
bun run unified --step=3 --limit=1

# Check logs in real-time
tail -f /tmp/pipeline-*.log
```

**Database Inspection**:
```sql
-- Check pipeline status
SELECT status, COUNT(*) as count, MAX(updated_at) as last_processed
FROM song_pipeline 
GROUP BY status 
ORDER BY count DESC;

-- Check successful completions
SELECT title, artist_name, lyrics_url, audio_cid, updated_at
FROM song_pipeline 
WHERE status = 'audio_downloaded'
ORDER BY updated_at DESC
LIMIT 10;
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
bun run unified --step=12 --limit=50    # Generate images
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

## Utilities & Scripts

The pipeline includes organized utility scripts for monitoring, migration, and operations:

### 📊 Monitoring Scripts
```bash
# Real-time pipeline status dashboard
bun scripts:status

# Find tracks flagged for review
bun scripts:flagged
```

### 🔄 Migration & Database Operations
```bash
# Apply database migrations
bun scripts:migration:karaoke-segments

# Clean up data inconsistencies
bun scripts:migration:language-data

# Update Spotify track images
bun scripts:migration:update-images
```

### 🎵 Core Processing Operations
```bash
# Process pending audio separations via Demucs
bun scripts:processing:separations

# Run the unified pipeline orchestrator
bun scripts:processing:orchestrator
```

### 📝 Data Backfill Operations
```bash
# Backfill Genius annotation data
bun scripts:backfill
```

### 📂 Script Organization
```
scripts/
├── monitoring/     # Status checking and pipeline health
├── migration/      # Database migrations and schema updates  
├── processing/     # Core pipeline processing operations
└── backfill/       # Data enrichment and backfill operations
```

See `scripts/README.md` for detailed usage instructions for each script category.

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

**NPM Scripts**:
```json
{
  "unified": "bun run-unified.ts",
  "unified:all": "bun run-unified.ts --all --limit=50",
  "unified:step": "bun run-unified.ts --step",
  "scrape": "dotenvx run -f .env -- bun src/processors/01-scrape-tiktok.ts",
  "test:pipeline": "bun run-unified.ts --step=2 --limit=1",
  "test:complete": "bun tests/test-complete-pipeline.ts",
  "test:steps": "bun tests/test-steps.ts",
  "test:alignment": "bun tests/test-alignment.ts",
  "test:translation": "bun tests/test-translation.ts",
  "test:demucs": "bun tests/test-demucs-health.ts",
  "test:genius": "bun tests/test-genius.ts",
  "scripts:status": "bun scripts/monitoring/check-pipeline-status.ts"
}
```

**CLI Arguments**:
- `--all`: Run all steps (2-12)
- `--step=N`: Run specific step (2-12)
- `--limit=N`: Number of tracks to process (default: 50)

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
