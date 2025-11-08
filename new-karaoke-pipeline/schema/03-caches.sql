-- Cache Tables Schema
-- External API response caching (Spotify, MusicBrainz, Genius, etc.)

-- ============================================================================
-- Spotify Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS spotify_tracks (
  spotify_track_id TEXT PRIMARY KEY,

  title TEXT NOT NULL,
  artists JSONB NOT NULL,           -- Array of {id, name}
  album JSONB,                      -- {id, name, images}
  isrc TEXT,
  duration_ms INT,
  release_date TEXT,
  popularity INT,

  preview_url TEXT,
  external_urls JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spotify_tracks_isrc ON spotify_tracks(isrc) WHERE isrc IS NOT NULL;

CREATE TABLE IF NOT EXISTS spotify_artists (
  spotify_artist_id TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  genres JSONB,                     -- Array of genre strings
  popularity INT,
  followers INT,

  images JSONB,                     -- Array of {url, height, width}
  external_urls JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Quansic Cache (ISWC, ISNI, IPI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quansic_recordings (
  isrc TEXT PRIMARY KEY,

  iswc TEXT,
  title TEXT,
  artists JSONB,                    -- Array of artist names

  -- Quansic-specific metadata
  quansic_id TEXT,
  work_titles JSONB,                -- Array of work titles

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quansic_iswc ON quansic_recordings(iswc) WHERE iswc IS NOT NULL;

CREATE TABLE IF NOT EXISTS quansic_artists (
  artist_name TEXT PRIMARY KEY,

  isni TEXT,                        -- International Standard Name Identifier
  ipi TEXT,                         -- Interested Parties Information
  wikidata_id TEXT,

  -- Additional metadata
  aliases JSONB,                    -- Array of alternative names
  metadata JSONB,                   -- Raw Quansic response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quansic_artists_isni ON quansic_artists(isni) WHERE isni IS NOT NULL;
CREATE INDEX idx_quansic_artists_ipi ON quansic_artists(ipi) WHERE ipi IS NOT NULL;

-- ============================================================================
-- MLC (Music Licensing Collective) Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS mlc_works (
  isrc TEXT PRIMARY KEY,

  iswc TEXT,
  work_title TEXT,

  -- MLC metadata
  writers JSONB,                    -- Array of {name, role, ipi}
  publishers JSONB,                 -- Array of {name, ipi}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mlc_iswc ON mlc_works(iswc) WHERE iswc IS NOT NULL;

-- ============================================================================
-- BMI Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS bmi_works (
  isrc TEXT,
  work_id TEXT,

  iswc TEXT,
  title TEXT,
  artists TEXT[],

  -- BMI fuzzy match metadata
  match_confidence FLOAT,           -- 0.0 to 1.0
  match_method TEXT,                -- 'exact', 'fuzzy', 'fallback'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (isrc, work_id)
);

CREATE INDEX idx_bmi_iswc ON bmi_works(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_bmi_isrc ON bmi_works(isrc);

-- ============================================================================
-- MusicBrainz Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS musicbrainz_recordings (
  recording_mbid TEXT PRIMARY KEY,

  isrc TEXT,
  title TEXT,
  artist_credit JSONB,              -- Array of {mbid, name}
  work_mbid TEXT,                   -- Link to work
  length_ms INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mb_recordings_isrc ON musicbrainz_recordings(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_mb_recordings_work ON musicbrainz_recordings(work_mbid) WHERE work_mbid IS NOT NULL;

CREATE TABLE IF NOT EXISTS musicbrainz_works (
  work_mbid TEXT PRIMARY KEY,

  iswc TEXT,
  title TEXT,
  type TEXT,                        -- 'Song', 'Composition', etc.

  -- Relationships
  composers JSONB,                  -- Array of {mbid, name, role}
  writers JSONB,                    -- Array of {mbid, name, role}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mb_works_iswc ON musicbrainz_works(iswc) WHERE iswc IS NOT NULL;

CREATE TABLE IF NOT EXISTS musicbrainz_artists (
  artist_mbid TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  sort_name TEXT,
  type TEXT,                        -- 'Person', 'Group', 'Orchestra', etc.
  gender TEXT,
  country TEXT,

  -- Relationships
  members JSONB,                    -- Array of {mbid, name} (for groups)
  member_of JSONB,                  -- Array of {mbid, name} (for persons)

  -- Identifiers
  isni TEXT,
  wikidata_id TEXT,
  spotify_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mb_artists_isni ON musicbrainz_artists(isni) WHERE isni IS NOT NULL;
CREATE INDEX idx_mb_artists_wikidata ON musicbrainz_artists(wikidata_id) WHERE wikidata_id IS NOT NULL;

-- ============================================================================
-- Genius Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS genius_songs (
  genius_song_id BIGINT PRIMARY KEY,

  spotify_track_id TEXT,            -- Link to our tracks
  title TEXT NOT NULL,
  artist_name TEXT,
  primary_artist_id BIGINT,

  -- Metadata
  language TEXT,
  release_date TEXT,
  url TEXT,

  -- Rich content
  description JSONB,                -- Structured description
  annotation_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genius_songs_spotify ON genius_songs(spotify_track_id) WHERE spotify_track_id IS NOT NULL;
CREATE INDEX idx_genius_songs_artist ON genius_songs(primary_artist_id);

CREATE TABLE IF NOT EXISTS genius_artists (
  genius_artist_id BIGINT PRIMARY KEY,

  spotify_artist_id TEXT,           -- Link to Spotify
  name TEXT NOT NULL,
  url TEXT,

  -- Rich content
  description JSONB,
  header_image_url TEXT,

  -- Social links
  facebook_name TEXT,
  twitter_name TEXT,
  instagram_name TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genius_artists_spotify ON genius_artists(spotify_artist_id) WHERE spotify_artist_id IS NOT NULL;

-- ============================================================================
-- Wikidata Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS wikidata_works (
  wikidata_id TEXT PRIMARY KEY,

  iswc TEXT,
  title TEXT,

  -- Composers/writers
  composers JSONB,                  -- Array of {id, name}
  lyricists JSONB,                  -- Array of {id, name}

  -- International identifiers (40+ library IDs)
  identifiers JSONB,                -- {viaf, lcn, bnf, dnb, etc.}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wikidata_works_iswc ON wikidata_works(iswc) WHERE iswc IS NOT NULL;

CREATE TABLE IF NOT EXISTS wikidata_artists (
  wikidata_id TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  aliases JSONB,                    -- Array of alternative names

  -- Identifiers
  isni TEXT,
  viaf TEXT,
  musicbrainz_id TEXT,
  spotify_id TEXT,

  -- International library identifiers (40+)
  identifiers JSONB,                -- {lcn, bnf, dnb, sudoc, etc.}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wikidata_artists_isni ON wikidata_artists(isni) WHERE isni IS NOT NULL;
CREATE INDEX idx_wikidata_artists_mb ON wikidata_artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

-- ============================================================================
-- ISWC Lookup Failures (Prevents Redundant API Calls)
-- ============================================================================

CREATE TABLE IF NOT EXISTS iswc_lookup_failures (
  isrc TEXT PRIMARY KEY,

  -- Failure tracking
  sources_tried JSONB,              -- ['quansic', 'mlc', 'bmi']
  last_attempted_at TIMESTAMPTZ NOT NULL,
  attempt_count INT DEFAULT 1,

  -- Reason
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_iswc_failures_attempted ON iswc_lookup_failures(last_attempted_at);

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER update_spotify_tracks_timestamp
  BEFORE UPDATE ON spotify_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_spotify_artists_timestamp
  BEFORE UPDATE ON spotify_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_quansic_recordings_timestamp
  BEFORE UPDATE ON quansic_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_quansic_artists_timestamp
  BEFORE UPDATE ON quansic_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_mlc_works_timestamp
  BEFORE UPDATE ON mlc_works
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_bmi_works_timestamp
  BEFORE UPDATE ON bmi_works
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_musicbrainz_recordings_timestamp
  BEFORE UPDATE ON musicbrainz_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_musicbrainz_works_timestamp
  BEFORE UPDATE ON musicbrainz_works
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_musicbrainz_artists_timestamp
  BEFORE UPDATE ON musicbrainz_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_genius_songs_timestamp
  BEFORE UPDATE ON genius_songs
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_genius_artists_timestamp
  BEFORE UPDATE ON genius_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_wikidata_works_timestamp
  BEFORE UPDATE ON wikidata_works
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_wikidata_artists_timestamp
  BEFORE UPDATE ON wikidata_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_iswc_lookup_failures_timestamp
  BEFORE UPDATE ON iswc_lookup_failures
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
