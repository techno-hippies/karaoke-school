-- Migration 060: Drop unused musicbrainz_artists columns
-- These columns were never populated and are architectural debt:
--   - isni (TEXT): Always NULL, use isnis[0] instead
--   - spotify_artist_id (TEXT): Always NULL, never passed to upsertMBArtistSQL()
--
-- The JSONB arrays (isnis, ipis) are actively used and remain.

ALTER TABLE musicbrainz_artists
  DROP COLUMN IF EXISTS isni,
  DROP COLUMN IF EXISTS spotify_artist_id;

-- Verify remaining columns
-- Expected: artist_mbid, name, artist_type, country, begin_area,
--           urls, enriched_at, genres, tags, isnis, ipis, gender,
--           birth_date, social_media, streaming, all_urls, aliases, member_relations
