# Claude Code Context - Karaoke Pipeline

**Purpose**: Complete TikTok → karaoke pipeline: videos to multi-language transcribed karaoke segments with word-level timing

## Core Architecture

**Complete Pipeline**:
```
tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched
→ lyrics_ready → audio_downloaded → alignment_complete → translations_ready
```

**Main Entry Point**: `orchestrator.ts` unified processor with individual step handlers in `src/processors/`
**CLI Runner**: `run-pipeline.ts` for backward compatibility

## Essential Commands

```bash
# 1. Scrape TikTok videos
bun run scrape @charleenweiss 20

# 2. Run enabled pipeline steps (3, 6.5, 7, 7.5)
bun run pipeline:all

# Run specific step only
bun run pipeline --step=3 --limit=10     # ISWC Discovery for 10 tracks
bun run pipeline --step=6.5 --limit=5    # Forced Alignment for 5 tracks
bun run pipeline --step=7.5 --limit=15   # Translation for 15 tracks

# Test single track
bun run test:pipeline                    # Run step 2 with 1 track
```

## Pipeline Step Breakdown

| Step | Processor | Status Transition | Enabled | Purpose |
|------|-----------|-------------------|---------|---------|
| 1 | `01-scrape-tiktok.ts` | → `tiktok_scraped` | Manual | Scrape creator videos |
| 2 | `02-resolve-spotify.ts` | `tiktok_scraped` → `spotify_resolved` | Queued | Get Spotify metadata |
| 3 | `03-resolve-iswc.ts` | `spotify_resolved` → `iswc_found` | ✅ | **GATE**: Resolve ISWC codes |
| 4 | `04-enrich-musicbrainz.ts` | `iswc_found` → `metadata_enriched` | Queued | Add MusicBrainz data |
| 5 | `05-discover-lyrics.ts` | `metadata_enriched` → `lyrics_ready` | Queued | Fetch synced lyrics |
| 6 | `06-download-audio.ts` | `lyrics_ready` → `audio_downloaded` | Queued | Download audio to Grove |
| 6.5 | `06-forced-alignment.ts` | `audio_downloaded` → `alignment_complete` | ✅ | ElevenLabs word timing |
| 7 | `07-genius-enrichment.ts` | `lyrics_ready` (parallel) | ✅ Optional | Genius annotations |
| 7.5 | `07-translate-lyrics.ts` | `alignment_complete` → `translations_ready` | ✅ | Multi-language translation |
| 8 | `08-separate-audio.ts` | `audio_downloaded` → `stems_separated` | ❌ Optional | Extract instrumental |

## Database Schema

**Core Table**: `song_pipeline`
- `id` (PK), `tiktok_url`, `spotify_track_id` (UNIQUE), `title`, `artist_name`
- `status` (current pipeline stage), `iswc`, `lyrics_url`, `audio_cid` (IPFS)
- `created_at`, `updated_at`

**Supporting Tables**:
- `spotify_tracks`: Track metadata (title, artist, ISRC, duration)
- `spotify_artists`: Artist data (name, genres, popularity)
- `song_lyrics`: Synced lyrics with timestamps (JSONB)
- `song_audio`: Grove IPFS audio files with metadata

## Environment Setup

**Required Variables** (.env):
```bash
NEON_DATABASE_URL=postgresql://...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
QUANSIC_SERVICE_URL=http://localhost:3001
GROVE_TOKEN=...
OPENAI_API_KEY=...
```

## Key Development Patterns

**CLI Orchestration Pattern**:
```typescript
// run-pipeline.ts - main runner
async function runStep(stepNumber: number, limit: number) {
  const command = `dotenvx run -f .env -- bun src/processors/0${stepNumber}-${stepName}.ts ${limit}`;
  await executeCommand(command);
}
```

**Status-Driven Processing**:
```sql
-- Each step queries for tracks in correct predecessor status
SELECT * FROM song_pipeline WHERE status = 'spotify_resolved' LIMIT ?
-- Process, then update to next status
UPDATE song_pipeline SET status = 'iswc_found' WHERE spotify_track_id = ?
```

## Common Workflows

**1. Complete Fresh Start**:
```bash
# Scrape → Process all steps
bun run scrape @gioscottii 10
bun run pipeline:all
```

**2. Debug Specific Step**:
```bash
# Run step 3 on 1 track to isolate issues
bun run pipeline --step=3 --limit=1
```

**3. Check Pipeline Status**:
```sql
SELECT status, COUNT(*) FROM song_pipeline GROUP BY status;
```

## Troubleshooting Guide

**Pipeline Not Processing**:
- Check if tracks in correct predecessor status
- Verify `.env` has all required variables
- Test database connection: `dotenvx run -f .env -- bun -e "import { query } from './src/db/neon.ts'; console.log(await query('SELECT NOW()'))"`

