-- Enrichment and Cache Tables
-- Stores data from external APIs (Quansic, MusicBrainz, lyrics services)

-- Track Lyrics (single source of truth after normalization)
CREATE TABLE IF NOT EXISTS track_lyrics (
  spotify_track_id TEXT PRIMARY KEY,
  plain_text TEXT NOT NULL,
  synced_lrc TEXT, -- LRC format with word timing
  source TEXT NOT NULL, -- 'lrclib', 'lyrics_ovh', 'manual'
  normalized_by TEXT, -- 'gemini', 'manual', NULL
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  grove_cid TEXT, -- IPFS CID for lyrics file
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lyrics_confidence ON track_lyrics(confidence_score DESC);
CREATE INDEX idx_lyrics_source ON track_lyrics(source);

-- Track Media Assets (Grove CIDs)
CREATE TABLE IF NOT EXISTS track_media (
  spotify_track_id TEXT PRIMARY KEY,

  -- Audio files
  audio_grove_cid TEXT, -- Full track from freyr
  audio_duration_ms INT,
  audio_verified BOOLEAN DEFAULT FALSE, -- AcoustID match

  -- Demucs separated stems
  vocals_grove_cid TEXT,
  instrumental_grove_cid TEXT,

  -- Fal.ai enhanced
  enhanced_instrumental_grove_cid TEXT, -- audio2audio processed

  -- ElevenLabs alignment
  word_timing_grove_cid TEXT, -- JSON with word-level timestamps

  -- Artist image
  artist_image_grove_cid TEXT, -- Fal.ai generated derivative

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX idx_quansic_iswc ON quansic_cache(iswc) WHERE iswc IS NOT NULL;
CREATE INDEX idx_quansic_isni ON quansic_cache(isni) WHERE isni IS NOT NULL;

-- Processing Log (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS processing_log (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL,
  stage TEXT NOT NULL, -- 'spotify_resolve', 'iswc_lookup', etc.
  action TEXT NOT NULL, -- 'success', 'failed', 'skipped'
  source TEXT, -- 'cache', 'api', 'manual'
  message TEXT,
  metadata JSONB, -- extra context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_log_track ON processing_log(spotify_track_id, created_at DESC);
CREATE INDEX idx_log_stage ON processing_log(stage, action, created_at DESC);
CREATE INDEX idx_log_created ON processing_log(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER track_lyrics_update
  BEFORE UPDATE ON track_lyrics
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER track_media_update
  BEFORE UPDATE ON track_media
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
