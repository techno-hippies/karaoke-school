-- Karaoke Segments Table (CLEAN VERSION - 10 columns)
-- Tracks AI segment selection + fal.ai enhancement ONLY
-- References song_audio for instrumentals (already separated by Demucs)

DROP TABLE IF EXISTS karaoke_segments CASCADE;

CREATE TABLE karaoke_segments (
  spotify_track_id TEXT PRIMARY KEY
    REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- AI-selected optimal 190s karaoke segment (for songs ≥190s only)
  optimal_segment_start_ms INTEGER,
  optimal_segment_end_ms INTEGER,

  -- AI-selected best clip (20-50s) for ALL songs
  clip_start_ms INTEGER,
  clip_end_ms INTEGER,

  -- fal.ai enhanced instrumental (from song_audio.instrumental_grove_url)
  fal_enhanced_grove_cid TEXT,
  fal_enhanced_grove_url TEXT,
  fal_processing_duration_seconds NUMERIC(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pipeline queries
CREATE INDEX idx_karaoke_segments_needs_selection
  ON karaoke_segments(spotify_track_id)
  WHERE clip_start_ms IS NULL;

CREATE INDEX idx_karaoke_segments_needs_fal
  ON karaoke_segments(spotify_track_id)
  WHERE clip_start_ms IS NOT NULL
    AND fal_enhanced_grove_cid IS NULL;

CREATE INDEX idx_karaoke_segments_complete
  ON karaoke_segments(spotify_track_id)
  WHERE fal_enhanced_grove_cid IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER karaoke_segments_update
  BEFORE UPDATE ON karaoke_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

COMMENT ON TABLE karaoke_segments IS
  'AI-selected karaoke segments and fal.ai enhanced instrumentals. References song_audio for base instrumentals.';

COMMENT ON COLUMN karaoke_segments.optimal_segment_start_ms IS
  'AI-selected start (ms) for optimal 190s karaoke segment. NULL for songs <190s (use full track).';

COMMENT ON COLUMN karaoke_segments.clip_start_ms IS
  'AI-selected start (ms) for best 20-50s clip (all songs).';

COMMENT ON COLUMN karaoke_segments.fal_enhanced_grove_cid IS
  'fal.ai enhanced instrumental CID (Stable Audio 2.5). For songs <190s: full track. For songs ≥190s: 190s segment.';