**Step-Specific Issues**:
- Step 2 (Spotify): API rate limits, invalid credentials
- Step 3 (ISWC): Quansic service down, no ISWC found
- Step 4 (MusicBrainz): API timeout, metadata missing
- Step 5 (Lyrics): LRCLIB down, lyrics not found
- Step 6 (Audio): Soulseek connection, Grove upload fails

**Database Inspection**:
```sql
-- Check stuck tracks
SELECT * FROM song_pipeline WHERE status IN ('spotify_resolved', 'iswc_found') 
AND updated_at < NOW() - INTERVAL '1 hour';

-- Check successful completions
SELECT title, artist_name, audio_cid FROM song_pipeline 
WHERE status = 'audio_downloaded' ORDER BY updated_at DESC LIMIT 10;
```

## File Structure

```
karaoke-pipeline/
├── run-pipeline.ts              # CLI orchestrator (main entry)
├── src/
│   ├── processors/              # Individual step processors
│   │   ├── 01-scrape-tiktok.ts  # Step 1: TikTok scraping
│   │   ├── 02-resolve-spotify.ts # Step 2: Spotify metadata
│   │   ├── 03-resolve-iswc.ts   # Step 3: ISWC discovery
│   │   ├── 04-enrich-musicbrainz.ts # Step 4: MusicBrainz enrichment
│   │   ├── 05-discover-lyrics.ts # Step 5: Lyrics fetching
│   │   └── 06-download-audio.ts # Step 6: Audio + IPFS
│   ├── db/                      # Database layer
│   │   ├── neon.ts             # PostgreSQL client
│   │   ├── spotify.ts          # Spotify-specific queries
│   │   └── ...
│   └── services/               # External API integrations
│       ├── spotify.ts          # Spotify Web API
│       ├── quansic.ts          # ISWC discovery service
│       ├── musicbrainz.ts      # MusicBrainz API
│       ├── lrclib.ts           # Lyrics API
│       └── freyr.ts            # Audio download (Soulseek)
├── schema/                      # Database schema
│   └── 03-song-pipeline.sql
└── wrangler.toml               # Cloudflare Workers config
```

## Service Dependencies

**External APIs**:
- **Spotify Web API**: Track metadata, ISRC codes
- **Quansic Service**: ISWC discovery (95% coverage vs MusicBrainz 36%)
- **MusicBrainz**: Rich metadata enrichment
- **LRCLib**: Synced lyrics with timestamps
- **Soulseek**: Audio file retrieval
- **Grove IPFS**: Audio storage + CID generation

**Database**: Neon PostgreSQL for pipeline state tracking

## Key Scripts

```json
{
  "pipeline": "bun run-pipeline.ts",
  "pipeline:all": "bun run-pipeline.ts --all --limit=50",
  "pipeline:step": "bun run-pipeline.ts",
  "scrape": "dotenvx run -f .env -- bun src/processors/01-scrape-tiktok.ts",
  "test:pipeline": "bun run-pipeline.ts --step=2 --limit=1"
}
```

## CLI Arguments

- `--all`: Run all steps (2-6) sequentially
- `--step=N`: Run specific step (2-6)
- `--limit=N`: Number of tracks to process (default: 50)

## Performance Considerations

**Batch Sizes**:
- Steps 2-4: Process 50-100 tracks efficiently
- Step 5 (Lyrics): 50 tracks acceptable
- Step 6 (Audio): 20 tracks max (slowest step, ~30-60s/track)

**Parallelization**: Future enhancement - Steps 2-4 can run in parallel (metadata enrichment phase)

## Production Notes

**Current Mode**: CLI-based manual execution
**Alternative**: Cloudflare Workers with cron triggers (configured but not primary)

**Final Output**: Tracks in `audio_downloaded` status with:
- `lyrics_url`: Synced lyrics with timestamps
- `audio_cid`: Grove IPFS CID for audio file
- Ready for karaoke applications and GRC-20 minting

## Development Tips

**Idempotent Pipeline**: Safe to run same step multiple times - skips already-processed tracks

**Error Handling**: Each step has built-in retry logic and rate limiting

**Monitoring**: Check `/tmp/pipeline-*.log` files for detailed execution logs

**Database Transactions**: Each step uses transactions to maintain consistency

## Testing Patterns

**Single Track Test**:
```bash
# Test step 2 with 1 track
bun run test:pipeline

# Or manually
bun run pipeline --step=2 --limit=1
```

**End-to-End Test**:
```bash
# Small batch through all steps
bun run scrape @username 3
bun run pipeline:all --limit=3
```

## Integration Points

**Upstream**: TikTok video URLs from creators
**Downstream**: 
- Karaoke apps (consume lyrics + audio CIDs)
- GRC-20 minting contracts
- IP asset protocols

**Data Flow**: TikTok URLs → Spotify tracks → ISWC codes → enriched metadata → synced lyrics → Grove IPFS audio
