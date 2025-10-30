/**
 * Fix Social Media Data Quality Issues in grc20_artists
 * 
 * Problems addressed:
 * 1. youtube_channel has broken values like "channel" or "user" instead of actual IDs
 * 2. twitter_handle, tiktok_handle may have similar issues
 * 3. apple_music_url, deezer_url, tidal_url columns exist but are always NULL (no data source)
 * 
 * Solution:
 * - Re-sync social handles from musicbrainz_artists (authoritative source)
 * - Construct platform URLs from existing IDs where possible
 */

-- ============================================================================
-- STEP 1: Fix YouTube Channels (re-sync from MusicBrainz)
-- ============================================================================

UPDATE grc20_artists ga
SET youtube_channel = ma.youtube_channel
FROM musicbrainz_artists ma
WHERE 
  ma.genius_slug = LOWER(REGEXP_REPLACE(ga.genius_url, 'https://genius.com/artists/', ''))
  AND ma.youtube_channel IS NOT NULL
  AND ma.youtube_channel != '';

-- ============================================================================
-- STEP 2: Fix Twitter Handles (re-sync from MusicBrainz)
-- ============================================================================

UPDATE grc20_artists ga
SET twitter_handle = ma.twitter_handle
FROM musicbrainz_artists ma
WHERE 
  ma.genius_slug = LOWER(REGEXP_REPLACE(ga.genius_url, 'https://genius.com/artists/', ''))
  AND ma.twitter_handle IS NOT NULL
  AND ma.twitter_handle != '';

-- ============================================================================
-- STEP 3: Fix TikTok Handles (re-sync from MusicBrainz)
-- ============================================================================

UPDATE grc20_artists ga
SET tiktok_handle = ma.tiktok_handle
FROM musicbrainz_artists ma
WHERE 
  ma.genius_slug = LOWER(REGEXP_REPLACE(ga.genius_url, 'https://genius.com/artists/', ''))
  AND ma.tiktok_handle IS NOT NULL
  AND ma.tiktok_handle != '';

-- ============================================================================
-- STEP 4: Construct Platform URLs from Spotify ID
-- ============================================================================

-- Apple Music URLs (format: https://music.apple.com/artist/{artist-name-slug}/{spotify-id})
-- Note: Apple Music doesn't have direct Spotify ID mapping, so we'll leave this NULL for now
-- TODO: Add apple_music_id column and populate from API

-- Deezer URLs (format: https://www.deezer.com/artist/{deezer-id})
-- Note: Deezer doesn't have direct Spotify ID mapping, so we'll leave this NULL for now
-- TODO: Add deezer_id column and populate from API

-- Tidal URLs (format: https://tidal.com/browse/artist/{tidal-id})
-- Note: Tidal doesn't have direct Spotify ID mapping, so we'll leave this NULL for now
-- TODO: Add tidal_id column and populate from API

-- For now, we can only construct URLs for platforms where we have native IDs
-- Spotify URL is already populated correctly

-- ============================================================================
-- STEP 5: Verify Fixes
-- ============================================================================

-- Check fixed YouTube channels
SELECT 
  'YouTube Channels Fixed' as status,
  COUNT(*) as total,
  COUNT(youtube_channel) as has_value,
  COUNT(*) FILTER (WHERE youtube_channel = 'channel' OR youtube_channel = 'user') as still_broken
FROM grc20_artists;

-- Check fixed Twitter handles
SELECT 
  'Twitter Handles Fixed' as status,
  COUNT(*) as total,
  COUNT(twitter_handle) as has_value
FROM grc20_artists;

-- Check fixed TikTok handles
SELECT 
  'TikTok Handles Fixed' as status,
  COUNT(*) as total,
  COUNT(tiktok_handle) as has_value
FROM grc20_artists;

-- Check platform URLs (expected: all NULL for apple/deezer/tidal)
SELECT 
  'Platform URLs' as status,
  COUNT(apple_music_url) as has_apple,
  COUNT(deezer_url) as has_deezer,
  COUNT(tidal_url) as has_tidal
FROM grc20_artists;

-- ============================================================================
-- STEP 6: Sample Output
-- ============================================================================

SELECT 
  name,
  youtube_channel,
  twitter_handle,
  tiktok_handle,
  spotify_url,
  apple_music_url,
  deezer_url,
  tidal_url
FROM grc20_artists
WHERE youtube_channel IS NOT NULL OR twitter_handle IS NOT NULL
LIMIT 10;
