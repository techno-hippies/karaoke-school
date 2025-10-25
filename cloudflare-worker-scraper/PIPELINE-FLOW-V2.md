# Complete Enrichment & Audio Download Pipeline v2.0

## 🎯 Overview - OPTIMIZED WITH ISWC GATE

This is the OPTIMIZED pipeline that implements an **ISWC-first gate**:

**Key Change**: We now check for ISWC **immediately after getting ISRC** (Step 2), and ONLY continue with expensive enrichment (Genius, artists, etc.) if ISWC is found.

**Why**: Without ISWC, tracks cannot be licensed or used for karaoke. The old pipeline wasted API quota enriching tracks that would never be viable.

---

## 📊 New Pipeline Stages

### **Stage 1: Spotify Tracks** (gets ISRC)
- Fetches track metadata from Spotify API
- **CRITICAL**: Gets ISRC (required for ISWC lookup)
- Stores: title, artists, ISRC, album

### **Stage 2: ISWC Lookup** 🚨 **CRITICAL GATE**
- **Sequential lookup** (fast → slow):
  1. **Try MusicBrainz** (fast, ~40% success)
     - Search by ISRC
     - Get recording → work relations → ISWC
  2. **Try Quansic** (slow, ~85% success)
     - ISRC → ISWC mapping via Quansic service
  3. **Try MLC** (medium, ~60% success)
     - ISRC search in MLC database

- **Updates**: `spotify_tracks.has_iswc` = true/false, `iswc_source` = 'musicbrainz'|'quansic'|'mlc'

- **Decision Point**:
  - ✅ **If ISWC found**: Continue to Stage 3
  - ❌ **If NO ISWC**: Stop enrichment (track not viable)

### **Stage 3-6: Deep Enrichment** (ONLY if has_iswc = true)
All subsequent enrichment **only runs for tracks with `has_iswc = true`**:

3. **Spotify Artists** - genres, followers, popularity
4. **Genius Songs** - social verification (Instagram, Twitter, verified status)
5. **Genius Artists** - artist social media, followers
6. **Genius Referents** - lyrics annotations
7. **MusicBrainz Artists** - ISNI, IPI, country
8. **Quansic Artists** - IPN, Luminate ID

### **Manual Enrichment**
- **MLC Licensing** (`POST /enrich-mlc-by-iswc`) - Writers, publishers, total_publisher_share ≥98%

---

## 🔄 Complete Flow Diagram

```
TikTok Videos (copyrighted)
  ↓
Spotify Track (get ISRC)
  ↓
🔍 ISWC Lookup (CRITICAL GATE)
  ├─ Try MusicBrainz (fast)
  ├─ If not found: Try Quansic (slow)
  └─ If not found: Try MLC (medium)
  ↓
Update: has_iswc = true/false
  ↓
╔════════════════════════════════╗
║  IF has_iswc = false:          ║
║  ❌ STOP (track not viable)    ║
╚════════════════════════════════╝
  ↓
╔════════════════════════════════╗
║  IF has_iswc = true:           ║
║  ✅ Continue enrichment        ║
╚════════════════════════════════╝
  ↓
Spotify Artists (filtered by has_iswc)
  ↓
Genius Songs (filtered by has_iswc)
  ↓
Genius Artists + Referents
  ↓
MusicBrainz Artists (filtered by has_iswc)
  ↓
Quansic Artists (filtered by has_iswc)
  ↓
MLC Licensing (manual trigger)
  ↓
Ready Check: has_iswc = true AND MLC ≥98%
  ↓
Audio Download → Grove → Neon DB
```

---

## 🎯 Key Improvements

| Old Pipeline | New Pipeline (v2.0) |
|--------------|---------------------|
| Enrich ALL tracks → check ISWC later | Check ISWC FIRST → only enrich viable tracks |
| Wasted API quota on non-viable tracks | Only enriches tracks with ISWC (90-95% found) |
| ISWC lookup was manual (`/enrich-quansic-recordings`) | ISWC lookup is automatic (Step 2) |
| Complex queries checking multiple ISWC sources | Simple query: `WHERE has_iswc = true` |
| Slow to identify viable tracks | Immediately know which tracks are viable |

