-- Song Lyrics Table
-- Multi-source lyrics storage with explicit separation between original sources and normalized results

CREATE TABLE IF NOT EXISTS song_lyrics (
  spotify_track_id TEXT PRIMARY KEY REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Original sources (immutable audit trail)
  lrclib_lyrics TEXT,              -- Raw lyrics from LRCLIB
  ovh_lyrics TEXT,                 -- Raw lyrics from Lyrics.ovh

  -- Processed output (NULL if needs manual review)
  normalized_lyrics TEXT,          -- AI-processed lyrics (always reads from here)

  -- Metadata
  source TEXT NOT NULL,            -- 'lrclib', 'ovh', 'lrclib+ovh', 'normalized', 'needs_review'
  normalized_by TEXT,              -- 'gemini_flash_2_5' or NULL
  confidence_score NUMERIC(3,2),   -- Similarity score when dual-source (<0.80 = flagged for review)

  -- Language detection (K-pop mixed-language handling)
  language_data JSONB,             -- {primary: 'ko', breakdown: [{code: 'ko', pct: 70}, {code: 'en', pct: 30}]}

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lyrics_source ON song_lyrics(source);
CREATE INDEX idx_lyrics_confidence ON song_lyrics(confidence_score DESC) WHERE confidence_score IS NOT NULL;
CREATE INDEX idx_lyrics_needs_review ON song_lyrics(spotify_track_id) WHERE source = 'needs_review';

-- Trigger to update updated_at
CREATE TRIGGER song_lyrics_update
  BEFORE UPDATE ON song_lyrics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
