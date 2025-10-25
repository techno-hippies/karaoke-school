-- Add lyrics table for Spotify tracks
-- Migration: add-spotify-track-lyrics
-- Date: 2025-10-25

-- Create lyrics table
CREATE TABLE IF NOT EXISTS spotify_track_lyrics (
  spotify_track_id TEXT PRIMARY KEY REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,
  lrclib_id INTEGER,
  plain_lyrics TEXT,
  synced_lyrics TEXT,  -- LRC format with timestamps [mm:ss.xx]
  instrumental BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'lrclib',
  confidence_score DECIMAL(3,2) DEFAULT 1.00,  -- 0.00-1.00 based on validation
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_track_lyrics_lrclib_id
  ON spotify_track_lyrics(lrclib_id)
  WHERE lrclib_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_track_lyrics_instrumental
  ON spotify_track_lyrics(instrumental)
  WHERE instrumental = true;

CREATE INDEX IF NOT EXISTS idx_track_lyrics_has_synced
  ON spotify_track_lyrics(spotify_track_id)
  WHERE synced_lyrics IS NOT NULL;

-- Add comments
COMMENT ON TABLE spotify_track_lyrics IS 'Lyrics from LRCLIB for Spotify tracks';
COMMENT ON COLUMN spotify_track_lyrics.synced_lyrics IS 'LRC format with timestamps for karaoke display';
COMMENT ON COLUMN spotify_track_lyrics.instrumental IS 'Track marked as instrumental (no lyrics)';
COMMENT ON COLUMN spotify_track_lyrics.confidence_score IS 'Match confidence: 1.0 = exact match, <1.0 = fuzzy match';
