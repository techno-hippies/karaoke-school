-- Migration: Remove completely empty and useless columns from grc20_works
-- Date: 2025-11-01
--
-- Analysis shows 25 columns with 0/39 rows populated - completely useless

-- ============================================
-- COLUMNS TO DROP (0/39 rows with data):
-- ============================================

-- ISRC - recording-specific, not work-specific, should be in grc20_work_recordings if needed
ALTER TABLE grc20_works DROP COLUMN IF EXISTS isrc;

-- BMI/ASCAP work IDs - completely empty, we have iswc which is the international standard
ALTER TABLE grc20_works DROP COLUMN IF EXISTS bmi_work_id;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS ascap_work_id;

-- Spotify track ID - this is recording-specific, should be in grc20_work_recordings
-- (A work can have multiple recordings on Spotify)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS spotify_track_id;

-- Discogs - this is release-specific, not work-specific
ALTER TABLE grc20_works DROP COLUMN IF EXISTS discogs_release_id;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS discogs_url;

-- Release date - work doesn't have a single release date, recordings do
ALTER TABLE grc20_works DROP COLUMN IF EXISTS release_date;

-- Disambiguation - empty, unclear purpose
ALTER TABLE grc20_works DROP COLUMN IF EXISTS disambiguation;

-- External URLs - all completely empty (0/39)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS wikidata_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS allmusic_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS secondhandsongs_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS whosampled_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS musixmatch_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS lrclib_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS lyrics_ovh_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS loc_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS bnf_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS worldcat_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS rateyourmusic_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS jaxsta_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS official_url;

-- Image fields - completely empty, images should be in grc20_work_recordings (recording-specific)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS image_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS image_source;

-- GRC-20 fields that are empty - these should only exist if minted
ALTER TABLE grc20_works DROP COLUMN IF EXISTS grc20_entity_id;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS minted_at;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS last_edit_cid;

-- ============================================
-- QUESTIONABLE COLUMN (populated but unclear):
-- ============================================

-- genius_featured_video - 39/39 rows populated but what is this? Boolean that doesn't make sense for works
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_featured_video;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check remaining columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'grc20_works'
ORDER BY ordinal_position;

-- Expected remaining columns (~18-20 columns):
-- - id
-- - title
-- - alternate_titles (4/39)
-- - iswc (23/39) - THE industry standard for works
-- - iswc_source (23/39)
-- - mbid (11/39) - MusicBrainz work ID
-- - musicbrainz_url (11/39)
-- - genius_song_id (35/39)
-- - primary_artist_id (39/39)
-- - primary_artist_name (39/39)
-- - featured_artists (9/39)
-- - composers (16/39)
-- - lyricists (2/39)
-- - language (35/39)
-- - genres (15/39)
-- - explicit_content (39/39)
-- - needs_update (39/39)
-- - created_at
-- - updated_at
