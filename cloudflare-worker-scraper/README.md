# TikTok Scraper & Music Enrichment API

**Version:** 2.0.0
**Architecture:** Hono + Modular Routes
**Deployed:** https://tiktok-scraper.deletion-backup782.workers.dev

A highly organized Cloudflare Worker that scrapes TikTok videos and automatically enriches music metadata through a cascading pipeline of industry-standard music databases.

---

## 🎯 What This Does

1. **Scrapes TikTok videos** with copyright detection and Spotify track IDs
2. **Automatically enriches** music metadata through a 7-stage pipeline:
   - TikTok Videos → Spotify Tracks → Genius Songs → MusicBrainz (Artists/Recordings/Works) → Quansic
3. **Stores everything** in Neon PostgreSQL with JSONB + indexed columns
4. **Normalizes track titles** with Gemini Flash 2.5 Lite for better matching
5. **Provides monitoring** to track enrichment cascade completion

---

## 📊 Architecture

```
┌─────────────────┐
│  TikTok Videos  │
└────────┬────────┘
         │ Spotify Track ID detection
         ↓
┌─────────────────┐
│ Spotify Tracks  │ ← Fetch track metadata (title, artists, ISRC, album)
└────────┬────────┘
         ├─→ Spotify Artists ← Fetch artist metadata (genres, followers)
         │                   │
         │                   ↓
         │         ┌──────────────────────┐
         │         │ MusicBrainz Artists  │ ← Match by name, get ISNI
         │         └──────────┬───────────┘
         │                    │
         │                    ↓
         │         ┌──────────────────────┐
         │         │  Quansic Artists     │ ← Enrich with IPN, Luminate ID
         │         └──────────────────────┘
         │
         ├─→ Genius Songs ← Match by normalized title/artist
         │
         └─→ MusicBrainz Recordings ← Match by ISRC
                    │
                    ↓
         ┌──────────────────────┐
         │ MusicBrainz Works    │ ← Composition info (ISWC)
         └──────────────────────┘
```

---

## 🚀 Quick Start

### Scrape a TikTok Creator
```bash
# Scrape 10 videos (auto-enriches in background)
curl "https://tiktok-scraper.deletion-backup782.workers.dev/scrape/gioscottii?limit=10"

# Scrape ALL videos (no limit)
curl "https://tiktok-scraper.deletion-backup782.workers.dev/scrape/idazeile"
```

### Monitor Enrichment Progress
```bash
# Check enrichment cascade for a creator
curl "https://tiktok-scraper.deletion-backup782.workers.dev/cascade-status?handle=gioscottii"

# View pending enrichment queue
curl "https://tiktok-scraper.deletion-backup782.workers.dev/enrichment-queue"
```

### Manual Enrichment Triggers
```bash
# Enrich Spotify tracks
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich?limit=50"

# Enrich MusicBrainz recordings
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich-musicbrainz?type=recordings&limit=10"

# Normalize tracks with Gemini and retry matching
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/normalize-and-match?limit=5"

# Enrich with Quansic (IPN, Luminate ID)
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich-quansic?limit=10"
```

---

## 📍 API Endpoints Reference

### **Scraper Routes**

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/scrape/:handle` | GET | Scrape TikTok videos (auto-enriches) | `/scrape/gioscottii?limit=10` |
| `/stats/:handle` | GET | Get creator statistics | `/stats/gioscottii` |
| `/top-tracks` | GET | Top Spotify tracks by views | `/top-tracks?limit=20` |

### **Enrichment Routes**

| Endpoint | Method | Description | Params |
|----------|--------|-------------|--------|
| `/enrich` | POST | Enrich Spotify tracks | `?limit=100` |
| `/enrich-artists` | POST | Enrich Spotify artists | `?limit=50` |
| `/enrich-musicbrainz` | POST | Enrich MusicBrainz data | `?type=artists\|recordings&limit=5` |
| `/enrich-genius` | POST | Enrich Genius songs | `?limit=50` |
| `/normalize-and-match` | POST | Normalize with Gemini + retry MB | `?limit=5` |
| `/enrich-quansic` | POST | Enrich with Quansic | `?limit=10` |

### **Monitoring Routes** 🔥

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/cascade-status` | GET | View enrichment completion % | `?handle=gioscottii` |
| `/enrichment-queue` | GET | Show pending items per stage | - |

---

## 📈 Cascade Status Example

```bash
curl "https://tiktok-scraper.deletion-backup782.workers.dev/cascade-status?handle=gioscottii"
```

