-- Migration 007: Cleanup Lyrics Table
-- Date: 2025-10-30
-- Description: Clean up song_lyrics table by removing dead/redundant columns and renaming for clarity
--
-- Changes:
-- 1. Rename selected_plain_text → lyrics (simpler, clearer)
-- 2. Drop grove_cid (dead column, never used)
-- 3. Drop raw_sources (redundant, replaced by dedicated columns)

-- Step 1: Rename selected_plain_text to lyrics
ALTER TABLE song_lyrics
  RENAME COLUMN selected_plain_text TO lyrics;

-- Step 2: Drop dead column (grove_cid never used)
ALTER TABLE song_lyrics
  DROP COLUMN grove_cid;

-- Step 3: Drop redundant column (raw_sources replaced by lrclib_plain_text + lyrics_ovh_plain_text)
ALTER TABLE song_lyrics
  DROP COLUMN raw_sources;

-- Step 4: Drop index for removed column
DROP INDEX IF EXISTS idx_lyrics_grove;

-- Verification queries:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'song_lyrics' ORDER BY ordinal_position;
-- SELECT COUNT(*) as total, COUNT(lyrics) as has_lyrics, COUNT(lrclib_plain_text) as has_lrclib FROM song_lyrics;
