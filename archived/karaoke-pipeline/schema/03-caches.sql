-- ISWC Lookup Caches
-- Essential for Step 8 ISWC Discovery

-- Quansic Cache (ISRC lookups)
CREATE TABLE IF NOT EXISTS quansic_cache (
  isrc TEXT PRIMARY KEY,
  iswc TEXT,
  isni TEXT,
  ipn TEXT, -- Quansic internal ID
  luminate_id TEXT,
  work_title TEXT,
  composers JSONB, -- array of {name, role}
  raw_data JSONB, -- full response
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quansic_iswc ON quansic_cache(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quansic_isni ON quansic_cache(isni) WHERE isni IS NOT NULL;

-- Quansic Recordings (from dump)
CREATE TABLE IF NOT EXISTS quansic_recordings (
  isrc TEXT PRIMARY KEY,
  recording_mbid TEXT,
  spotify_track_id TEXT,
  title TEXT,
  iswc TEXT,
  work_title TEXT,
  duration_ms INT,
  release_date DATE,
  artists JSONB,
  composers JSONB,
  platform_ids JSONB,
  q2_score INT,
  raw_data JSONB,
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_iswc ON quansic_recordings(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_mbid ON quansic_recordings(recording_mbid) WHERE recording_mbid IS NOT NULL;

-- MusicBrainz Recordings (from dump)
CREATE TABLE IF NOT EXISTS musicbrainz_recordings (
  recording_mbid TEXT PRIMARY KEY,
  spotify_track_id TEXT,
  isrc TEXT,
  title TEXT,
  length_ms INT,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mbr_isrc ON musicbrainz_recordings(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mbr_spotify ON musicbrainz_recordings(spotify_track_id) WHERE spotify_track_id IS NOT NULL;

-- MusicBrainz Works (from dump)
CREATE TABLE IF NOT EXISTS musicbrainz_works (
  work_mbid TEXT PRIMARY KEY,
  iswc TEXT,
  title TEXT,
  type TEXT,
  language TEXT,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mbw_iswc ON musicbrainz_works(iswc) WHERE iswc IS NOT NULL;

-- Work Recording Links (from dump)
CREATE TABLE IF NOT EXISTS work_recording_links (
  work_mbid TEXT NOT NULL,
  recording_mbid TEXT NOT NULL,
  PRIMARY KEY (work_mbid, recording_mbid)
);

CREATE INDEX IF NOT EXISTS idx_wrl_recording ON work_recording_links(recording_mbid);
CREATE INDEX IF NOT EXISTS idx_wrl_work ON work_recording_links(work_mbid);
