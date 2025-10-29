# Karaoke Pipeline - Agent Guide

## Quick Overview

**Purpose**: 6-step pipeline to process TikTok videos into karaoke-ready segments with lyrics and audio
**Status**: Working CLI-based pipeline with individual step processors

## Core Commands

```bash
# Run entire pipeline (all steps 2-6)
bun run pipeline:all

# Run specific step
bun run pipeline --step=3 --limit=10    # ISWC Discovery for 10 tracks
bun run pipeline --step=6 --limit=5     # Audio Download for 5 tracks

# Scrape fresh content
bun run scrape @username 20            # Scrape 20 videos from creator

# Test single track
bun run test:pipeline                  # Run step 2 with 1 track
```

## Pipeline Architecture

**6 Steps**:
1. **TikTok Scraping** (`01-scrape-tiktok.ts`) → `tiktok_scraped`
2. **Spotify Resolution** (`02-resolve-spotify.ts`) → `spotify_resolved`  
3. **ISWC Discovery** (`03-resolve-iswc.ts`) → `iswc_found`
4. **MusicBrainz Enrichment** (`04-enrich-musicbrainz.ts`) → `metadata_enriched`
5. **Lyrics Discovery** (`05-discover-lyrics.ts`) → `lyrics_ready`
6. **Audio Download** (`06-download-audio.ts`) → `audio_downloaded` ✅

**Entry Points**:
- `run-pipeline.ts`: CLI orchestrator (main runner)
- `src/index.ts`: Cloudflare Workers service (legacy)

## Key Patterns

**CLI Orchestration**:
```typescript
// run-pipeline.ts structure
async function runStep(stepNumber: number, limit: number) {
  const command = `dotenvx run -f .env -- bun src/processors/0${stepNumber}-${stepName}.ts ${limit}`;
  await executeCommand(command);
}
```

**Database Schema**:
```sql
CREATE TABLE song_pipeline (
  id SERIAL PRIMARY KEY,
  tiktok_url TEXT,
  spotify_track_id TEXT UNIQUE,
  title TEXT,
  artist_name TEXT,
  status TEXT DEFAULT 'tiktok_scraped',
  iswc TEXT,
  lyrics_url TEXT,
  audio_cid TEXT,           -- IPFS CID from Grove
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status Flow**:
```
tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched → lyrics_ready → audio_downloaded
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

# 2. Run full pipeline
bun run pipeline:all

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
bun run pipeline --step=3 --limit=1

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
bun run pipeline --step=3 --limit=100    # ISWC discovery
bun run pipeline --step=6 --limit=20     # Audio download (slower)
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
  "pipeline": "bun run-pipeline.ts",
  "pipeline:all": "bun run-pipeline.ts --all --limit=50",
  "pipeline:step": "bun run-pipeline.ts",
  "scrape": "dotenvx run -f .env -- bun src/processors/01-scrape-tiktok.ts",
  "test:pipeline": "bun run-pipeline.ts --step=2 --limit=1",
  "genius": "dotenvx run -f .env -- bun src/processors/07-genius-enrichment.ts"
}
```

**CLI Arguments**:
- `--all`: Run all steps (2-7)
- `--step=N`: Run specific step (2-7)
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
