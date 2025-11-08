-- Migration: Clean up grc20_works table
-- Remove mutable metrics and misplaced recording-specific data
-- Date: 2025-11-01
--
-- NOTE: All streaming URL columns in grc20_works are currently empty (0 rows with data),
-- so no data migration is needed. The URLs already exist properly in grc20_work_recordings.

BEGIN;

-- ============================================
-- STEP 1: Drop mutable metrics columns
-- These change over time and shouldn't be in immutable GRC-20
-- ============================================

-- Genius mutable metrics (all empty currently)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_pyongs_count;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_annotation_count;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_pageviews;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS genius_lyrics_state;

-- Spotify mutable metrics (all empty currently)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS spotify_play_count;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS spotify_popularity;

-- ============================================
-- STEP 2: Drop recording-specific columns
-- These belong in grc20_work_recordings, not works
-- ============================================

-- Audio characteristics (empty, recording-specific)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS tempo_bpm;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS key_signature;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS duration_ms;

-- Production credits (empty, should be in separate table if needed)
ALTER TABLE grc20_works DROP COLUMN IF EXISTS producers;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS bmi_writers;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS bmi_publishers;

-- Unclear/sparse columns
ALTER TABLE grc20_works DROP COLUMN IF EXISTS work_type;

-- ============================================
-- STEP 3: Drop all streaming service URLs
-- These are recording-specific, belong in grc20_work_recordings
-- All columns are currently empty (verified), no data loss
-- ============================================

-- Streaming platforms
ALTER TABLE grc20_works DROP COLUMN IF EXISTS spotify_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS apple_music_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS amazon_music_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS deezer_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS tidal_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS qobuz_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS youtube_music_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS melon_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS maniadb_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS mora_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS itunes_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS beatport_url;

-- Video platforms
ALTER TABLE grc20_works DROP COLUMN IF EXISTS youtube_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS imvdb_url;

-- Social/community platforms
ALTER TABLE grc20_works DROP COLUMN IF EXISTS lastfm_url;
ALTER TABLE grc20_works DROP COLUMN IF EXISTS setlistfm_url;

-- Other URLs (keeping reference URLs like MusicBrainz, Wikidata, etc.)
-- These are for authoritative music databases, not consumer streaming

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check remaining columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'grc20_works'
ORDER BY ordinal_position;

-- Verify streaming URLs were migrated
SELECT
  'grc20_work_recordings' as table_name,
  COUNT(*) as total_rows,
  COUNT(spotify_url) as has_spotify,
  COUNT(apple_music_url) as has_apple,
  COUNT(deezer_url) as has_deezer,
  COUNT(tidal_url) as has_tidal,
  COUNT(amazon_music_url) as has_amazon
FROM grc20_work_recordings;
