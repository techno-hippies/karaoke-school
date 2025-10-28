-- MusicBrainz Cache Tables
-- Stores canonical music identifiers (MBIDs) and open source metadata

CREATE TABLE IF NOT EXISTS musicbrainz_recordings (
  recording_mbid TEXT PRIMARY KEY,

  -- Core metadata
  title TEXT NOT NULL,
  length_ms INT,

  -- Identifiers
  isrc TEXT REFERENCES quansic_recordings(isrc),

  -- Artists
  artist_credits JSONB NOT NULL DEFAULT '[]',  -- [{name, mbid, type}]

  -- Work linkage
  work_mbid TEXT,  -- Links to musicbrainz_works

  -- Tracking
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS musicbrainz_works (
  work_mbid TEXT PRIMARY KEY,

  -- Core metadata
  title TEXT NOT NULL,
  work_type TEXT,

  -- Identifiers
  iswc TEXT,  -- Should match quansic_recordings.iswc

  -- Contributors (composers, lyricists)
  contributors JSONB NOT NULL DEFAULT '[]',  -- [{type, mbid, name, attributes}]

  -- Tracking
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS musicbrainz_artists (
  artist_mbid TEXT PRIMARY KEY,

  -- Core metadata
  name TEXT NOT NULL,
  artist_type TEXT,  -- Person, Group, etc.
  country TEXT,
  begin_area TEXT,

  -- Identifiers
  isni TEXT,  -- International Standard Name Identifier
  spotify_artist_id TEXT REFERENCES spotify_artists(spotify_artist_id),

  -- URLs
  urls JSONB,  -- {wikidata, wikipedia, discogs, etc.}

  -- Tracking
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mb_recordings_isrc ON musicbrainz_recordings(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_mb_recordings_work ON musicbrainz_recordings(work_mbid) WHERE work_mbid IS NOT NULL;
CREATE INDEX idx_mb_works_iswc ON musicbrainz_works(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_mb_artists_isni ON musicbrainz_artists(isni) WHERE isni IS NOT NULL;
CREATE INDEX idx_mb_artists_spotify ON musicbrainz_artists(spotify_artist_id) WHERE spotify_artist_id IS NOT NULL;
