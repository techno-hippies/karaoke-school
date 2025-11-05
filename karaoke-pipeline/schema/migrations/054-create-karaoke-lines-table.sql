-- Migration: Create karaoke_lines table for line-level FSRS tracking
-- Purpose: Enable FSRS spaced repetition per line instead of per segment
-- Timing Model: Lines use ABSOLUTE timing (ms from track start), not relative to segment

-- ============================================================
-- KARAOKE LINES TABLE
-- ============================================================
-- Each line is a unique study card for FSRS
-- Lines are language-agnostic (shared across all translations)
-- Line IDs are stable even if content is re-processed

CREATE TABLE karaoke_lines (
  -- Primary key: UUID for stable references
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Natural key: (spotify_track_id, line_index)
  spotify_track_id TEXT NOT NULL REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,
  line_index INT NOT NULL,
  
  -- ABSOLUTE timing (milliseconds from track start)
  -- NOT relative to segment - lines may extend beyond segment boundaries
  start_ms INT NOT NULL,
  end_ms INT NOT NULL,
  duration_ms INT GENERATED ALWAYS AS (end_ms - start_ms) STORED,
  
  -- Line content (denormalized from lyrics_translations for fast queries)
  original_text TEXT NOT NULL,
  word_count INT NOT NULL,
  
  -- Word-level timing (also ABSOLUTE ms from track start)
  words JSONB NOT NULL,
  -- Example: [{"text": "I", "start": 24.8, "end": 24.94}, ...]
  
  -- Segment association (computed - which segment does this line belong to?)
  -- A line "belongs to" a segment if its start time is within segment boundaries
  segment_hash BYTEA,
  
  -- Metadata
  alignment_source TEXT DEFAULT 'elevenlabs',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT karaoke_lines_natural_key UNIQUE (spotify_track_id, line_index),
  CONSTRAINT karaoke_lines_timing_valid CHECK (start_ms < end_ms),
  CONSTRAINT karaoke_lines_word_count_positive CHECK (word_count > 0)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Fast lookup by track (for study session queries)
CREATE INDEX idx_karaoke_lines_track 
  ON karaoke_lines(spotify_track_id, line_index);

-- Fast lookup by segment (for filtering lines to karaoke segment)
CREATE INDEX idx_karaoke_lines_segment 
  ON karaoke_lines(segment_hash) 
  WHERE segment_hash IS NOT NULL;

-- Fast lookup by timing (for playback sync)
CREATE INDEX idx_karaoke_lines_timing 
  ON karaoke_lines(spotify_track_id, start_ms, end_ms);

-- Fast lookup for lines needing segment association
CREATE INDEX idx_karaoke_lines_needs_segment 
  ON karaoke_lines(spotify_track_id) 
  WHERE segment_hash IS NULL;

-- ============================================================
-- HELPER FUNCTION: Generate stable segment hash
-- ============================================================
-- Matches contract logic: keccak256(spotifyTrackId, segmentStartMs)

CREATE OR REPLACE FUNCTION compute_segment_hash(
  p_spotify_track_id TEXT,
  p_segment_start_ms INT
) RETURNS BYTEA AS $$
BEGIN
  -- For PostgreSQL: Use sha256 (close enough to keccak256 for demo purposes)
  -- In production, use a proper keccak256 implementation or pre-compute from contracts
  RETURN digest(p_spotify_track_id || p_segment_start_ms::TEXT, 'sha256');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- TRIGGER: Update segment_hash when lines are inserted/updated
-- ============================================================

CREATE OR REPLACE FUNCTION update_line_segment_association() 
RETURNS TRIGGER AS $$
BEGIN
  -- Find which segment this line belongs to (if any)
  -- A line belongs to a segment if its start time is within segment boundaries
  SELECT compute_segment_hash(ks.spotify_track_id, ks.optimal_segment_start_ms)
  INTO NEW.segment_hash
  FROM karaoke_segments ks
  WHERE ks.spotify_track_id = NEW.spotify_track_id
    AND NEW.start_ms >= ks.optimal_segment_start_ms
    AND NEW.start_ms < ks.optimal_segment_end_ms
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_karaoke_lines_segment_association
  BEFORE INSERT OR UPDATE ON karaoke_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_line_segment_association();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE karaoke_lines IS 
  'Line-level study cards for FSRS spaced repetition. Each line is a unique practice unit.';

COMMENT ON COLUMN karaoke_lines.line_id IS 
  'Stable UUID for referencing this line in contracts/events. Does not change if content is re-processed.';

COMMENT ON COLUMN karaoke_lines.start_ms IS 
  'ABSOLUTE timing: milliseconds from original track start (not relative to segment).';

COMMENT ON COLUMN karaoke_lines.end_ms IS 
  'ABSOLUTE timing: milliseconds from original track start (not relative to segment).';

COMMENT ON COLUMN karaoke_lines.segment_hash IS 
  'Which karaoke segment does this line belong to? NULL if line is outside all segments.';

COMMENT ON COLUMN karaoke_lines.words IS 
  'Word-level timing for highlighting. Timing is ABSOLUTE (ms from track start).';

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Grant read access to application role (if you have one)
-- GRANT SELECT ON karaoke_lines TO app_readonly;
