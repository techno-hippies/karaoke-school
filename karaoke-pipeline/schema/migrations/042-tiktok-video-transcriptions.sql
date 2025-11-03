-- TikTok Video Transcription System
-- STT transcriptions of what creators SAY in videos (not song lyrics)
-- Uses Voxtral (Mistral) for STT, Gemini for translations, Ollama embeddings for future VSS

-- =====================================================
-- 0. Enable pgvector extension
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. Main transcriptions table
-- =====================================================
CREATE TABLE IF NOT EXISTS tiktok_video_transcriptions (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE REFERENCES tiktok_videos(video_id) ON DELETE CASCADE,

  -- Voxtral STT result
  transcription_text TEXT NOT NULL,
  detected_language CHAR(2) NOT NULL,        -- ISO 639-1: "en", "zh", "vi", etc.
  duration_seconds INTEGER,
  confidence_score NUMERIC(3,2),             -- 0.00-1.00

  -- Processing metadata
  voxtral_model TEXT DEFAULT 'voxtral-mini-latest',
  processing_time_ms INTEGER,

  -- Vector embedding for future similarity search against lrclib corpus
  -- (768 dimensions - EmbeddingGemma via Ollama)
  embedding vector(768),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Not yet processed
    'processing',       -- Currently transcribing
    'transcribed',      -- Voxtral complete, no translations yet
    'translated',       -- All target languages translated
    'failed'            -- Transcription or translation failed
  )),

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  transcribed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_video_transcriptions_status ON tiktok_video_transcriptions(status)
  WHERE status NOT IN ('translated', 'failed');

CREATE INDEX idx_video_transcriptions_language ON tiktok_video_transcriptions(detected_language);

-- Vector similarity search index (HNSW for fast ANN search against lrclib corpus)
CREATE INDEX idx_video_transcriptions_embedding ON tiktok_video_transcriptions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);


-- =====================================================
-- 2. Multi-language translations table
-- =====================================================
CREATE TABLE IF NOT EXISTS tiktok_video_transcription_translations (
  id SERIAL PRIMARY KEY,
  transcription_id INTEGER NOT NULL REFERENCES tiktok_video_transcriptions(id) ON DELETE CASCADE,

  -- Target language
  language_code CHAR(2) NOT NULL CHECK (length(language_code) = 2), -- ISO 639-1
  translated_text TEXT NOT NULL,

  -- Translation metadata
  translation_source TEXT DEFAULT 'gemini-flash-2.5-lite',
  confidence_score NUMERIC(3,2),             -- 0.00-1.00

  -- Vector embedding for translated text (for cross-lingual similarity)
  embedding vector(768),

  -- Timestamps
  translated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(transcription_id, language_code)
);

-- Indexes
CREATE INDEX idx_transcription_translations_transcription ON tiktok_video_transcription_translations(transcription_id);
CREATE INDEX idx_transcription_translations_language ON tiktok_video_transcription_translations(language_code);

-- Vector similarity search index for translations
CREATE INDEX idx_transcription_translations_embedding ON tiktok_video_transcription_translations
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);


