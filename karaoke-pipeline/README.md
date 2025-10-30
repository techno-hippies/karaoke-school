# Karaoke Pipeline

**Complete pipeline to process TikTok videos into karaoke segments with multi-language translations**

**Status flow:**
```
tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched →
lyrics_ready → audio_downloaded → alignment_complete → translations_ready
```

---

## Quick Start

```bash
# Scrape TikTok creator first
bun run scrape @charleenweiss 20

# Run entire pipeline (steps 3, 6.5, 7, 7.5) with 50 items per step
bun run pipeline:all

# Run single step
bun run pipeline --step=3 --limit=25    # ISWC Discovery only
bun run pipeline --step=6.5 --limit=10  # Forced Alignment only
bun run pipeline --step=7.5 --limit=10  # Translation only

# Test pipeline with 1 item
bun run test:pipeline
```

---

## Pipeline Steps

| Step | Name | Status Transition | What it Does | Required |
|------|------|-------------------|--------------|----------|
| 1 | Scrape TikTok | `n/a → tiktok_scraped` | Downloads TikTok videos from creator | Manual |
| 2 | Resolve Spotify | `tiktok_scraped → spotify_resolved` | Gets Spotify metadata (track + artist) | Queued |
| 3 | ISWC Discovery | `spotify_resolved → iswc_found` | Finds ISWC codes (gate for GRC-20) | ✅ |
| 4 | Enrich MusicBrainz | `iswc_found → metadata_enriched` | Adds MusicBrainz metadata | Queued |
| 5 | Discover Lyrics | `metadata_enriched → lyrics_ready` | Fetches synced lyrics from LRCLIB | Queued |
| 6 | Download Audio | `lyrics_ready → audio_downloaded` | Downloads audio via Soulseek → Grove | Queued |
| 6.5 | ElevenLabs Forced Alignment | `audio_downloaded → alignment_complete` | Word-level timing for karaoke | ✅ |
| 7 | Genius Enrichment | `lyrics_ready+ → lyrics_ready` | Enriches with Genius metadata (parallel) | ✅ Optional |
| 7.5 | Lyrics Translation | `alignment_complete → translations_ready` | Multi-language (zh, vi, id) with word timing | ✅ |
| 8 | Audio Separation | `audio_downloaded → stems_separated` | Extract instrumental via Demucs | Optional |

---

## Usage Examples

### 1. Complete Workflow (Fresh Start)

```bash
# 1. Scrape TikTok videos from creator
bun run scrape @charleenweiss 20

# 2. Run full pipeline (steps 3, 6.5, 7, 7.5)
bun run pipeline:all

# 3. Check results in database
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const result = await query('SELECT status, COUNT(*) FROM song_pipeline GROUP BY status');
  console.table(result);
"
```

### 2. Run Specific Steps Only

```bash
# Only run Step 3 (ISWC Discovery) for 25 tracks
bun run pipeline --step=3 --limit=25

# Only run Step 6.5 (Forced Alignment) for 10 tracks
bun run pipeline --step=6.5 --limit=10

# Only run Step 7.5 (Translation) for 15 tracks
bun run pipeline --step=7.5 --limit=15

# Only run Step 7 (Genius enrichment) for 20 tracks
bun run pipeline --step=7 --limit=20
```

### 3. Process Different Creator

```bash
# Scrape videos from another creator
bun run scrape @gioscottii 30

# Then run full pipeline
bun run pipeline:all
```

### 4. Test Pipeline with One Track

```bash
bun run test:pipeline
# This runs step 2 (Spotify resolution) with limit=1
```

---

## Advanced Usage

### Run Specific Steps with Custom Limits

```bash
# Run ISWC discovery with 50 items
bun run pipeline --step=3 --limit=50

# Run forced alignment with 25 items
bun run pipeline --step=6.5 --limit=25

# Run translation with 100 items
bun run pipeline --step=7.5 --limit=100

# Scrape with custom creator and limit
dotenvx run -f .env -- bun src/processors/01-scrape-tiktok.ts @username 50
```

### Manual Step Execution

```bash
# Run processors directly with dotenvx
dotenvx run -f .env -- bun src/processors/03-resolve-iswc.ts 10
dotenvx run -f .env -- bun src/processors/06-forced-alignment.ts 10
dotenvx run -f .env -- bun src/processors/07-translate-lyrics.ts 10
dotenvx run -f .env -- bun src/processors/07-genius-enrichment.ts 10
```

