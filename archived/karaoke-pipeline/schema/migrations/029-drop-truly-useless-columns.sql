-- Migration: Drop only truly useless columns from grc20_works
-- Date: 2025-11-01
--
-- Critical thinking applied: Only drop columns that are either:
-- 1. Meaningless (all same value)
-- 2. Redundant (derived from other columns)
-- 3. Empty and will never be populated

-- ============================================
-- DEFINITELY USELESS - DROP THESE
-- ============================================

-- genius_featured_video: All 39 rows = false, meaningless
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_featured_video;

-- musicbrainz_url: Redundant - can be derived from mbid
-- Formula: https://musicbrainz.org/work/{mbid}
ALTER TABLE grc20_works DROP COLUMN IF EXISTS musicbrainz_url;

-- last_edit_cid: Empty (0/39), unclear purpose, no plan to populate
ALTER TABLE grc20_works DROP COLUMN IF EXISTS last_edit_cid;

-- ============================================
-- KEEP THESE (empty but will be populated)
-- ============================================

-- grc20_entity_id: CRITICAL - will be populated when work is minted to GRC-20
--   Used by grc20_works_blocked view to show unminted works
-- minted_at: CRITICAL - timestamp of when work was minted to GRC-20

-- ============================================
-- KEEP THESE (work-level metadata)
-- ============================================

-- iswc, iswc_source: Industry standard work identifier (23/39 populated, goal: 100%)
-- mbid: MusicBrainz work ID (11/39, authoritative source)
-- genius_song_id: Genius work ID (35/39, good coverage)
-- composers, lyricists: Work-level credits (sparse but should be populated)
-- language: Work language (35/39, should be 100%)
-- genres: Work genres (15/39, acceptable)
-- alternate_titles: Useful for matching (4/39, as needed)
-- featured_artists: Work-level featured artists (9/39, as needed)
-- needs_update: Operational flag for data quality

-- ============================================
-- FINAL SCHEMA (20 columns)
-- ============================================
-- id, title, alternate_titles, iswc, iswc_source, mbid, genius_song_id,
-- primary_artist_id, primary_artist_name, featured_artists, composers, lyricists,
-- language, genres, explicit_content, grc20_entity_id, minted_at, needs_update,
-- created_at, updated_at
