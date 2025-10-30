/**
 * Complete Fix for Social Media Data Quality Issues
 * 
 * Root cause: The MusicBrainz enrichment regex was returning match[1] (the "channel" part)
 * instead of match[2] (the actual ID) for YouTube URLs.
 * 
 * This script fixes BOTH the source data (musicbrainz_artists) AND derived data (grc20_artists).
 */

-- ============================================================================
-- STEP 1: Fix YouTube Channels in musicbrainz_artists (Source Table)
-- ============================================================================

-- Extract correct YouTube channel IDs from raw_data JSONB
UPDATE musicbrainz_artists
SET youtube_channel = (
  SELECT REGEXP_REPLACE(
    jsonb_array_element->>'url',
    'https?://(?:www\.)?youtube\.com/(channel|c|user)/([^/?#]+).*',
    '\2'
  )
  FROM jsonb_array_elements(raw_data->'relations') AS jsonb_array_element
  WHERE 
    jsonb_array_element->>'url' LIKE '%youtube.com%'
    AND jsonb_array_element->>'url' ~ 'youtube\.com/(channel|c|user)/[^/?#]+'
  LIMIT 1
)
WHERE 
  raw_data IS NOT NULL
  AND (
    youtube_channel IN ('channel', 'user', 'c')
    OR youtube_channel IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw_data->'relations') AS rel
    WHERE rel->>'url' LIKE '%youtube.com%'
  );

-- ============================================================================
-- STEP 2: Re-run Corroboration for grc20_artists
-- ============================================================================

-- Since only 3 artists have MusicBrainz data, we need to delete and recreate grc20_artists
-- OR manually update the broken records

-- Option A: Delete and re-run corroboration (recommended)
-- TRUNCATE grc20_artists;
-- Then run: bun run corroborate

-- Option B: Fix individual broken records
UPDATE grc20_artists
SET youtube_channel = NULL
WHERE youtube_channel IN ('channel', 'user', 'c');

-- ============================================================================
-- STEP 3: Verify Fixes
-- ============================================================================

SELECT 
  'musicbrainz_artists YouTube fix' as status,
  COUNT(*) as total,
  COUNT(youtube_channel) as has_channel,
  COUNT(*) FILTER (WHERE youtube_channel IN ('channel', 'user', 'c')) as still_broken
FROM musicbrainz_artists;

SELECT 
  'grc20_artists YouTube fix' as status,
  COUNT(*) as total,
  COUNT(youtube_channel) as has_channel,
  COUNT(*) FILTER (WHERE youtube_channel IN ('channel', 'user', 'c')) as still_broken
FROM grc20_artists;

-- ============================================================================
-- STEP 4: Platform URLs Status
-- ============================================================================

SELECT 
  'Platform URLs (expected: all NULL)' as status,
  COUNT(apple_music_url) as has_apple,
  COUNT(deezer_url) as has_deezer,
  COUNT(tidal_url) as has_tidal
FROM grc20_artists;

-- ============================================================================
-- NOTES
-- ============================================================================

/*
 * Apple Music, Deezer, Tidal URLs:
 * - These platforms require platform-specific IDs that we don't currently collect
 * - Columns exist in schema but will remain NULL until we add enrichment for these platforms
 * - Potential future enrichment sources:
 *   - MusicBrainz URL relations (some artists have these)
 *   - Spotify API (doesn't provide these)
 *   - Platform-specific APIs (Apple Music API, Deezer API, etc.)
 */