---

## 📍 Database Schema Changes

### `spotify_tracks` table (NEW columns)
```sql
ALTER TABLE spotify_tracks
ADD COLUMN has_iswc BOOLEAN DEFAULT NULL,
ADD COLUMN iswc_source TEXT;  -- 'musicbrainz', 'quansic', or 'mlc'

CREATE INDEX idx_spotify_tracks_has_iswc
ON spotify_tracks(has_iswc)
WHERE has_iswc = true;
```

### Query Simplification

**OLD** (complex, multiple JOINs):
```sql
SELECT st.*
FROM spotify_tracks st
LEFT JOIN quansic_recordings qr ON st.isrc = qr.isrc
LEFT JOIN musicbrainz_recordings mr ON st.spotify_track_id = mr.spotify_track_id
LEFT JOIN musicbrainz_works mw ON ...
WHERE (qr.iswc IS NOT NULL OR mw.iswc IS NOT NULL)
```

**NEW** (simple, indexed):
```sql
SELECT st.*
FROM spotify_tracks st
WHERE st.has_iswc = true  -- Fast index lookup!
```

---

## 🚀 API Endpoints

### Enrichment (Automatic)
- `POST /enrich` - Spotify tracks
- **`POST /enrich` also triggers ISWC lookup** (Step 2)
- `POST /enrich-artists` - Spotify artists (only for tracks with ISWC)
- `POST /enrich-genius` - Genius songs (only for tracks with ISWC)
- `POST /enrich-musicbrainz?type=artists` - MusicBrainz artists (only for tracks with ISWC)
- `POST /enrich-quansic` - Quansic artists (only for tracks with ISWC)

### Enrichment (Manual - Required for Audio)
- `POST /enrich-mlc-by-iswc?limit=5` - Licensing data (writers, publishers, ≥98%)

### Audio Download
- `GET /audio/ready-for-download?limit=20` - List tracks ready (has_iswc = true AND MLC ≥98%)
- `POST /audio/download-tracks?limit=5` - Download → Grove → Neon
- `GET /audio/status/:spotify_track_id` - Check audio file status
- `GET /audio/stats` - Download statistics

### Monitoring
- `GET /cascade-status?handle=:handle` - View enrichment completion %
- `GET /enrichment-queue` - Show pending items per stage

---

## 📊 Expected ISWC Success Rates

Based on sequential lookup:

| Source | Success Rate | Speed | When Used |
|--------|--------------|-------|-----------|
| MusicBrainz | ~40% | Fast (1 req/sec) | Try first |
| Quansic | ~85% | Slow (200ms delay) | If MB fails |
| MLC | ~60% | Medium | If both fail |
| **Combined** | **~90-95%** | Variable | Sequential |

**Result**: 90-95% of copyrighted tracks should get ISWC, with fast tracks (MB hit) exiting early and slow Quansic only used when needed.

---

## 🎓 Best Practices

### Enrichment Strategy
1. **Scrape TikTok creator** - Triggers automatic enrichment
2. **Wait 10-15 seconds** - Background enrichment runs
3. **Check cascade status** - See ISWC lookup results
4. **Manually trigger MLC** - Get licensing data for viable tracks
5. **Download audio** - Only for tracks with ISWC + MLC ≥98%

### Monitoring
```bash
# 1. Scrape creator
curl "https://tiktok-scraper.deletion-backup782.workers.dev/scrape/gioscottii?limit=10"

# 2. Check which tracks have ISWC (automatic from Step 2)
curl "https://tiktok-scraper.deletion-backup782.workers.dev/cascade-status?handle=gioscottii"

# 3. Trigger MLC licensing (manual)
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/enrich-mlc-by-iswc?limit=5"

# 4. Check ready for audio download
curl "https://tiktok-scraper.deletion-backup782.workers.dev/audio/ready-for-download?limit=10"

# 5. Download audio
curl -X POST "https://tiktok-scraper.deletion-backup782.workers.dev/audio/download-tracks?limit=5"
```

