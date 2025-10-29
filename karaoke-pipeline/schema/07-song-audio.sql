-- Song Audio Table
-- Audio files downloaded via freyr-service and verified with AcoustID

CREATE TABLE IF NOT EXISTS song_audio (
  spotify_track_id TEXT PRIMARY KEY REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Grove Storage
  grove_cid TEXT NOT NULL,
  grove_url TEXT,

  -- Download metadata
  download_method TEXT NOT NULL,        -- 'freyr', 'yt-dlp'
  file_size_bytes INTEGER NOT NULL,
  duration_ms INTEGER,

  -- AcoustID verification
  verified BOOLEAN DEFAULT FALSE,
  verification_confidence NUMERIC(4,3), -- 0.000 to 1.000 (0.90+ = verified)
  raw_verification_data JSONB,          -- Full AcoustID response

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_song_audio_grove ON song_audio(grove_cid);
CREATE INDEX idx_song_audio_verified ON song_audio(verified) WHERE verified = TRUE;

-- Trigger to update updated_at
CREATE TRIGGER song_audio_update
  BEFORE UPDATE ON song_audio
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
