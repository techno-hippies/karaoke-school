/**
 * Migration 015: TikTok Multi-Language Translations
 *
 * Creates tiktok_translations table with composite primary key (video_id, language_code)
 * to support multiple translations per video (zh, vi, id) like lyrics_translations.
 *
 * Changes:
 * 1. Create tiktok_translations table with composite key
 * 2. Migrate existing data from tiktok_transcripts.translated_text
 * 3. Drop translation columns from tiktok_transcripts (keep transcript-only)
 * 4. Add indexes for efficient querying
 *
 * Pattern: Matches lyrics_translations schema for consistency
 */

-- ============================================================================
-- Step 1: Create tiktok_translations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tiktok_translations (
  video_id TEXT NOT NULL REFERENCES tiktok_videos(video_id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,  -- 'zh', 'vi', 'id'

  translated_text TEXT NOT NULL,
  translation_model TEXT NOT NULL,  -- e.g., 'google/gemini-2.5-flash-lite-preview-09-2025'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (video_id, language_code)
);

COMMENT ON TABLE tiktok_translations IS 'Multi-language translations for TikTok videos (zh/vi/id for language learning)';
COMMENT ON COLUMN tiktok_translations.language_code IS 'ISO 639-1 language code (zh, vi, id)';
COMMENT ON COLUMN tiktok_translations.translated_text IS 'Translated caption from Gemini for language learners';

-- ============================================================================
-- Step 2: Create indexes
-- ============================================================================

CREATE INDEX idx_tiktok_translations_video ON tiktok_translations(video_id);
CREATE INDEX idx_tiktok_translations_language ON tiktok_translations(language_code);

-- ============================================================================
-- Step 3: Migrate existing data
-- ============================================================================

-- Migrate single-language translations from tiktok_transcripts to tiktok_translations
INSERT INTO tiktok_translations (video_id, language_code, translated_text, translation_model, created_at, updated_at)
SELECT
  video_id,
  COALESCE(translation_target_language, 'zh') as language_code,
  translated_text,
  COALESCE(translation_model, 'google/gemini-2.5-flash-lite-preview-09-2025') as translation_model,
  updated_at as created_at,
  updated_at
FROM tiktok_transcripts
WHERE translated_text IS NOT NULL
ON CONFLICT (video_id, language_code) DO NOTHING;

-- ============================================================================
-- Step 4: Drop translation columns from tiktok_transcripts
-- ============================================================================

-- Keep tiktok_transcripts focused on transcription only (STT)
-- Translations now live in separate table for multi-language support
ALTER TABLE tiktok_transcripts
  DROP COLUMN IF EXISTS translated_text,
  DROP COLUMN IF EXISTS translation_target_language,
  DROP COLUMN IF EXISTS translation_model;

-- Drop old indexes
DROP INDEX IF EXISTS idx_tiktok_transcripts_translation_status;

-- ============================================================================
-- Step 5: Verification
-- ============================================================================

DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tiktok_translations') THEN
    RAISE EXCEPTION 'tiktok_translations table not created';
  END IF;

  -- Verify composite primary key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tiktok_translations_pkey'
      AND contype = 'p'
  ) THEN
    RAISE EXCEPTION 'tiktok_translations primary key not found';
  END IF;

  -- Verify columns dropped from tiktok_transcripts
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiktok_transcripts'
      AND column_name = 'translated_text'
  ) THEN
    RAISE EXCEPTION 'translated_text column not dropped from tiktok_transcripts';
  END IF;

  RAISE NOTICE 'Migration 015 completed successfully';
END $$;
