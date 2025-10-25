-- ========================================
-- KARAOKE PRODUCTION PIPELINE TABLES
-- ========================================
--
-- This migration creates tables for the karaoke production pipeline
-- which handles:
-- 1. Downloading tracks from Spotify (via freyr service)
-- 2. Selecting optimal 190s segments (fal.ai limitation)
-- 3. Vocal separation (demucs)
-- 4. Instrumental enhancement (fal-audio)
-- 5. Lyrics fetching & alignment (LRCLib + ElevenLabs)
-- 6. Immutable storage (Grove)
--
-- Design principle: JSONB-first schema with indexed columns
-- All foreign keys reference spotify_tracks.spotify_track_id
-- ========================================

-- ========================================
-- 1. KARAOKE_DOWNLOADS
-- Track download status from freyr service
-- ========================================
CREATE TABLE IF NOT EXISTS karaoke_downloads (
  download_id SERIAL PRIMARY KEY,

  -- Foreign key to spotify_tracks
  spotify_track_id TEXT NOT NULL REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Download status tracking
  download_status TEXT NOT NULL DEFAULT 'pending' CHECK (download_status IN ('pending', 'downloading', 'completed', 'failed')),

  -- File metadata
  freyr_output_path TEXT,
  file_size_bytes BIGINT,

  -- Timestamps
  download_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(spotify_track_id)
);

CREATE INDEX idx_karaoke_downloads_spotify_track ON karaoke_downloads(spotify_track_id);
CREATE INDEX idx_karaoke_downloads_status ON karaoke_downloads(download_status);

-- ========================================
-- 2. KARAOKE_SEGMENTS
-- Selected segments for karaoke processing
-- Handles fal.ai's 190-second limitation
-- ========================================
CREATE TABLE IF NOT EXISTS karaoke_segments (
  segment_id SERIAL PRIMARY KEY,

  -- Foreign key
  spotify_track_id TEXT NOT NULL REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Duration context
  full_duration_ms INTEGER NOT NULL,

  -- Selected segment timing (milliseconds)
  segment_start_ms INTEGER NOT NULL,
  segment_end_ms INTEGER NOT NULL,
  segment_duration_ms INTEGER NOT NULL,

  -- Selection metadata
  selection_reason TEXT, -- e.g., "full_track_within_190s_limit" or Gemini's reasoning

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(spotify_track_id)
);

CREATE INDEX idx_karaoke_segments_spotify_track ON karaoke_segments(spotify_track_id);
CREATE INDEX idx_karaoke_segments_duration ON karaoke_segments(segment_duration_ms);

-- ========================================
-- 3. LRCLIB_LYRICS
-- Cached synced lyrics from LRCLib API
-- ========================================
CREATE TABLE IF NOT EXISTS lrclib_lyrics (
  lrclib_id INTEGER PRIMARY KEY, -- LRCLib's ID

  -- Foreign key
  spotify_track_id TEXT REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Lyrics data
  synced_lyrics TEXT, -- LRC format with timestamps
  plain_lyrics TEXT,  -- Plain text without timestamps

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(spotify_track_id)
);

CREATE INDEX idx_lrclib_lyrics_spotify_track ON lrclib_lyrics(spotify_track_id);

-- ========================================
-- 4. KARAOKE_PRODUCTIONS
-- Master table tracking full karaoke production pipeline
-- ========================================
CREATE TABLE IF NOT EXISTS karaoke_productions (
  production_id SERIAL PRIMARY KEY,

  -- Foreign keys
  spotify_track_id TEXT NOT NULL REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,
  segment_id INTEGER REFERENCES karaoke_segments(segment_id) ON DELETE SET NULL,

  -- Processed audio paths/URIs
  vocals_path TEXT,
  instrumental_path TEXT,
  enhanced_instrumental_url TEXT, -- fal.ai output

  -- Aligned lyrics (ElevenLabs forced alignment)
  aligned_lyrics JSONB, -- Word-level timestamps

  -- Grove storage (immutable uploads)
  grove_instrumental_cid TEXT,
  grove_vocals_cid TEXT,
  grove_lyrics_cid TEXT,

  -- Processing status
  processing_status TEXT NOT NULL DEFAULT 'queued' CHECK (
    processing_status IN (
      'queued',
      'downloading',
      'segmenting',
      'separating',
      'enhancing',
      'aligning',
      'uploading',
      'completed',
      'failed'
    )
  ),

  -- Error tracking
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(spotify_track_id)
);

CREATE INDEX idx_karaoke_productions_spotify_track ON karaoke_productions(spotify_track_id);
CREATE INDEX idx_karaoke_productions_status ON karaoke_productions(processing_status);
CREATE INDEX idx_karaoke_productions_segment ON karaoke_productions(segment_id);

-- ========================================
-- TRIGGERS for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_karaoke_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_karaoke_downloads_updated_at
  BEFORE UPDATE ON karaoke_downloads
  FOR EACH ROW EXECUTE FUNCTION update_karaoke_updated_at();

CREATE TRIGGER update_karaoke_productions_updated_at
  BEFORE UPDATE ON karaoke_productions
  FOR EACH ROW EXECUTE FUNCTION update_karaoke_updated_at();

-- ========================================
-- SUCCESS MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Karaoke production tables created successfully!';
  RAISE NOTICE '   - karaoke_downloads';
  RAISE NOTICE '   - karaoke_segments';
  RAISE NOTICE '   - lrclib_lyrics';
  RAISE NOTICE '   - karaoke_productions';
END $$;