**Response:**
```json
{
  "handle": "gioscottii",
  "cascade": [
    {
      "stage": "Spotify Tracks",
      "total": "6",
      "enriched": "5",
      "pct": "83.3"
    },
    {
      "stage": "Genius Songs",
      "total": "5",
      "enriched": "5",
      "pct": "100.0"
    },
    {
      "stage": "MusicBrainz Recordings",
      "total": "5",
      "enriched": "2",
      "pct": "40.0"
    },
    {
      "stage": "MusicBrainz Works",
      "total": "2",
      "enriched": "2",
      "pct": "100.0"
    }
  ]
}
```

---

## 🔍 Enrichment Queue Example

```bash
curl "https://tiktok-scraper.deletion-backup782.workers.dev/enrichment-queue"
```

**Response:**
```json
{
  "queue": {
    "spotify_tracks": {
      "count": 4,
      "sample": ["0jjZh3fHqW2JciT1b19oAN", "..."]
    },
    "musicbrainz_artists": {
      "count": 18,
      "sample": [
        {
          "name": "The Hollies",
          "spotify_id": "6waa8mKu91GjzD4NlONlNJ"
        }
      ]
    },
    "musicbrainz_recordings": {
      "count": 3,
      "sample": [
        {
          "title": "Aleph",
          "isrc": "FRZ111300562"
        }
      ]
    }
  },
  "summary": {
    "total_pending": 27
  }
}
```

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tiktok_creators` | Creator profiles | `tiktok_handle`, `name`, `follower_count` |
| `tiktok_scraped_videos` | Video metadata | `video_id`, `spotify_track_id`, `copyright_status`, `play_count` |
| `spotify_tracks` | Track metadata | `spotify_track_id`, `title`, `artists`, `isrc` |
| `spotify_artists` | Artist metadata | `spotify_artist_id`, `name`, `genres`, `popularity` |
| `genius_songs` | Genius enrichment | `genius_song_id`, `spotify_track_id`, `url` |
| `musicbrainz_artists` | MB artist data | `mbid`, `isnis`, `ipi`, `country` |
| `musicbrainz_recordings` | MB recording data | `recording_mbid`, `isrc`, `spotify_track_id` |
| `musicbrainz_works` | MB work/composition | `work_mbid`, `iswc`, `title` |
| `quansic_artists` | Quansic enrichment | `isni`, `ipn`, `luminate_id`, `name_variants` |

All tables use **JSONB** for raw API responses + **indexed columns** for fast queries.

---

## 🎨 Key Features

### ✅ **JSONB-First Schema**
- Stores complete API responses in `raw_data` JSONB column
- Extracts key fields as indexed columns for fast queries
- Never loses data, always queryable

### ✅ **Idempotent Upserts**
- All operations use `ON CONFLICT DO UPDATE`
- Safe to re-run scrapes without duplicates
- Last update timestamp tracked

### ✅ **Background Enrichment**
- Runs automatically after every scrape
- Non-blocking (doesn't slow down API responses)
- Processes 5-50 items per stage per scrape

### ✅ **Track Normalization**
- Uses Gemini Flash 2.5 Lite to normalize track titles
- Removes version suffixes: "Slowed Down", "Remaster", "Live at..."
- Improved MusicBrainz match rate from 15% → 84.6%

### ✅ **Rate Limiting**
- MusicBrainz: 1 request/second
- Genius: 100ms delay between requests
- Quansic: 200ms delay between requests
- Spotify: Batch requests (50 items max)

### ✅ **Batch Processing**
- Handles Cloudflare's 50 subrequest limit
- Chunks large operations
- Efficient API usage

---

## 🔧 Setup

### 1. Install Dependencies

```bash
cd cloudflare-worker-scraper
bun install
```

### 2. Set Secrets

```bash
wrangler secret put NEON_DATABASE_URL
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET
wrangler secret put GENIUS_API_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put QUANSIC_SESSION_COOKIE
```

### 3. Deploy

```bash
wrangler deploy
```

---

## 📦 Tech Stack

- **Runtime:** Cloudflare Workers (Edge)
- **Framework:** Hono (routing)
- **Database:** Neon PostgreSQL (serverless)
- **APIs:**
  - TikTok (unofficial API)
  - Spotify Web API
  - Genius API
  - MusicBrainz API
  - OpenRouter (Gemini Flash 2.5 Lite)
  - Quansic Explorer

---

## 🎯 Use Cases

### 1. **Track Popular Copyrighted Music on TikTok**
```bash
# Find top tracks by views
curl "https://tiktok-scraper.deletion-backup782.workers.dev/top-tracks?limit=10"
```

### 2. **Build Karaoke Catalog from Viral Videos**
- Scrape viral creators
- Get complete music metadata (ISRC, ISWC)
- Identify compositions for licensing

### 3. **Monitor Creator Statistics**
```bash
# Track follower/view growth
curl "https://tiktok-scraper.deletion-backup782.workers.dev/stats/gioscottii"
```

### 4. **Music Rights Research**
- Get ISNIs, IPNs, ISRCs, ISWCs
- Link recordings to works
- Find rights holders via Quansic

---

## 🔄 Enrichment Pipeline Workflow

### Automatic (Background)
Every time you scrape a creator, the worker automatically:
1. Fetches unenriched Spotify tracks (limit: 50)
2. Fetches unenriched Spotify artists (limit: 20)
3. Fetches unenriched Genius songs (limit: 20)
4. Fetches unenriched MusicBrainz artists (limit: 5)
5. Fetches unenriched MusicBrainz recordings (limit: 5)
6. Fetches unenriched Quansic artists (limit: 5)

### Manual (On-Demand)
When you need to backfill or prioritize specific enrichment:

```bash
# 1. Check what's pending
curl "https://tiktok-scraper.deletion-backup782.workers.dev/enrichment-queue"

