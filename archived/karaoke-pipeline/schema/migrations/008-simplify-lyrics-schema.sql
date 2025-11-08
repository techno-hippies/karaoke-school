-- Migration: Simplify lyrics schema
-- Drop unused columns and rename for clarity

-- Drop unused columns
ALTER TABLE song_lyrics DROP COLUMN IF EXISTS lyrics;
ALTER TABLE song_lyrics DROP COLUMN IF EXISTS synced_lrc;
ALTER TABLE song_lyrics DROP COLUMN IF EXISTS lrc_duration_ms;

-- Rename columns for clarity
ALTER TABLE song_lyrics RENAME COLUMN lrclib_plain_text TO lrclib_lyrics;
ALTER TABLE song_lyrics RENAME COLUMN lyrics_ovh_plain_text TO ovh_lyrics;
ALTER TABLE song_lyrics RENAME COLUMN normalized_plain_text TO normalized_lyrics;

-- Update source enum to include 'needs_review'
-- (PostgreSQL doesn't have enum here, but document valid values)
COMMENT ON COLUMN song_lyrics.source IS 'Valid values: lrclib, ovh, lrclib+ovh, normalized, needs_review';

-- Final schema:
-- lrclib_lyrics      TEXT    - raw from LRCLIB (audit trail)
-- ovh_lyrics         TEXT    - raw from Lyrics.ovh (audit trail)
-- normalized_lyrics  TEXT    - AI processed output (NULL if needs manual review)
-- source            TEXT    - decision path
-- normalized_by     TEXT    - 'gemini_flash_2_5' or NULL
-- confidence_score  NUMERIC - similarity score (flags <0.80 for review)
-- language_data     JSONB   - detected languages