---

## Monitoring Progress

### Check Pipeline Status

```bash
# Quick status check
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const result = await query(\`
    SELECT
      status,
      COUNT(*) as count,
      MAX(updated_at) as last_updated
    FROM song_pipeline
    GROUP BY status
    ORDER BY count DESC
  \`);
  console.table(result);
"
```

### Check Latest Processed Tracks

```bash
# See last 10 processed tracks
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const result = await query(\`
    SELECT
      sp.spotify_track_id,
      st.title,
      st.artist_name,
      sp.status,
      sp.updated_at
    FROM song_pipeline sp
    JOIN spotify_tracks st ON st.spotify_track_id = sp.spotify_track_id
    ORDER BY sp.updated_at DESC
    LIMIT 10
  \`);
  console.table(result);
"
```

---

## Troubleshooting

### Pipeline Not Processing Anything

Check if tracks are in the correct status:

```bash
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';

  // Check how many tracks in each status
  const statusCount = await query('SELECT status, COUNT(*) FROM song_pipeline GROUP BY status');
  console.log('📊 Status Distribution:');
  console.table(statusCount);

  // Check if we have tracks ready for step 2
  const readyForStep2 = await query(\`
    SELECT COUNT(*) as count FROM song_pipeline WHERE status = 'tiktok_scraped'
  \`);
  console.log('Ready for Step 2 (Spotify):', readyForStep2[0].count);
"
```

### Individual Step Failing

Run the step directly with verbose output:

```bash
# Run step with error details
dotenvx run -f .env -- bun src/processors/03-resolve-iswc.ts 1
```

### Check Database Connection

```bash
# Test Neon connection
dotenvx run -f .env -- bun -e "
  import { query } from './src/db/neon.ts';
  const result = await query('SELECT NOW() as current_time');
  console.log('✅ Database connected:', result[0].current_time);
"
```

---

## Development

### Project Structure

```
karaoke-pipeline/
├── run-pipeline.ts          # Main pipeline orchestrator
├── src/
│   ├── index.ts            # Cloudflare Worker (cron)
│   ├── routes.ts           # HTTP trigger endpoints
│   ├── processors/
│   │   ├── 01-scrape-tiktok.ts
│   │   ├── 02-resolve-spotify.ts
│   │   ├── 03-resolve-iswc.ts
│   │   ├── 04-enrich-musicbrainz.ts
│   │   ├── 05-discover-lyrics.ts
│   │   └── 06-download-audio.ts
│   ├── db/
│   │   ├── neon.ts         # Database connection
│   │   ├── spotify.ts      # Spotify queries
│   │   ├── musicbrainz.ts  # MusicBrainz queries
│   │   ├── lyrics.ts       # Lyrics queries
│   │   └── audio.ts        # Audio queries
│   └── services/
│       ├── spotify.ts      # Spotify API
│       ├── quansic.ts      # Quansic service
│       ├── musicbrainz.ts  # MusicBrainz API
│       ├── lrclib.ts       # LRCLIB API
│       └── freyr.ts        # Audio download
└── wrangler.toml           # Cloudflare config
```

### Adding a New Step

1. Create processor: `src/processors/08-new-step.ts`
2. Add to `run-pipeline.ts` STEPS array
3. Define status transition (e.g., `audio_downloaded → new_status`)
4. Test: `bun run pipeline --step=8 --limit=1`

---

## Environment Variables

Required in `.env`:

```bash
# Database
NEON_DATABASE_URL=postgresql://...

# APIs
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
QUANSIC_SERVICE_URL=http://localhost:3001
SLSK_SERVICE_URL=http://localhost:3002
GENIUS_API_KEY=...  # Optional: for lyrics metadata enrichment

# Storage
GROVE_TOKEN=...
IRYS_PRIVATE_KEY=...
```

---

## Database Schema

### Core Tables

- **`song_pipeline`**: Pipeline state tracking
  - `tiktok_video_id` (PK)
  - `spotify_track_id` (FK)
  - `status` (tiktok_scraped → audio_downloaded)
  - `created_at`, `updated_at`

- **`spotify_tracks`**: Track metadata
  - `spotify_track_id` (PK)
  - `title`, `artist_name`, `isrc`, `duration_ms`

