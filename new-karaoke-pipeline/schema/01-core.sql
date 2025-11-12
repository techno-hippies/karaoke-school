-- Core Pipeline Schema
-- Clean task-based architecture for karaoke content processing

-- Helper function for updating timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TikTok Source Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS tiktok_creators (
  username TEXT PRIMARY KEY,
  display_name TEXT,
  follower_count BIGINT,
  total_videos INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tiktok_videos (
  video_id TEXT PRIMARY KEY,
  creator_username TEXT REFERENCES tiktok_creators(username) ON DELETE CASCADE,

  video_url TEXT NOT NULL,
  description TEXT,
  music_title TEXT,
  music_author TEXT,

  play_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,
  share_count BIGINT,

  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tiktok_videos_creator ON tiktok_videos(creator_username);

-- ============================================================================
-- Core Track State (Linear Progression Only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tracks (
  spotify_track_id TEXT PRIMARY KEY,
  -- tiktok_video_id is nullable to support manual Spotify tracks
  -- TikTok tracks: tiktok_video_id IS NOT NULL
  -- Manual Spotify tracks: tiktok_video_id IS NULL
  -- Uniqueness protected by partial index idx_tracks_tiktok_not_null
  tiktok_video_id TEXT UNIQUE,

  -- Core metadata (from Spotify)
  title TEXT NOT NULL,
  artists JSONB NOT NULL,           -- Array of {id, name}
  album_name TEXT,
  release_date TEXT,
  duration_ms INT,
  isrc TEXT,

  -- Primary artist reference (for enrichment)
  primary_artist_id TEXT,
  primary_artist_name TEXT,

  -- Track source: 'tiktok' (discovered) or 'manual_spotify' (manually submitted)
  source_type TEXT NOT NULL DEFAULT 'tiktok' CHECK (source_type IN ('tiktok', 'manual_spotify')),

  -- Linear stage progression (NO AMBIGUITY)
  stage TEXT NOT NULL DEFAULT 'pending' CHECK (stage IN (
    'pending',          -- Just discovered from TikTok or manually submitted
    'enriched',         -- All enrichment attempts complete (may be partial)
    'lyrics_acquired',  -- Has synced lyrics
    'audio_ready',      -- Audio downloaded to Grove
    'aligned',          -- ElevenLabs word-level timing
    'translated',       -- Multi-language translations complete
    'separated',        -- Demucs vocal/instrumental stems
    'segmented',        -- Optimal segment selected
    'enhanced',         -- fal.ai enhancement applied
    'ready',            -- Final viral clip cropped
    'failed'            -- Unrecoverable failure
  )),

  -- Quick flags (for queries - derived from task completion)
  has_iswc BOOLEAN DEFAULT FALSE,
  has_lyrics BOOLEAN DEFAULT FALSE,
  has_audio BOOLEAN DEFAULT FALSE,

  -- Error tracking (stage-level)
  error_message TEXT,
  error_at TIMESTAMPTZ,

  -- Audit trail and metadata
  -- For manual tracks: stores submission details (timestamp, notes, etc.)
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracks_stage ON tracks(stage) WHERE stage NOT IN ('ready', 'failed');
CREATE INDEX idx_tracks_isrc ON tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_tracks_primary_artist ON tracks(primary_artist_id) WHERE primary_artist_id IS NOT NULL;
-- Partial unique index for TikTok tracks (allows manual Spotify tracks with NULL tiktok_video_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_tiktok_not_null ON tracks(tiktok_video_id) WHERE tiktok_video_id IS NOT NULL;
-- Indexes for manual Spotify track queries
CREATE INDEX IF NOT EXISTS idx_tracks_source_type ON tracks(source_type) WHERE source_type = 'manual_spotify';
CREATE INDEX IF NOT EXISTS idx_tracks_manual_stage ON tracks(stage) WHERE source_type = 'manual_spotify' AND stage NOT IN ('ready', 'failed');
-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_tracks_metadata_gin ON tracks USING GIN (metadata);

-- ============================================================================
-- Monitoring Views
-- ============================================================================

CREATE OR REPLACE VIEW pipeline_progress AS
SELECT
  stage,
  COUNT(*) as track_count,
  COUNT(*) FILTER (WHERE has_iswc) as with_iswc,
  COUNT(*) FILTER (WHERE has_lyrics) as with_lyrics,
  COUNT(*) FILTER (WHERE has_audio) as with_audio,
  MIN(updated_at) as oldest_updated,
  MAX(updated_at) as newest_updated
FROM tracks
GROUP BY stage
ORDER BY
  CASE stage
    WHEN 'pending' THEN 1
    WHEN 'enriched' THEN 2
    WHEN 'lyrics_acquired' THEN 3
    WHEN 'audio_ready' THEN 4
    WHEN 'aligned' THEN 5
    WHEN 'translated' THEN 6
    WHEN 'separated' THEN 7
    WHEN 'segmented' THEN 8
    WHEN 'enhanced' THEN 9
    WHEN 'ready' THEN 10
    WHEN 'failed' THEN 99
  END;

-- Triggers
CREATE TRIGGER update_tracks_timestamp
  BEFORE UPDATE ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_tiktok_creators_timestamp
  BEFORE UPDATE ON tiktok_creators
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_tiktok_videos_timestamp
  BEFORE UPDATE ON tiktok_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
