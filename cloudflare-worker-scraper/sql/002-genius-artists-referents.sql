-- ========================================
-- GENIUS ARTISTS & SONG REFERENTS TABLES
-- ========================================
--
-- This migration adds tables for:
-- 1. Genius artist metadata (followers, social media, alternate names)
-- 2. Song referents (lyrics annotations from Genius community)
--
-- Design principle: JSONB-first schema with indexed columns
-- ========================================

-- ========================================
-- 1. GENIUS_ARTISTS
-- Artist metadata from Genius API
-- ========================================
CREATE TABLE IF NOT EXISTS genius_artists (
  genius_artist_id INTEGER PRIMARY KEY,

  -- Core artist info
  name TEXT NOT NULL,
  alternate_names TEXT[], -- Array of alternate artist names

  -- Verification & popularity
  is_verified BOOLEAN DEFAULT FALSE,
  is_meme_verified BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,

  -- Images
  image_url TEXT,
  header_image_url TEXT,

  -- Social media handles
  instagram_name TEXT,
  twitter_name TEXT,
  facebook_name TEXT,

  -- Links
  url TEXT, -- Genius artist page URL
  api_path TEXT, -- Genius API path

  -- Full API response (JSONB for flexibility)
  raw_data JSONB NOT NULL,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genius_artists_name ON genius_artists(name);
CREATE INDEX idx_genius_artists_verified ON genius_artists(is_verified);
CREATE INDEX idx_genius_artists_followers ON genius_artists(followers_count DESC);
CREATE INDEX idx_genius_artists_instagram ON genius_artists(instagram_name) WHERE instagram_name IS NOT NULL;

-- ========================================
-- 2. GENIUS_SONG_REFERENTS
-- Lyrics annotations (referents) from Genius
-- Links to genius_songs table
-- ========================================
CREATE TABLE IF NOT EXISTS genius_song_referents (
  referent_id INTEGER PRIMARY KEY,

  -- Foreign key to genius_songs
  genius_song_id INTEGER NOT NULL REFERENCES genius_songs(genius_song_id) ON DELETE CASCADE,

  -- Referent metadata
  fragment TEXT NOT NULL, -- The lyric snippet being annotated
  classification TEXT, -- 'accepted', 'unreviewed', 'rejected'

  -- Annotation stats
  votes_total INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Creator info
  annotator_id INTEGER,
  annotator_login TEXT,

  -- Links
  url TEXT, -- Full Genius URL to this referent
  path TEXT, -- Genius path
  api_path TEXT, -- API path

  -- Full annotations array (JSONB for nested DOM structure)
  annotations JSONB NOT NULL, -- Array of annotation objects with DOM body

  -- Full API response (includes annotatable, range, etc.)
  raw_data JSONB NOT NULL,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genius_song_referents_genius_song ON genius_song_referents(genius_song_id);
CREATE INDEX idx_genius_song_referents_classification ON genius_song_referents(classification);
CREATE INDEX idx_genius_song_referents_votes ON genius_song_referents(votes_total DESC);
CREATE INDEX idx_genius_song_referents_verified ON genius_song_referents(is_verified);
CREATE INDEX idx_genius_song_referents_annotator ON genius_song_referents(annotator_id) WHERE annotator_id IS NOT NULL;

-- GIN index for full-text search on fragment
CREATE INDEX idx_genius_song_referents_fragment_search ON genius_song_referents USING GIN (to_tsvector('english', fragment));

-- ========================================
-- TRIGGERS for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_genius_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_genius_artists_updated_at
  BEFORE UPDATE ON genius_artists
  FOR EACH ROW EXECUTE FUNCTION update_genius_updated_at();

CREATE TRIGGER update_genius_song_referents_updated_at
  BEFORE UPDATE ON genius_song_referents
  FOR EACH ROW EXECUTE FUNCTION update_genius_updated_at();

-- ========================================
-- LINK genius_songs to genius_artists
-- Add foreign key constraint
-- ========================================
ALTER TABLE genius_songs
  ADD CONSTRAINT genius_songs_artist_id_fkey
  FOREIGN KEY (genius_artist_id)
  REFERENCES genius_artists(genius_artist_id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Genius artists & referents tables created successfully!';
  RAISE NOTICE '   - genius_artists (with social media, followers, verification)';
  RAISE NOTICE '   - genius_song_referents (lyrics annotations with votes, comments)';
  RAISE NOTICE '   - Foreign key link: genius_songs → genius_artists';
END $$;
