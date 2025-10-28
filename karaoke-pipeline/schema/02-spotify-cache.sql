-- Spotify Cache Tables
-- Prevents repeated API calls for the same tracks/artists

CREATE TABLE IF NOT EXISTS spotify_tracks (
  spotify_track_id TEXT PRIMARY KEY,

  -- Core metadata
  title TEXT NOT NULL,
  artists JSONB NOT NULL,  -- [{"name": "Artist Name", "id": "spotify_artist_id"}]
  album TEXT,

  -- Identifiers
  isrc TEXT UNIQUE,  -- International Standard Recording Code

  -- Details
  duration_ms INT,
  release_date DATE,
  popularity INT,  -- 0-100 score

  -- URLs
  spotify_url TEXT,
  preview_url TEXT,

  -- Tracking
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spotify_tracks_isrc ON spotify_tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_spotify_tracks_title ON spotify_tracks USING gin(to_tsvector('english', title));

CREATE TABLE IF NOT EXISTS spotify_artists (
  spotify_artist_id TEXT PRIMARY KEY,

  -- Core info
  name TEXT NOT NULL,
  genres JSONB,  -- ["pop", "rock", ...]

  -- Images
  image_url TEXT,

  -- Stats
  popularity INT,
  followers INT,

  -- Tracking
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spotify_artists_name ON spotify_artists USING gin(to_tsvector('english', name));

-- Trigger for updated_at
CREATE TRIGGER spotify_tracks_update
  BEFORE UPDATE ON spotify_tracks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER spotify_artists_update
  BEFORE UPDATE ON spotify_artists
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
