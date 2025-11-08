-- Migration 014: Create grc20_works pre-mint table
-- Purpose: Aggregate musical work data from multiple sources for GRC-20 minting
-- Sources: spotify_tracks, genius_songs, musicbrainz_recordings, quansic_recordings

CREATE TABLE IF NOT EXISTS grc20_works (
  id SERIAL PRIMARY KEY,

  -- Basic Info
  title TEXT NOT NULL,
  alternate_titles TEXT,                 -- Comma-separated: "Title 1, Title 2"
  disambiguation TEXT,

  -- Industry Identifiers (Primary)
  iswc TEXT,                             -- International Standard Musical Work Code
  iswc_source TEXT,                      -- 'quansic' | 'bmi' | 'musicbrainz'
  isrc TEXT,                             -- International Standard Recording Code
  mbid TEXT,                             -- MusicBrainz Recording ID (UUID)
  bmi_work_id TEXT,                      -- BMI Songview work ID
  ascap_work_id TEXT,                    -- ASCAP work ID (from BMI)

  -- Platform IDs
  spotify_track_id TEXT UNIQUE,
  genius_song_id INTEGER UNIQUE,
  discogs_release_id TEXT,

  -- Artist Relationships
  primary_artist_id INTEGER REFERENCES grc20_artists(id),
  primary_artist_name TEXT NOT NULL,    -- Denormalized for convenience
  featured_artists TEXT,                 -- Comma-separated artist IDs or names
  composers TEXT,                        -- Comma-separated
  producers TEXT,                        -- Comma-separated
  lyricists TEXT,                        -- Comma-separated
  bmi_writers TEXT,                      -- Comma-separated: "Name1 (IPI: 123), Name2 (IPI: 456)"
  bmi_publishers TEXT,                   -- Comma-separated: "Publisher1 (IPI: 789)"

  -- Work Metadata
  language TEXT,                         -- ISO 639-1 code (2-letter)
  release_date DATE,
  duration_ms INTEGER,
  work_type TEXT,                        -- 'original', 'cover', 'remix', 'live', 'acoustic'

  -- Musical Info
  genres TEXT,                           -- Comma-separated: "pop, rock, electronic"
  key_signature TEXT,                    -- 'C', 'C#', 'D', etc.
  tempo_bpm INTEGER,
  explicit_content BOOLEAN DEFAULT FALSE,

  -- Popularity Metrics
  spotify_popularity INTEGER,            -- 0-100
  spotify_play_count BIGINT,
  genius_pageviews INTEGER,
  genius_annotation_count INTEGER,
  genius_pyongs_count INTEGER,           -- Genius upvotes

  -- Genius-specific
  genius_lyrics_state TEXT,              -- 'complete', 'unreleased', 'incomplete'
  genius_featured_video BOOLEAN DEFAULT FALSE,

  -- Database & Reference URLs
  wikidata_url TEXT,
  musicbrainz_url TEXT,
  discogs_url TEXT,
  allmusic_url TEXT,
  secondhandsongs_url TEXT,
  whosampled_url TEXT,

  -- Streaming Platform URLs
  spotify_url TEXT,
  deezer_url TEXT,
  tidal_url TEXT,
  apple_music_url TEXT,
  amazon_music_url TEXT,
  youtube_music_url TEXT,

  -- Lyrics Sites
  genius_url TEXT,
  musixmatch_url TEXT,
  lrclib_url TEXT,
  lyrics_ovh_url TEXT,

  -- Video URLs
  youtube_url TEXT,
  imvdb_url TEXT,                        -- Internet Music Video Database

  -- Library & Catalog URLs
  loc_url TEXT,                          -- Library of Congress
  bnf_url TEXT,                          -- Bibliothèque nationale de France
  worldcat_url TEXT,

  -- Specialized Databases
  rateyourmusic_url TEXT,
  jaxsta_url TEXT,
  setlistfm_url TEXT,

  -- Purchase & Download Sites
  beatport_url TEXT,
  itunes_url TEXT,
  qobuz_url TEXT,

  -- Regional Sites
  maniadb_url TEXT,
  melon_url TEXT,
  mora_url TEXT,

  -- Other URLs
  official_url TEXT,
  lastfm_url TEXT,

  -- Image URLs
  image_url TEXT,
  image_source TEXT,                     -- 'fal' | 'spotify' | 'genius' | 'musicbrainz'

  -- Minting State (Minimal)
  grc20_entity_id UUID UNIQUE,           -- Set after minting to GRC-20
  minted_at TIMESTAMP,
  last_edit_cid TEXT,                    -- IPFS CID of last GRC-20 edit (for debugging)
  needs_update BOOLEAN DEFAULT FALSE,    -- Flag when source data changes

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grc20_works_iswc ON grc20_works(iswc);
CREATE INDEX IF NOT EXISTS idx_grc20_works_isrc ON grc20_works(isrc);
CREATE INDEX IF NOT EXISTS idx_grc20_works_spotify ON grc20_works(spotify_track_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_genius ON grc20_works(genius_song_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_mbid ON grc20_works(mbid);
CREATE INDEX IF NOT EXISTS idx_grc20_works_entity_id ON grc20_works(grc20_entity_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_primary_artist ON grc20_works(primary_artist_id);
CREATE INDEX IF NOT EXISTS idx_grc20_works_needs_update ON grc20_works(needs_update) WHERE needs_update = TRUE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_grc20_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grc20_works_updated_at
  BEFORE UPDATE ON grc20_works
  FOR EACH ROW
  EXECUTE FUNCTION update_grc20_works_updated_at();

COMMENT ON TABLE grc20_works IS 'Pre-mint aggregation table for GRC-20 musical work entities. Combines data from Spotify, Genius, MusicBrainz, Quansic, and BMI. All arrays stored as comma-separated TEXT for GRC-20 compatibility.';
COMMENT ON COLUMN grc20_works.iswc IS 'International Standard Musical Work Code (preferred identifier when available)';
COMMENT ON COLUMN grc20_works.iswc_source IS 'Source of ISWC: quansic (primary), bmi (fallback), or musicbrainz (fallback)';
COMMENT ON COLUMN grc20_works.isrc IS 'International Standard Recording Code';
COMMENT ON COLUMN grc20_works.bmi_work_id IS 'BMI Songview work ID (when ISWC sourced from BMI or work found in BMI)';
COMMENT ON COLUMN grc20_works.ascap_work_id IS 'ASCAP work ID (from BMI cross-reference)';
COMMENT ON COLUMN grc20_works.primary_artist_id IS 'Foreign key to grc20_artists table';
COMMENT ON COLUMN grc20_works.bmi_writers IS 'Writers from BMI with IPIs, comma-separated: "Name1 (IPI: 123), Name2 (IPI: 456)"';
COMMENT ON COLUMN grc20_works.bmi_publishers IS 'Publishers from BMI with IPIs, comma-separated';
COMMENT ON COLUMN grc20_works.grc20_entity_id IS 'UUID of minted GRC-20 entity. NULL until minted.';
COMMENT ON COLUMN grc20_works.last_edit_cid IS 'IPFS CID of last GRC-20 edit operation (for debugging only, query GRC-20 API for full history)';
COMMENT ON COLUMN grc20_works.needs_update IS 'Flag indicating source data changed since last mint. Triggers re-minting via GRC-20 Edit operation.';
