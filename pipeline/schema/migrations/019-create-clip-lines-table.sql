-- Migration 019: Create clip_lines table for clip-specific lyrics
-- Author: Claude Code
-- Date: 2025-01-13
--
-- Purpose: Materialize clip-specific lyrics for karaoke grading
-- Dependencies: karaoke_lines, karaoke_segments
-- Triggered by: audio_tasks.generate_clip_lines task

-- ============================================================================
-- Clip Lines Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS clip_lines (
  id SERIAL PRIMARY KEY,

  -- Foreign keys
  line_id UUID NOT NULL REFERENCES karaoke_lines(line_id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Clip boundary context (denormalized for queries)
  clip_start_ms INT NOT NULL,
  clip_end_ms INT NOT NULL,

  -- Line positioning
  clip_line_index INT NOT NULL,  -- 0-indexed position within clip
  original_line_index INT NOT NULL,  -- Original line_index from karaoke_lines

  -- Line content (denormalized from karaoke_lines)
  original_text TEXT NOT NULL,
  normalized_text TEXT,

  -- Timing - absolute from track start
  start_ms INT NOT NULL,
  end_ms INT NOT NULL,
  duration_ms INT,

  -- Timing - relative to clip start (useful for playback)
  clip_relative_start_ms INT NOT NULL,
  clip_relative_end_ms INT NOT NULL,

  -- Word-level timing (JSON from karaoke_lines)
  word_timings JSONB,

  -- Segment hash (for contract events)
  segment_hash BYTEA,

  -- Line boundary flags
  starts_before_clip BOOLEAN NOT NULL DEFAULT FALSE,  -- Line started before clip
  ends_after_clip BOOLEAN NOT NULL DEFAULT FALSE,     -- Line ends after clip

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraints
  UNIQUE(spotify_track_id, clip_line_index),
  UNIQUE(line_id)  -- Each karaoke_line appears in at most one clip
);

-- Indexes for efficient queries
CREATE INDEX idx_clip_lines_track ON clip_lines(spotify_track_id);
CREATE INDEX idx_clip_lines_line_id ON clip_lines(line_id);
CREATE INDEX idx_clip_lines_track_clip_index ON clip_lines(spotify_track_id, clip_line_index);
CREATE INDEX idx_clip_lines_segment_hash ON clip_lines(segment_hash) WHERE segment_hash IS NOT NULL;

-- Index for boundary analysis
CREATE INDEX idx_clip_lines_boundary_flags ON clip_lines(spotify_track_id, starts_before_clip, ends_after_clip)
  WHERE starts_before_clip = TRUE OR ends_after_clip = TRUE;

-- Comment for documentation
COMMENT ON TABLE clip_lines IS 'Materialized clip-specific lyrics filtered from karaoke_lines by clip boundaries';
COMMENT ON COLUMN clip_lines.clip_line_index IS '0-indexed position within clip (for frontend ordering)';
COMMENT ON COLUMN clip_lines.original_line_index IS 'Original line_index from karaoke_lines table (for debugging)';
COMMENT ON COLUMN clip_lines.clip_relative_start_ms IS 'Line start time relative to clip_start_ms (0 = clip start)';
COMMENT ON COLUMN clip_lines.starts_before_clip IS 'TRUE if line starts before clip boundary (partial line)';
COMMENT ON COLUMN clip_lines.ends_after_clip IS 'TRUE if line ends after clip boundary (partial line)';

-- ============================================================================
-- Add Grove URL columns to karaoke_segments for clip lyrics
-- ============================================================================

ALTER TABLE karaoke_segments
ADD COLUMN IF NOT EXISTS clip_lyrics_grove_cid TEXT,
ADD COLUMN IF NOT EXISTS clip_lyrics_grove_url TEXT;

CREATE INDEX IF NOT EXISTS idx_karaoke_segments_clip_lyrics_cid
  ON karaoke_segments(clip_lyrics_grove_cid)
  WHERE clip_lyrics_grove_cid IS NOT NULL;

COMMENT ON COLUMN karaoke_segments.clip_lyrics_grove_cid IS 'Grove CID for clip-specific lyrics JSON';
COMMENT ON COLUMN karaoke_segments.clip_lyrics_grove_url IS 'Grove URL for clip-specific lyrics (grove://...)';

-- ============================================================================
-- Update audio_tasks task_type constraint
-- ============================================================================

-- Drop existing constraint
ALTER TABLE audio_tasks DROP CONSTRAINT IF EXISTS audio_tasks_task_type_check;

-- Add new constraint with generate_clip_lines
ALTER TABLE audio_tasks ADD CONSTRAINT audio_tasks_task_type_check
  CHECK (task_type IN (
    'download',
    'align',
    'translate',
    'translation_quiz',
    'trivia',
    'separate',
    'segment',
    'enhance',
    'clip',
    'encrypt',
    'generate_clip_lines',
    'post_tiktok_lens',
    'transcribe_tiktok',
    'translate_tiktok',
    'upload_tiktok_grove'
  ));

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================

-- Count clip lines vs full lines
-- Expected: ~25-30% of lines fall within clips
-- SELECT
--   COUNT(DISTINCT kl.spotify_track_id) as tracks_with_lines,
--   COUNT(kl.line_id) as total_lines,
--   COUNT(cl.line_id) as clip_lines,
--   ROUND(100.0 * COUNT(cl.line_id) / NULLIF(COUNT(kl.line_id), 0), 1) as clip_percentage
-- FROM karaoke_lines kl
-- LEFT JOIN clip_lines cl ON kl.line_id = cl.line_id;

-- Check boundary edge cases
-- SELECT
--   spotify_track_id,
--   COUNT(*) as total_lines,
--   COUNT(*) FILTER (WHERE starts_before_clip) as starts_before,
--   COUNT(*) FILTER (WHERE ends_after_clip) as ends_after
-- FROM clip_lines
-- GROUP BY spotify_track_id
-- HAVING COUNT(*) FILTER (WHERE starts_before_clip OR ends_after_clip) > 0;
