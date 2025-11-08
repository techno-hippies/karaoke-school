-- Quansic Cache Tables
-- Stores enriched ISWC and work metadata from Quansic

CREATE TABLE IF NOT EXISTS quansic_recordings (
  isrc TEXT PRIMARY KEY,

  -- Core metadata
  title TEXT NOT NULL,
  iswc TEXT,  -- The golden ticket! Work identifier
  work_title TEXT,

  -- Artists
  artists JSONB NOT NULL DEFAULT '[]',  -- [{name, isni, spotify_id, apple_id, musicbrainz_mbid}]

  -- Composers
  composers JSONB NOT NULL DEFAULT '[]',  -- [{name, isni, ipi, role}]

  -- Platform IDs
  platform_ids JSONB,  -- {spotify, apple, musicbrainz, luminate, gracenote}

  -- Metadata
  duration_ms INT,
  q2_score INT,  -- Quality score from Quansic

  -- Foreign keys
  spotify_track_id TEXT REFERENCES spotify_tracks(spotify_track_id),

  -- Tracking
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quansic_recordings_iswc ON quansic_recordings(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_quansic_recordings_spotify ON quansic_recordings(spotify_track_id) WHERE spotify_track_id IS NOT NULL;
