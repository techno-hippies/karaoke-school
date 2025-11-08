-- Create Genius tables for full metadata storage
-- Based on old database structure (plain-wave-99802895)

-- Genius Artists table
CREATE TABLE IF NOT EXISTS genius_artists (
  genius_artist_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  alternate_names TEXT[],
  is_verified BOOLEAN DEFAULT FALSE,
  is_meme_verified BOOLEAN DEFAULT FALSE,
  followers_count INTEGER,
  image_url TEXT,
  header_image_url TEXT,
  instagram_name TEXT,
  twitter_name TEXT,
  facebook_name TEXT,
  url TEXT NOT NULL,
  api_path TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Genius Songs table
CREATE TABLE IF NOT EXISTS genius_songs (
  genius_song_id INTEGER PRIMARY KEY,
  spotify_track_id TEXT REFERENCES spotify_tracks(spotify_track_id),
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  genius_artist_id INTEGER REFERENCES genius_artists(genius_artist_id),
  url TEXT NOT NULL,
  language CHAR(2),
  release_date DATE,
  lyrics_state TEXT,
  annotation_count INTEGER DEFAULT 0,
  pyongs_count INTEGER DEFAULT 0,
  apple_music_id TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Genius Song Referents (Lyrics Annotations)
CREATE TABLE IF NOT EXISTS genius_song_referents (
  referent_id INTEGER PRIMARY KEY,
  genius_song_id INTEGER NOT NULL REFERENCES genius_songs(genius_song_id) ON DELETE CASCADE,
  fragment TEXT NOT NULL,  -- The lyric snippet being annotated
  classification TEXT,     -- 'verified', 'unverified', 'contributor'
  votes_total INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  annotator_id INTEGER,
  annotator_login TEXT,
  url TEXT,
  path TEXT,
  api_path TEXT,
  annotations JSONB,       -- Array of annotation objects
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_genius_songs_spotify_track_id
  ON genius_songs(spotify_track_id);

CREATE INDEX IF NOT EXISTS idx_genius_songs_artist_id
  ON genius_songs(genius_artist_id);

CREATE INDEX IF NOT EXISTS idx_genius_referents_song_id
  ON genius_song_referents(genius_song_id);

CREATE INDEX IF NOT EXISTS idx_genius_referents_classification
  ON genius_song_referents(classification);

-- Add indexes for search
CREATE INDEX IF NOT EXISTS idx_genius_artists_name
  ON genius_artists USING gin(to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_genius_songs_title
  ON genius_songs USING gin(to_tsvector('english', title));

COMMENT ON TABLE genius_artists IS 'Complete Genius artist data with social media and verification status';
COMMENT ON TABLE genius_songs IS 'Complete Genius song metadata with lyrics state and engagement metrics';
COMMENT ON TABLE genius_song_referents IS 'Lyrics annotations (referents) with community votes and comments';
