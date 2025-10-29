-- Song Lyrics Table
-- Single source of truth for normalized lyrics

CREATE TABLE IF NOT EXISTS song_lyrics (
  spotify_track_id TEXT PRIMARY KEY REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Final lyrics (post-normalization)
  plain_text TEXT NOT NULL,
  synced_lrc TEXT,                 -- LRC format (if available from LRCLIB)
  lrc_duration_ms INTEGER,         -- Duration from LRCLIB API (for validation against Spotify)

  -- Provenance
  source TEXT NOT NULL,            -- 'lrclib', 'lyrics_ovh', 'lrclib+lyrics_ovh'
  normalized_by TEXT,              -- 'gemini_flash_2_5', NULL
  confidence_score NUMERIC(3,2),   -- 0.80+ = corroborated & normalized, <0.80 = single source

  -- Language detection (K-pop mixed-language handling)
  language_data JSONB,             -- {primary: 'ko', breakdown: [{code: 'ko', pct: 70}, {code: 'en', pct: 30}]}

  -- Debugging (optional, can be NULL)
  raw_sources JSONB,               -- {lrclib: '...', lyrics_ovh: '...'} - only store when debugging needed

  -- Grove IPFS (stored AFTER normalization)
  grove_cid TEXT,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lyrics_source ON song_lyrics(source);
CREATE INDEX idx_lyrics_confidence ON song_lyrics(confidence_score DESC) WHERE confidence_score IS NOT NULL;
CREATE INDEX idx_lyrics_grove ON song_lyrics(grove_cid) WHERE grove_cid IS NOT NULL;
CREATE INDEX idx_lyrics_synced ON song_lyrics(spotify_track_id) WHERE synced_lrc IS NOT NULL;

-- Trigger to update updated_at
CREATE TRIGGER song_lyrics_update
  BEFORE UPDATE ON song_lyrics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
