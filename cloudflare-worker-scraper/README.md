# TikTok Scraper - Cloudflare Worker + Neon DB

Serverless TikTok video scraper with automatic Spotify + Genius enrichment.

## Features

✅ **Scrapes TikTok creator videos** via fetch API (no Python dependencies)
✅ **Stores in Neon PostgreSQL** with JSONB for flexibility
✅ **Idempotent upserts** - safe to re-run, updates stats
✅ **Extracts key fields** for fast queries (Spotify ID, copyright status, stats)
✅ **Automatic Spotify enrichment** - fetches track metadata when new songs are scraped
✅ **Automatic Genius enrichment** - matches songs with lyrics and metadata (artist-validated)
✅ **Queryable analytics** - top tracks, copyright analysis, creator stats

## Architecture

```
Cloudflare Worker (TypeScript)
  ├─ TikTok scraping (fetch API)
  ├─ Spotify enrichment (automatic after scrape)
  ├─ Genius enrichment (automatic after Spotify enrichment)
  └─ Neon DB upserts

Neon PostgreSQL
  ├─ tiktok_creators (profiles)
  ├─ tiktok_scraped_videos (JSONB + indexed fields)
  ├─ spotify_tracks (enriched metadata: title, artists, ISRC, album)
  └─ genius_songs (lyrics metadata: song ID, artist, URL)
```

## Database Schema

**tiktok_creators table:**
- `tiktok_handle` (PK)
- `sec_uid`, `nickname`, `follower_count`
- `raw_profile` (JSONB - full TikTok profile data)

**tiktok_scraped_videos table:**
- `video_id` (PK)
- Indexed fields: `spotify_track_id`, `copyright_status`, `play_count`, `created_at`
- `raw_data` (JSONB - full TikTok video data)

**spotify_tracks table:**
- `spotify_track_id` (PK)
- `title`, `artists[]`, `album`, `isrc`, `popularity`
- `raw_data` (JSONB - full Spotify API response)

**genius_songs table:**
- `genius_song_id` (PK)
- `spotify_track_id` (FK to spotify_tracks)
- `title`, `artist_name`, `genius_artist_id`, `url`
- `raw_data` (JSONB - full Genius API response)

## Setup

### 1. Install Dependencies

```bash
cd cloudflare-worker-scraper
bun install
```

### 2. Set Secrets

```bash
# Neon database URL
wrangler secret put NEON_DATABASE_URL

# Spotify API credentials
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET

# Genius API credentials
wrangler secret put GENIUS_API_KEY
```

### 3. Deploy

```bash
bun run deploy
```

## API Endpoints

### Scrape Creator Videos

```bash
# Scrape videos (auto-enriches Spotify + Genius)
curl https://tiktok-scraper.deletion-backup782.workers.dev/scrape/idazeile

# Limit to 20 videos
curl https://tiktok-scraper.deletion-backup782.workers.dev/scrape/idazeile?limit=20
```

**Response:**
```json
{
  "success": true,
  "creator": {
    "handle": "@idazeile",
    "nickname": "Ida Zeile",
    "followers": 225900
  },
  "scraped": {
    "videos": 20,
    "inserted": 20
  },
  "stats": {
    "totalVideos": 44,
    "totalViews": 16219011,
    "copyrightedCount": 17,
    "copyrightFreeCount": 27
  }
}
```

**Note:** Spotify and Genius enrichment run automatically in the background after scraping (cascading: Spotify → Genius).

### Manual Spotify Enrichment

```bash
# Enrich up to 100 tracks
curl -X POST https://tiktok-scraper.deletion-backup782.workers.dev/enrich

# Limit enrichment
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich?limit=50"
```

**Response:**
```json
{
  "success": true,
  "service": "spotify",
  "enriched": 13,
  "total": 16
}
```

### Manual Genius Enrichment

```bash
# Enrich up to 50 tracks
curl -X POST https://tiktok-scraper.deletion-backup782.workers.dev/enrich-genius

# Limit enrichment
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich-genius?limit=20"
```

**Response:**
```json
{
  "success": true,
  "service": "genius",
  "enriched": 8,
  "total": 10
}
```

### Get Creator Stats

```bash
curl https://tiktok-scraper.deletion-backup782.workers.dev/stats/idazeile
```

### Get Top Spotify Tracks

```bash
curl "https://tiktok-scraper.deletion-backup782.workers.dev/top-tracks?limit=20"
```

## Automatic Enrichment Pipeline

**Cascading enrichment flow:**
1. **TikTok scrape**: Worker extracts `spotify_track_id` from TikTok metadata
2. **Spotify enrichment**: Automatically fetches missing track data (title, artists, ISRC, album, popularity)
3. **Genius enrichment**: After Spotify enrichment, searches Genius for lyrics metadata with artist validation
4. All enrichment runs in background, doesn't block scraping response

**Spotify enrichment:**
- Batch processing: 50 tracks per request
- Failed/deleted tracks are skipped

**Genius enrichment:**
- Artist-validated matching (normalizes artist names for accurate matches)
- Title cleaning (removes "Remastered", "Live", etc. suffixes)
- Rate limiting: 100ms delay between requests
- Only enriches tracks that have Spotify metadata

## SQL Queries

### Tracks with full metadata (Spotify + Genius)

```sql
SELECT
  v.video_id,
  v.play_count,
  s.title,
  s.artists,
  s.album,
  s.isrc,
  s.popularity,
  g.genius_song_id,
  g.artist_name,
  g.url as genius_url
FROM tiktok_scraped_videos v
JOIN spotify_tracks s ON v.spotify_track_id = s.spotify_track_id
LEFT JOIN genius_songs g ON s.spotify_track_id = g.spotify_track_id
WHERE v.copyright_status = 'copyrighted'
ORDER BY v.play_count DESC
LIMIT 20;
```

### Top tracks by total views

```sql
SELECT
  s.spotify_track_id,
  s.title,
  s.artists,
  s.isrc,
  COUNT(*) as video_count,
  SUM(v.play_count) as total_views
FROM tiktok_scraped_videos v
JOIN spotify_tracks s ON v.spotify_track_id = s.spotify_track_id
GROUP BY s.spotify_track_id, s.title, s.artists, s.isrc
ORDER BY total_views DESC
LIMIT 20;
```

### Find unenriched tracks

```sql
SELECT DISTINCT v.spotify_track_id
FROM tiktok_scraped_videos v
LEFT JOIN spotify_tracks s ON v.spotify_track_id = s.spotify_track_id
WHERE v.spotify_track_id IS NOT NULL
  AND s.spotify_track_id IS NULL;
```

## Batch Scraping (Free Tier)

Cloudflare Workers free tier has 50 subrequests limit. Use the batch script:

```bash
cd cloudflare-worker-scraper
./scripts/scrape-all.sh creator_handle 30
```

This automatically:
- Scrapes in batches of 30 videos
- Waits 2s between requests
- Handles pagination
- Auto-enriches Spotify tracks after each batch

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev

# Deploy
bun run deploy

# View logs
bun run tail
```

## Next Steps

1. **Track history** - monitor play count changes over time
2. **Analytics API** - trending tracks, growth metrics
3. **Webhook notifications** - alert on viral videos
4. **Lyrics scraping** - fetch full lyrics from Genius URLs
