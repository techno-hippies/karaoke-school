-- Migration 006: Separate Lyrics Sources
-- Date: 2025-10-30
-- Description: Add separate columns for each lyrics source to prevent data loss during normalization
--
-- Problem: Previously, normalized lyrics would overwrite the original LRCLIB plain_text,
--          with raw sources only stored in JSONB. This made querying by source difficult
--          and risked data loss.
--
-- Solution: Store each source in dedicated columns (lrclib_plain_text, lyrics_ovh_plain_text, normalized_plain_text)
--          and track which version is actively used in selected_plain_text

-- Step 1: Add new columns for separate storage
ALTER TABLE song_lyrics
  ADD COLUMN IF NOT EXISTS lrclib_plain_text TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_ovh_plain_text TEXT,
  ADD COLUMN IF NOT EXISTS normalized_plain_text TEXT;

-- Step 2: Migrate existing data
-- For normalized lyrics, extract from raw_sources
UPDATE song_lyrics
SET
  lrclib_plain_text = (raw_sources->>'lrclib'),
  lyrics_ovh_plain_text = (raw_sources->>'lyrics_ovh'),
  normalized_plain_text = plain_text
WHERE normalized_by IS NOT NULL AND raw_sources IS NOT NULL;

-- For non-normalized lyrics, store in appropriate source column
UPDATE song_lyrics
SET
  lrclib_plain_text = CASE
    WHEN source IN ('lrclib', 'lrclib+lyrics_ovh') THEN plain_text
    ELSE NULL
  END,
  lyrics_ovh_plain_text = CASE
    WHEN source = 'lyrics_ovh' THEN plain_text
    ELSE NULL
  END
WHERE normalized_by IS NULL;

-- Step 3: Rename plain_text to selected_plain_text
ALTER TABLE song_lyrics
  RENAME COLUMN plain_text TO selected_plain_text;

-- Step 4: Add column comments for clarity
COMMENT ON COLUMN song_lyrics.selected_plain_text IS 'The lyrics version actively used by the app (points to one of: lrclib_plain_text, lyrics_ovh_plain_text, or normalized_plain_text)';
COMMENT ON COLUMN song_lyrics.lrclib_plain_text IS 'Original lyrics from LRCLIB (immutable)';
COMMENT ON COLUMN song_lyrics.lyrics_ovh_plain_text IS 'Original lyrics from Lyrics.ovh (immutable)';
COMMENT ON COLUMN song_lyrics.normalized_plain_text IS 'AI-normalized lyrics from Gemini Flash 2.5 (only set if normalized_by is not null)';
COMMENT ON COLUMN song_lyrics.raw_sources IS 'Deprecated: use lrclib_plain_text/lyrics_ovh_plain_text instead';

-- Step 5: Update source column to include 'normalized' as a valid value
-- (No ALTER needed, just documentation update)

-- Verification queries:
-- Check that data was migrated correctly:
-- SELECT spotify_track_id, source, normalized_by,
--        CASE WHEN lrclib_plain_text IS NOT NULL THEN 'has_lrclib' END,
--        CASE WHEN lyrics_ovh_plain_text IS NOT NULL THEN 'has_ovh' END,
--        CASE WHEN normalized_plain_text IS NOT NULL THEN 'has_normalized' END
-- FROM song_lyrics;
