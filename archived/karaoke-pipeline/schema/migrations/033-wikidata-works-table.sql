-- Migration: Create wikidata_works table
-- Description: Store Wikidata work/composition metadata with international identifiers
-- Created: 2025-11-02

CREATE TABLE IF NOT EXISTS wikidata_works (
  wikidata_id TEXT PRIMARY KEY,                    -- e.g., "Q12345678"

  -- Relations to existing tables
  musicbrainz_work_id TEXT REFERENCES musicbrainz_works(work_mbid),
  spotify_track_id TEXT REFERENCES spotify_tracks(spotify_track_id),

  -- Core metadata
  title TEXT,
  iswc TEXT,                                       -- May differ from other sources
  language TEXT,                                   -- ISO 639-1 code

  -- Labels (multi-language titles)
  labels JSONB,                                    -- {"en": "Title", "zh": "标题", ...}

  -- Aliases (alternate titles by language)
  aliases JSONB,                                   -- {"en": ["Alt Title 1", ...], ...}

  -- Relations (Wikidata QIDs)
  composers JSONB,                                 -- [{"wikidata_id": "Q123", "name": "Artist"}, ...]
  lyricists JSONB,                                 -- [{"wikidata_id": "Q456", "name": "Writer"}, ...]
  performers JSONB,                                -- [{"wikidata_id": "Q789", "name": "Singer"}, ...]

  -- Other identifiers (JSONB for flexibility)
  -- Includes: YouTube video IDs, ISWC, publication dates, etc.
  identifiers JSONB,                               -- {"youtube": "abc123", "publication_date": "2020-01-01", ...}

  -- Metadata
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_wikidata_works_mbid
  ON wikidata_works(musicbrainz_work_id)
  WHERE musicbrainz_work_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wikidata_works_spotify
  ON wikidata_works(spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wikidata_works_iswc
  ON wikidata_works(iswc)
  WHERE iswc IS NOT NULL;

-- GIN index for JSONB identifiers
CREATE INDEX IF NOT EXISTS idx_wikidata_works_identifiers
  ON wikidata_works USING gin(identifiers);

-- Comments
COMMENT ON TABLE wikidata_works IS 'Wikidata work/composition metadata with international identifiers';
COMMENT ON COLUMN wikidata_works.wikidata_id IS 'Wikidata QID (e.g., Q12345678)';
COMMENT ON COLUMN wikidata_works.labels IS 'Multi-language work titles from Wikidata';
COMMENT ON COLUMN wikidata_works.aliases IS 'Alternate work titles by language';
COMMENT ON COLUMN wikidata_works.composers IS 'Array of composer objects with Wikidata QIDs';
COMMENT ON COLUMN wikidata_works.lyricists IS 'Array of lyricist objects with Wikidata QIDs';
COMMENT ON COLUMN wikidata_works.performers IS 'Array of performer objects with Wikidata QIDs';
COMMENT ON COLUMN wikidata_works.identifiers IS 'Other identifiers: YouTube, ISRC, publication dates, etc.';
