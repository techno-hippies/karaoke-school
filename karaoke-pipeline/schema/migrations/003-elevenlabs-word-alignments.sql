-- ElevenLabs Word Alignments Table
-- Stores forced alignment data: word-level + character-level timing from ElevenLabs API

CREATE TABLE IF NOT EXISTS elevenlabs_word_alignments (
  spotify_track_id TEXT PRIMARY KEY REFERENCES spotify_tracks(spotify_track_id) ON DELETE CASCADE,

  -- Word-level timing (primary data for karaoke)
  words JSONB NOT NULL,               -- [{text: "Moo", start: 0.099, end: 12.44, loss: 3.57}, ...]
  total_words INTEGER NOT NULL,

  -- Character-level timing (optional, for fine-grained display)
  characters JSONB,                   -- [{text: "M", start: 0.099, end: 0.15}, ...]
  total_characters INTEGER,

  -- Metadata
  alignment_duration_ms INTEGER,
  overall_loss NUMERIC(6,3),          -- Lower = better alignment quality

  -- Raw response (for debugging/reprocessing)
  raw_alignment_data JSONB,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_elevenlabs_alignment_created
  ON elevenlabs_word_alignments(created_at DESC);

CREATE INDEX idx_elevenlabs_alignment_quality
  ON elevenlabs_word_alignments(overall_loss ASC)
  WHERE overall_loss IS NOT NULL;

-- Trigger to update updated_at
CREATE TRIGGER elevenlabs_word_alignments_update
  BEFORE UPDATE ON elevenlabs_word_alignments
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- View for alignment quality monitoring
CREATE OR REPLACE VIEW alignment_quality_summary AS
SELECT
  COUNT(*) as total_alignments,
  ROUND(AVG(total_words), 0) as avg_words,
  ROUND(AVG(alignment_duration_ms / 1000.0), 1) as avg_duration_seconds,
  ROUND(AVG(overall_loss), 3) as avg_loss,
  COUNT(*) FILTER (WHERE overall_loss < 2.0) as high_quality_count,
  COUNT(*) FILTER (WHERE overall_loss BETWEEN 2.0 AND 5.0) as medium_quality_count,
  COUNT(*) FILTER (WHERE overall_loss > 5.0) as low_quality_count
FROM elevenlabs_word_alignments;
