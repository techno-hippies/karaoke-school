-- Derivative Images for Karaoke Assets
-- Stores watercolor-style derivative images generated via Seedream
-- These are app-generated derivatives of Spotify/Genius source images
-- NOT related to GRC-20 (which comes later as a separate minting step)

CREATE TABLE IF NOT EXISTS derivative_images (
  id SERIAL PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('track', 'artist')),

  -- Track derivatives (Spotify cover art)
  spotify_track_id TEXT REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Artist derivatives (Spotify/Genius artist image)
  artist_name TEXT,
  spotify_artist_id TEXT,

  -- Grove storage (full-size image)
  grove_cid TEXT NOT NULL,
  grove_url TEXT NOT NULL,

  -- Grove storage (thumbnail - auto-resized)
  thumbnail_grove_cid TEXT,
  thumbnail_grove_url TEXT,

  -- Metadata
  image_source TEXT, -- 'spotify' | 'genius'
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT track_or_artist CHECK (
    (asset_type = 'track' AND spotify_track_id IS NOT NULL) OR
    (asset_type = 'artist' AND (artist_name IS NOT NULL OR spotify_artist_id IS NOT NULL))
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_derivative_images_track
  ON derivative_images(spotify_track_id)
  WHERE asset_type = 'track';

CREATE INDEX IF NOT EXISTS idx_derivative_images_artist_name
  ON derivative_images(artist_name)
  WHERE asset_type = 'artist';

CREATE INDEX IF NOT EXISTS idx_derivative_images_artist_spotify
  ON derivative_images(spotify_artist_id)
  WHERE asset_type = 'artist';

COMMENT ON TABLE derivative_images IS
  'Watercolor-style derivative images generated via Seedream. References karaoke assets (tracks/artists), NOT GRC-20 entities. Stores Grove CIDs for immutable access.';
