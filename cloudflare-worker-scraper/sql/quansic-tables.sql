-- Quansic Recordings Table (PRIMARY source for ISRC → ISWC enrichment)
CREATE TABLE IF NOT EXISTS quansic_recordings (
  isrc TEXT PRIMARY KEY,
  recording_mbid TEXT,
  spotify_track_id TEXT,
  title TEXT NOT NULL,
  iswc TEXT,
  work_title TEXT,
  duration_ms INTEGER,
  release_date DATE,
  artists JSONB NOT NULL DEFAULT '[]',
  composers JSONB NOT NULL DEFAULT '[]',
  platform_ids JSONB,
  q2_score INTEGER,
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (recording_mbid) REFERENCES musicbrainz_recordings(recording_mbid),
  FOREIGN KEY (spotify_track_id) REFERENCES spotify_tracks(spotify_track_id)
);

CREATE INDEX IF NOT EXISTS idx_quansic_recordings_iswc ON quansic_recordings(iswc);
CREATE INDEX IF NOT EXISTS idx_quansic_recordings_spotify ON quansic_recordings(spotify_track_id);
CREATE INDEX IF NOT EXISTS idx_quansic_recordings_mbid ON quansic_recordings(recording_mbid);

-- Quansic Works Table
CREATE TABLE IF NOT EXISTS quansic_works (
  iswc TEXT PRIMARY KEY,
  work_mbid TEXT,
  title TEXT NOT NULL,
  contributors JSONB NOT NULL DEFAULT '[]',
  recording_count INTEGER,
  q1_score INTEGER,
  sample_recordings JSONB,
  raw_data JSONB NOT NULL,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (work_mbid) REFERENCES musicbrainz_works(work_mbid)
);

CREATE INDEX IF NOT EXISTS idx_quansic_works_mbid ON quansic_works(work_mbid);

-- Comments for documentation
COMMENT ON TABLE quansic_recordings IS 'Quansic recording enrichment (PRIMARY source for ISRC → ISWC, 95%+ coverage)';
COMMENT ON TABLE quansic_works IS 'Quansic work enrichment (ISWC → Composers with ISNIs/IPIs)';

COMMENT ON COLUMN quansic_recordings.iswc IS 'ISWC from Quansic (fills MusicBrainz gaps)';
COMMENT ON COLUMN quansic_recordings.artists IS 'Artists with ISNIs and full platform IDs';
COMMENT ON COLUMN quansic_recordings.composers IS 'Composers with ISNIs and IPIs';
COMMENT ON COLUMN quansic_recordings.q2_score IS 'Quansic quality score for recording match';

COMMENT ON COLUMN quansic_works.contributors IS 'Composers with ISNIs, IPIs, birthdates, nationalities';
COMMENT ON COLUMN quansic_works.q1_score IS 'Quansic quality score for work match';
