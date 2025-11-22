-- Task Management Schema
-- Separate tracking for parallel enrichment and sequential audio processing

-- ============================================================================
-- Enrichment Tasks (Parallel Execution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_tasks (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Task type
  task_type TEXT NOT NULL CHECK (task_type IN (
    'iswc_discovery',      -- Quansic → MLC → BMI fallback chain
    'musicbrainz',         -- MB recordings + works + artists
    'genius_songs',        -- Genius song metadata
    'genius_artists',      -- Genius artist profiles
    'wikidata_works',      -- Wikidata work enrichment
    'wikidata_artists',    -- Wikidata artist enrichment
    'quansic_artists'      -- Quansic artist ISNI/IPI data
  )),

  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Not started
    'running',    -- Currently processing
    'completed',  -- Successfully completed
    'failed',     -- Failed after max retries
    'skipped'     -- Not applicable for this track
  )),

  -- Results
  source TEXT,              -- Which source returned data (e.g., 'quansic_cache', 'mlc_api', 'bmi_fallback')
  result_data JSONB,        -- Source-specific result data
  cache_table TEXT,         -- Which cache table has the data

  -- Retry management
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(spotify_track_id, task_type)
);

CREATE INDEX idx_enrichment_pending ON enrichment_tasks(task_type, status)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_enrichment_retry ON enrichment_tasks(task_type, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX idx_enrichment_track ON enrichment_tasks(spotify_track_id);

-- ============================================================================
-- Audio Processing Tasks (Sequential with Dependencies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audio_tasks (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Task type (ordered by dependency)
  task_type TEXT NOT NULL CHECK (task_type IN (
    'download',         -- Audio download from Spotify/YouTube
    'align',            -- ElevenLabs forced alignment
    'translate',        -- Multi-language translation (zh, vi, id)
    'separate',         -- Demucs vocal/instrumental separation
    'segment',          -- AI segment selection (0-190s)
    'enhance',          -- fal.ai Stable Audio enhancement
    'clip'              -- Viral clip selection and cropping
  )),

  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Waiting for dependencies
    'running',    -- Currently processing
    'completed',  -- Successfully completed
    'failed'      -- Failed after max retries
  )),

  -- Results
  grove_cid TEXT,           -- Grove/IPFS CID for output
  grove_url TEXT,           -- Full grove:// URL
  metadata JSONB,           -- Task-specific output metadata

  -- Retry management
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Performance tracking
  processing_duration_ms INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(spotify_track_id, task_type)
);

CREATE INDEX idx_audio_pending ON audio_tasks(task_type, status)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_audio_retry ON audio_tasks(task_type, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX idx_audio_track ON audio_tasks(spotify_track_id);

-- ============================================================================
-- Task Progress Views
-- ============================================================================

-- Enrichment progress by track
CREATE OR REPLACE VIEW enrichment_progress AS
SELECT
  spotify_track_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
  BOOL_AND(status IN ('completed', 'failed', 'skipped')) as all_complete,
  MAX(updated_at) as last_updated
FROM enrichment_tasks
GROUP BY spotify_track_id;

-- Audio progress by track
CREATE OR REPLACE VIEW audio_progress AS
SELECT
  spotify_track_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  BOOL_AND(status = 'completed') as all_complete,
  MAX(updated_at) as last_updated
FROM audio_tasks
GROUP BY spotify_track_id;

-- Overall task status summary
CREATE OR REPLACE VIEW task_summary AS
SELECT
  'enrichment' as category,
  task_type,
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts,
  MIN(last_attempt_at) as oldest_attempt,
  MAX(last_attempt_at) as newest_attempt
FROM enrichment_tasks
GROUP BY task_type, status

UNION ALL

SELECT
  'audio' as category,
  task_type,
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts,
  MIN(last_attempt_at) as oldest_attempt,
  MAX(last_attempt_at) as newest_attempt
FROM audio_tasks
GROUP BY task_type, status
ORDER BY category, task_type, status;

-- Triggers
CREATE TRIGGER update_enrichment_tasks_timestamp
  BEFORE UPDATE ON enrichment_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_audio_tasks_timestamp
  BEFORE UPDATE ON audio_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