---

## 🔍 ISWC Lookup Implementation

### Code Location
`/src/routes/scraper.ts` - `runEnrichmentPipeline()` function

### Logic
```typescript
// Step 2: ISWC LOOKUP (CRITICAL GATE)
const tracksNeedingIswc = await db.sql`
  SELECT spotify_track_id, title, isrc
  FROM spotify_tracks
  WHERE isrc IS NOT NULL AND has_iswc IS NULL
  LIMIT 20
`;

for (const track of tracksNeedingIswc) {
  let iswc: string | null = null;
  let iswcSource: string | null = null;

  // Try 1: MusicBrainz (fast)
  const mbResult = await musicbrainz.searchRecordingByISRC(track.isrc);
  if (mbResult && hasWorkWithIswc(mbResult)) {
    iswc = extractIswc(mbResult);
    iswcSource = 'musicbrainz';
  }

  // Try 2: Quansic (if MB failed)
  if (!iswc && env.QUANSIC_SERVICE_URL) {
    const quansicResult = await quansic.enrichRecording(track.isrc);
    if (quansicResult?.iswc) {
      iswc = quansicResult.iswc;
      iswcSource = 'quansic';
    }
  }

  // Try 3: MLC (if both failed)
  if (!iswc) {
    const mlcResult = await mlc.searchByIsrc(track.isrc);
    if (mlcResult?.iswc) {
      iswc = mlcResult.iswc;
      iswcSource = 'mlc';
    }
  }

  // Update track
  await db.sql`
    UPDATE spotify_tracks
    SET has_iswc = ${!!iswc}, iswc_source = ${iswcSource}
    WHERE spotify_track_id = ${track.spotify_track_id}
  `;
}
```

---

## 📊 Pipeline Metrics

Track pipeline health:

```sql
-- Tracks by ISWC status
SELECT
  has_iswc,
  iswc_source,
  COUNT(*) as count
FROM spotify_tracks
WHERE isrc IS NOT NULL
GROUP BY has_iswc, iswc_source;

-- Tracks ready for audio download
SELECT COUNT(*) as ready_count
FROM spotify_tracks st
JOIN mlc_works mlw ON st.isrc = (
  SELECT isrc FROM mlc_recordings WHERE mlc_song_code = mlw.mlc_song_code LIMIT 1
)
WHERE st.has_iswc = true
  AND mlw.total_publisher_share >= 98;
```

---

## 🎨 Visual Summary

```
┌─────────────────────────────────────────────────────┐
│          ENRICHMENT PIPELINE v2.0                   │
│          WITH ISWC-FIRST GATE                       │
└─────────────────────────────────────────────────────┘

Step 1: TikTok Videos → Spotify Tracks (ISRC)
         ↓
Step 2: ISWC Lookup 🚨 GATE
         ├─ MusicBrainz (fast) → ✓ 40%
         ├─ Quansic (slow) → ✓ 85%
         └─ MLC (medium) → ✓ 60%
         ↓
      has_iswc flag set
         ↓
    ┌────────────────┐
    │ has_iswc?      │
    └────────────────┘
         ├─ NO → ❌ STOP (save API quota)
         └─ YES → ✅ CONTINUE
                    ↓
Step 3-6: Deep Enrichment (artists, genius, etc.)
         ↓
Step 7: MLC Licensing (manual)
         ↓
Step 8: Ready Check (has_iswc + MLC ≥98%)
         ↓
Step 9: Audio Download → Grove → Neon
```

---

## ⚙️ Configuration

No new secrets required! Uses existing:
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `GENIUS_API_KEY`
- `QUANSIC_SERVICE_URL` (for Quansic ISRC lookup)
- `FREYR_SERVICE_URL` (for audio download)
- `ACOUSTID_API_KEY` (for audio verification)

---

## 📝 License

Private - Karaoke School V1 Project
