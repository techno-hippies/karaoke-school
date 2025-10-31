-- Migration 015: Add manual handle override column
-- Purpose: Allow manual corrections when both Genius and MusicBrainz are wrong

ALTER TABLE grc20_artists ADD COLUMN IF NOT EXISTS handle_overrides JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN grc20_artists.handle_overrides IS 'Manual handle overrides for cases where both Genius and MusicBrainz are incorrect. Format: {"instagram": "correcthandle", "facebook": "anotherhandle"}. Takes precedence over all other sources.';