# 2. Trigger specific enrichment
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich-musicbrainz?type=recordings&limit=20"

# 3. Verify progress
curl "https://tiktok-scraper.deletion-backup782.workers.dev/cascade-status?handle=gioscottii"
```

---

## 📊 Example: Complete Workflow

```bash
# 1. Scrape a creator
curl "https://tiktok-scraper.deletion-backup782.workers.dev/scrape/gioscottii?limit=10"
# Returns: 10 videos scraped, 5 copyrighted, background enrichment started

# 2. Wait 10-15 seconds for background enrichment

# 3. Check cascade status
curl "https://tiktok-scraper.deletion-backup782.workers.dev/cascade-status?handle=gioscottii"
# Returns:
# - Spotify Tracks: 83% enriched
# - Genius Songs: 100% enriched
# - MusicBrainz Recordings: 40% enriched

# 4. Manually trigger missing enrichment
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/normalize-and-match?limit=5"
# Normalizes titles with Gemini, retries MusicBrainz matching

# 5. Check again
curl "https://tiktok-scraper.deletion-backup782.workers.dev/cascade-status?handle=gioscottii"
# Returns: MusicBrainz Recordings now 100% enriched
```

---

## 🎓 Best Practices

### Cascade Management

1. **Monitor first**: Use `/cascade-status?handle=X` to identify gaps
2. **Prioritize bottlenecks**: If MusicBrainz is 0%, trigger `/enrich-musicbrainz`
3. **Use normalization**: For low match rates, use `/normalize-and-match`
4. **Let background work**: Automatic enrichment catches up over time

### Rate Limiting

- **MusicBrainz**: Slow (1 req/sec), use small batches (limit=5-10)
- **Spotify/Genius**: Fast, use larger batches (limit=50-100)
- **Quansic**: Medium (200ms delay), use medium batches (limit=10-20)

---

## 📝 SQL Queries

### Find unenriched tracks
```sql
SELECT DISTINCT v.spotify_track_id
FROM tiktok_scraped_videos v
LEFT JOIN spotify_tracks s ON v.spotify_track_id = s.spotify_track_id
WHERE v.spotify_track_id IS NOT NULL
  AND s.spotify_track_id IS NULL;
```

### Top copyrighted tracks
```sql
SELECT spotify_track_id, COUNT(*) as video_count, SUM(play_count) as total_views
FROM tiktok_scraped_videos
WHERE copyright_status = 'copyrighted'
GROUP BY spotify_track_id
ORDER BY total_views DESC
LIMIT 20;
```

### Artists with ISNIs but no Quansic data
```sql
SELECT ma.name, ma.isnis
FROM musicbrainz_artists ma
LEFT JOIN quansic_artists qa ON ma.isnis[1] = qa.isni
WHERE ma.isnis IS NOT NULL
  AND array_length(ma.isnis, 1) > 0
  AND qa.isni IS NULL;
```

---

## 🔗 Useful Links

- **API Root:** https://tiktok-scraper.deletion-backup782.workers.dev
- **Neon Dashboard:** https://console.neon.tech
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **MusicBrainz:** https://musicbrainz.org
- **Quansic Explorer:** https://explorer.quansic.com

---

## 📄 License

Private - Karaoke School V1 Project
