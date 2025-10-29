# Genius Integration

Complete integration of Genius API for lyrics metadata corroboration.

## What It Does

Enriches tracks with Genius metadata including:
- ✅ **Complete song metadata** (language, release date, lyrics state, annotation counts)
- ✅ **Full artist data** (social media handles, verification status, followers)
- ✅ **Referents** (lyrics annotations with community votes and comments)

## Database Tables

### `genius_songs`
Complete song metadata linked to Spotify tracks:
- Primary identifiers: genius_song_id, spotify_track_id
- Metadata: language, release_date, lyrics_state
- Engagement: annotation_count, pyongs_count
- Full raw_data JSONB

### `genius_artists`
Artist profiles with social media:
- Social: instagram_name, twitter_name, facebook_name
- Verification: is_verified, is_meme_verified
- Engagement: followers_count
- Alternate names array

### `genius_song_referents`
Lyrics annotations (community engagement):
- fragment: The lyric snippet being annotated
- classification: verified/unverified/contributor
- votes_total, comment_count
- annotations JSONB array

## Pipeline Integration

**Step 7: Genius Enrichment**
- **Status**: `lyrics_ready`, `audio_downloaded`, `alignment_complete`
- **Placement**: After lyrics discovery, before/during audio processing
- **Type**: Parallel enrichment (doesn't change pipeline status)
- **Rate limit**: 100ms between requests

### Run Standalone
```bash
# Process 20 tracks
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- bun src/processors/07-genius-enrichment.ts 20
```

### Run via Orchestrator
```bash
# Run all steps including Genius
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- bun run-pipeline.ts --all --limit=10

# Run Genius step only
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- bun run-pipeline.ts --step=7 --limit=20
```

## Artist Matching Algorithm

Uses **fuzzy normalization** to validate matches:
1. Remove non-alphanumeric characters from both names
2. Convert to lowercase
3. Check bidirectional substring match (handles "Macklemore & Ryan Lewis" → "Macklemore")

## Current Stats

- **21 tracks** matched to Genius (84% success rate)
- **20 songs** with full metadata
- **19 unique artists** with social profiles
- **126 referents** (lyrics annotations)

## API Requirements

Set `GENIUS_API_KEY` in `.env`:
```bash
dotenvx set GENIUS_API_KEY your_token_here -f .env
```

Get your key: https://genius.com/api-clients

## Data Quality

**Corroboration Sources:**
- ✅ Genius API search validates artist names
- ✅ Fuzzy matching prevents false positives
- ✅ Annotation counts indicate data quality
- ❌ No MusicBrainz cross-validation (no Genius URLs in MB data)

**Quality Signals:**
- `is_verified`: Artist verification status
- `annotation_count`: Community engagement level
- `pyongs_count`: User appreciation metric
- `votes_total` (referents): Community validation

## Schema Migrations

Created tables via:
- `schema/migrations/002-create-genius-tables.sql`

## Testing

Test full data storage:
```bash
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- bun test-genius-full-storage.ts
```

Backfill existing matches:
```bash
NEON_PROJECT_ID=frosty-smoke-70266868 dotenvx run -f .env -- bun backfill-genius-data.ts
```

## Files

- `src/processors/07-genius-enrichment.ts` - Main processor
- `src/services/genius.ts` - Genius API client
- `src/db/genius.ts` - Database operations
- `schema/migrations/002-create-genius-tables.sql` - Schema
- `backfill-genius-data.ts` - Backfill script
- `test-genius-full-storage.ts` - Test script

## Next Steps

When adding more enrichment:
- Artist images from Genius
- Genius artist IDs could link to GRC-20 artists
- Referents could power lyrics annotations in UI
- Social media handles for artist verification
