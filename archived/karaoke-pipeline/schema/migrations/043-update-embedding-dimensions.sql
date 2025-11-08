-- Update embedding dimensions from 768 (EmbeddingGemma) to 1536 (text-embedding-3-large)
-- OpenRouter embeddings instead of local Ollama
-- 1536 dimensions fits HNSW index limit of 2000 dimensions

-- Drop existing indexes (need to recreate after dimension change)
DROP INDEX IF EXISTS idx_video_transcriptions_embedding;
DROP INDEX IF EXISTS idx_transcription_translations_embedding;

-- Alter embedding columns to 1536 dimensions
ALTER TABLE tiktok_video_transcriptions
  ALTER COLUMN embedding TYPE vector(1536);

ALTER TABLE tiktok_video_transcription_translations
  ALTER COLUMN embedding TYPE vector(1536);

-- Recreate HNSW indexes
CREATE INDEX idx_video_transcriptions_embedding ON tiktok_video_transcriptions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_transcription_translations_embedding ON tiktok_video_transcription_translations
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Update comments
COMMENT ON COLUMN tiktok_video_transcriptions.embedding IS
  'text-embedding-3-large vector (1536-dim) via OpenRouter for similarity search against lrclib corpus';

COMMENT ON COLUMN tiktok_video_transcription_translations.embedding IS
  'text-embedding-3-large vector (1536-dim) via OpenRouter for cross-lingual similarity search';