- **`spotify_artists`**: Artist metadata
  - `spotify_artist_id` (PK)
  - `name`, `genres`, `popularity`

- **`song_lyrics`**: Synced lyrics
  - `spotify_track_id` (PK, FK)
  - `lines` (JSONB), `source`, `language_code`

- **`song_audio`**: Audio files
  - `spotify_track_id` (PK, FK)
  - `grove_cid`, `grove_url`, `duration_ms`, `source`

- **`genius_songs`**: Genius song metadata
  - `genius_song_id`, `spotify_track_id`
  - `language`, `release_date`, `annotation_count`
  - `lyrics_state`, `pyongs_count`

- **`genius_artists`**: Genius artist profiles
  - `genius_artist_id` (PK)
  - `social media handles`, `verification`
  - `followers_count`, `is_verified`

- **`genius_song_referents`**: Lyrics annotations
  - `genius_song_id`, `fragment`, `classification`
  - `votes_total`, `comment_count`

---

## Status Definitions

| Status | Description | Next Step |
|--------|-------------|-----------|
| `tiktok_scraped` | Video scraped from TikTok | → Step 2 (Spotify) |
| `spotify_resolved` | Spotify metadata resolved | → Step 3 (ISWC Discovery) |
| `iswc_found` | ISWC code discovered (**gate**) | → Step 4 (MusicBrainz - Queued) |
| `metadata_enriched` | MusicBrainz metadata added | → Step 5 (Lyrics Discovery - Queued) |
| `lyrics_ready` | Synced lyrics fetched | → Step 6 (Download Audio - Queued) |
| `audio_downloaded` | Audio on Grove IPFS | → Step 6.5 (Forced Alignment) |
| `stems_separated` | Instrumental extracted (optional) | → Step 6.5 (Forced Alignment) |
| `alignment_complete` | Word-level timing generated | → Step 7.5 (Lyrics Translation) |
| `translations_ready` | Multi-language translations done | ✅ Ready for karaoke UI |

---

## Production Deployment

### Cloudflare Workers (Cron)

```bash
# Deploy to Cloudflare
wrangler deploy

# Cron runs every 5 minutes automatically
# Or trigger manually:
curl -X POST https://karaoke-pipeline.your-name.workers.dev/trigger?limit=50
```

### Local Development

```bash
# Start Cloudflare Workers dev server
bun run dev

# Trigger manually
curl -X POST http://localhost:8787/trigger?step=3&limit=10
```

---

## FAQ

**Q: How do I process just one track to test?**

```bash
bun run test:pipeline  # Runs step 2 (Spotify) with limit=1
```

**Q: What are the currently enabled steps?**

- ✅ Step 3: ISWC Discovery (required gate)
- ✅ Step 6.5: ElevenLabs Forced Alignment (word-level timing)
- ✅ Step 7: Genius Enrichment (optional metadata)
- ✅ Step 7.5: Lyrics Translation (zh, vi, id)

Steps 2, 4, 5, 6 are queued (need export functions or external services).

**Q: Can I run steps in parallel?**

No, steps must run sequentially because each step depends on the previous status.

**Q: What if a step fails partway through?**

The pipeline is idempotent - just run it again. It will skip already-processed items.

**Q: How do I add more TikTok videos?**

```bash
bun run scrape @creator_username 50
```

**Q: How long does the full pipeline take?**

For 50 tracks through enabled steps:
- Step 3 (ISWC): ~2s per track = ~100s
- Step 6.5 (Alignment): ~3-5s per track = ~150-250s
- Step 7 (Genius): ~0.5s per track = ~25s (optional)
- Step 7.5 (Translation): ~2-3s per track = ~100-150s

Total: ~5-10 minutes for 50 tracks

**Q: Can I skip steps?**

No, each enabled step requires the previous status. Steps can be individually disabled in `orchestrator.ts`.

**Q: What's the difference between Forced Alignment and Audio Separation?**

- **Forced Alignment (Step 6.5)**: Takes lyrics + audio (full or instrumental), returns word-level timing
- **Audio Separation (Step 8)**: Takes full audio, extracts instrumental stem (optional preprocessing)

---

## Support

See `AGENTS.md` for detailed technical documentation.

For issues:
1. Check Troubleshooting section above
2. Review `wrangler tail` logs (if deployed)
3. Check Neon DB for status issues
4. Run single step with `--limit=1` to isolate problems
