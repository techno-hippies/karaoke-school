-- Spotify Tracks
-- Minimal track metadata from Spotify

CREATE TABLE IF NOT EXISTS spotify_tracks (
  spotify_track_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artists TEXT[] NOT NULL,
  album TEXT,
  isrc TEXT,
  release_date DATE,
  duration_ms INT,
  popularity INT,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotify_tracks_isrc ON spotify_tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spotify_tracks_title ON spotify_tracks(title);

-- Processing Log (for debugging)
CREATE TABLE IF NOT EXISTS processing_log (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL,
  stage TEXT NOT NULL, -- 'spotify_resolve', 'iswc_lookup', etc.
  action TEXT NOT NULL, -- 'success', 'failed', 'skipped'
  source TEXT, -- 'dump', 'api', 'cache'
  message TEXT,
  metadata JSONB, -- extra context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_track ON processing_log(spotify_track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_stage ON processing_log(stage, action, created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spotify_tracks_update
  BEFORE UPDATE ON spotify_tracks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