-- =====================================================
-- 3. Translation languages configuration (scalable to any number)
-- =====================================================
CREATE TABLE IF NOT EXISTS tiktok_translation_languages (
  language_code CHAR(2) PRIMARY KEY,
  language_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,               -- Higher priority = process first

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default target languages (Mandarin, Vietnamese priority)
INSERT INTO tiktok_translation_languages (language_code, language_name, priority) VALUES
  ('zh', 'Mandarin Chinese (Simplified)', 100),
  ('vi', 'Vietnamese', 90),
  ('id', 'Indonesian', 80),
  ('es', 'Spanish', 70),
  ('ja', 'Japanese', 60),
  ('ko', 'Korean', 50),
  ('fr', 'French', 40),
  ('de', 'German', 30),
  ('pt', 'Portuguese', 20),
  ('th', 'Thai', 10)
ON CONFLICT (language_code) DO NOTHING;


-- =====================================================
-- 4. Views for monitoring and queries
-- =====================================================

-- Summary view of transcription processing status
CREATE OR REPLACE VIEW tiktok_transcription_summary AS
SELECT
  status,
  COUNT(*) as count,
  COUNT(DISTINCT detected_language) as unique_languages,
  ROUND(AVG(confidence_score), 2) as avg_confidence,
  ROUND(AVG(processing_time_ms) / 1000.0, 1) as avg_processing_seconds,
  COUNT(*) FILTER (WHERE retry_count >= 3) as max_retries_reached,
  MIN(transcribed_at) as oldest_processed,
  MAX(transcribed_at) as newest_processed
FROM tiktok_video_transcriptions
GROUP BY status
ORDER BY
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'transcribed' THEN 3
    WHEN 'translated' THEN 4
    WHEN 'failed' THEN 5
  END;

-- Videos ready for transcription (not yet processed)
CREATE OR REPLACE VIEW videos_ready_for_transcription AS
SELECT
  v.video_id,
  v.creator_username,
  v.description,
  v.duration_seconds,
  v.play_count,
  v.video_url,
  v.video_created_at
FROM tiktok_videos v
WHERE NOT EXISTS (
  SELECT 1 FROM tiktok_video_transcriptions t
  WHERE t.video_id = v.video_id
)
AND v.video_url IS NOT NULL
AND v.duration_seconds > 0
ORDER BY v.play_count DESC NULLS LAST;

-- Fully processed videos with all translations
CREATE OR REPLACE VIEW tiktok_videos_fully_transcribed AS
SELECT
  t.video_id,
  t.transcription_text,
  t.detected_language,
  t.confidence_score,
  v.creator_username,
  v.video_url,

  -- Translation stats
  COUNT(tr.id) as translation_count,
  ARRAY_AGG(tr.language_code ORDER BY tr.language_code) as translated_languages,

  t.transcribed_at
FROM tiktok_video_transcriptions t
JOIN tiktok_videos v ON t.video_id = v.video_id
LEFT JOIN tiktok_video_transcription_translations tr ON tr.transcription_id = t.id
WHERE t.status = 'translated'
GROUP BY t.id, t.video_id, t.transcription_text, t.detected_language,
         t.confidence_score, v.creator_username, v.video_url, t.transcribed_at;


-- =====================================================
-- 5. Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER tiktok_video_transcriptions_update
  BEFORE UPDATE ON tiktok_video_transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Auto-update transcription status when all translations complete
CREATE OR REPLACE FUNCTION check_transcription_completion()
RETURNS TRIGGER AS $$
DECLARE
  enabled_langs_count INTEGER;
  translations_count INTEGER;
BEGIN
  -- Count enabled target languages
  SELECT COUNT(*) INTO enabled_langs_count
  FROM tiktok_translation_languages
  WHERE enabled = TRUE;

  -- Count completed translations for this transcription
  SELECT COUNT(*) INTO translations_count
  FROM tiktok_video_transcription_translations
  WHERE transcription_id = NEW.transcription_id;

  -- If all languages translated, update parent status
  IF translations_count >= enabled_langs_count THEN
    UPDATE tiktok_video_transcriptions
    SET status = 'translated', updated_at = NOW()
    WHERE id = NEW.transcription_id
      AND status = 'transcribed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_transcription_completion_trigger
  AFTER INSERT ON tiktok_video_transcription_translations
  FOR EACH ROW
  EXECUTE FUNCTION check_transcription_completion();


-- =====================================================
-- 6. Comments for documentation
-- =====================================================
COMMENT ON TABLE tiktok_video_transcriptions IS
  'Speech-to-text transcriptions of TikTok creator videos using Voxtral (Mistral).
   Stores what creators SAY in videos (not song lyrics).
   Embeddings stored for future VSS comparison against lrclib lyrics corpus.';

COMMENT ON TABLE tiktok_video_transcription_translations IS
  'Multi-language translations of video transcriptions via Gemini Flash 2.5-lite.
   Scalable to any number of languages via tiktok_translation_languages config.';

COMMENT ON COLUMN tiktok_video_transcriptions.embedding IS
  'EmbeddingGemma vector (768-dim) for future similarity search against lrclib corpus';

COMMENT ON COLUMN tiktok_video_transcription_translations.embedding IS
  'EmbeddingGemma vector (768-dim) for cross-lingual similarity search';
