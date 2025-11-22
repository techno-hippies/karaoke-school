-- Data Storage Schema
-- Processed lyrics, audio, alignments, translations, and segments

-- ============================================================================
-- Lyrics Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS song_lyrics (
  spotify_track_id TEXT PRIMARY KEY REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Original synced lyrics
  synced_lyrics TEXT,               -- LRC format with timestamps
  plain_lyrics TEXT,                -- Plain text (no timing)

  -- Normalized lyrics (AI-cleaned for karaoke)
  normalized_lyrics TEXT,

  -- Source metadata
  source TEXT,                      -- 'lrclib', 'lyrics.ovh', 'manual'
  language TEXT,

  -- Line count for segment planning
  line_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Audio Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS song_audio (
  spotify_track_id TEXT PRIMARY KEY REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Original audio
  grove_cid TEXT,                   -- Grove/IPFS CID
  grove_url TEXT,                   -- Full grove:// URL
  duration_ms INT,
  format TEXT,                      -- 'mp3', 'wav', 'flac'

  -- Separated stems (Demucs)
  instrumental_grove_cid TEXT,
  instrumental_grove_url TEXT,
  vocals_grove_cid TEXT,
  vocals_grove_url TEXT,

  -- Processing metadata
  download_source TEXT,             -- 'spotify', 'youtube', 'soulseek'
  acoustid_fingerprint TEXT,        -- Verification

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ElevenLabs Word Alignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS elevenlabs_word_alignments (
  spotify_track_id TEXT PRIMARY KEY REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Word-level timing
  words JSONB NOT NULL,             -- Array of {word, start_ms, end_ms, confidence}
  total_words INT,

  -- Line breaks
  lines JSONB,                      -- Array of {text, start_ms, end_ms, word_indices: [start, end]}

  -- Quality metrics
  avg_confidence FLOAT,
  low_confidence_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Multi-Language Translations
-- ============================================================================

CREATE TABLE IF NOT EXISTS lyrics_translations (
  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,      -- 'zh', 'vi', 'id'

  -- Translated content
  lines JSONB NOT NULL,             -- Array of {original, translated, start_ms, end_ms}

  -- Translation metadata
  translator TEXT,                  -- 'gemini', 'deepl', 'openai'
  quality_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (spotify_track_id, language_code)
);

CREATE INDEX idx_translations_track ON lyrics_translations(spotify_track_id);
CREATE INDEX idx_translations_language ON lyrics_translations(language_code);

-- ============================================================================
-- Karaoke Segments
-- ============================================================================

CREATE TABLE IF NOT EXISTS karaoke_segments (
  spotify_track_id TEXT PRIMARY KEY REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,

  -- Viral clip selection (40-100s best part, AI-selected from lyrics)
  clip_start_ms INT,
  clip_end_ms INT,

  -- Enhanced audio (fal.ai Stable Audio 2.5 → Grove)
  -- Note: Full song is processed via chunking (190s max per chunk), then merged
  fal_request_id TEXT,              -- fal.ai request ID for reference
  fal_enhanced_grove_cid TEXT,      -- Grove/IPFS CID (full merged song)
  fal_enhanced_grove_url TEXT,      -- Full Grove URL (full merged song)

  -- Cropped viral clip (Grove)
  clip_grove_cid TEXT,              -- Grove/IPFS CID
  clip_grove_url TEXT,              -- Full Grove URL

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Karaoke Lines (Line-level FSRS tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS karaoke_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,
  line_index INT NOT NULL,

  -- Line content
  original_text TEXT NOT NULL,
  normalized_text TEXT,

  -- Timing within track
  start_ms INT NOT NULL,
  end_ms INT NOT NULL,
  duration_ms INT,

  -- Word-level timing
  word_timings JSONB,               -- Array of {word, start_ms, end_ms}

  -- Segment association
  segment_hash BYTEA,               -- Blake3 hash of segment audio

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(spotify_track_id, line_index)
);

CREATE INDEX idx_karaoke_lines_track ON karaoke_lines(spotify_track_id);
CREATE INDEX idx_karaoke_lines_segment_hash ON karaoke_lines(segment_hash) WHERE segment_hash IS NOT NULL;

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER update_song_lyrics_timestamp
  BEFORE UPDATE ON song_lyrics
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_song_audio_timestamp
  BEFORE UPDATE ON song_audio
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_elevenlabs_word_alignments_timestamp
  BEFORE UPDATE ON elevenlabs_word_alignments
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_lyrics_translations_timestamp
  BEFORE UPDATE ON lyrics_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_karaoke_segments_timestamp
  BEFORE UPDATE ON karaoke_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_karaoke_lines_timestamp
  BEFORE UPDATE ON karaoke_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
