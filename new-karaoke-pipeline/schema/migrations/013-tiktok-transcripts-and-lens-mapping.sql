-- Migration 013: TikTok transcripts table + Lens account TikTok handle mapping
--
-- Part 1: Create tiktok_transcripts table for storing STT/translation outputs
-- Part 2: Add tiktok_handle to lens_accounts for proper JOIN mapping

-- ============================================================================
-- Part 1: TikTok Transcripts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tiktok_transcripts (
  video_id TEXT PRIMARY KEY REFERENCES tiktok_videos(video_id) ON DELETE CASCADE,

  -- Cartesia STT outputs
  transcript_text TEXT NOT NULL,
  transcript_language TEXT NOT NULL,
  transcript_duration_s NUMERIC,
  transcript_word_count INTEGER,

  -- Gemini translation outputs
  translated_text TEXT,
  translation_target_language TEXT,
  translation_model TEXT,  -- e.g., 'gemini-flash-2.5-lite'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_transcripts_language
  ON tiktok_transcripts(transcript_language);

CREATE INDEX IF NOT EXISTS idx_tiktok_transcripts_translation_status
  ON tiktok_transcripts(video_id)
  WHERE translated_text IS NOT NULL;

COMMENT ON TABLE tiktok_transcripts IS 'Speech-to-text and translation outputs for TikTok videos (Cartesia STT → Gemini translation)';
COMMENT ON COLUMN tiktok_transcripts.transcript_text IS 'Original transcript from Cartesia Ink-Whisper STT';
COMMENT ON COLUMN tiktok_transcripts.transcript_language IS 'Detected language code (e.g., ''en'', ''es'', ''zh'')';
COMMENT ON COLUMN tiktok_transcripts.translated_text IS 'Translated caption from Gemini Flash 2.5 Lite';
COMMENT ON COLUMN tiktok_transcripts.translation_target_language IS 'Target language for translation (e.g., ''zh'', ''vi'', ''id'')';

-- ============================================================================
-- Part 2: Lens Account TikTok Handle Mapping
-- ============================================================================

-- Add tiktok_handle column for explicit mapping
ALTER TABLE lens_accounts
  ADD COLUMN IF NOT EXISTS tiktok_handle TEXT;

-- Add unique constraint (one Lens account per TikTok creator)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lens_accounts_tiktok_handle_unique
  ON lens_accounts(tiktok_handle)
  WHERE tiktok_handle IS NOT NULL;

-- Index for JOINs
CREATE INDEX IF NOT EXISTS idx_lens_accounts_tiktok_handle
  ON lens_accounts(tiktok_handle)
  WHERE account_type = 'tiktok_creator';

COMMENT ON COLUMN lens_accounts.tiktok_handle IS 'Original TikTok username (e.g., ''gioscottii'') for JOIN mapping to tiktok_videos.creator_username. Lens handle has ''-ks1'' suffix.';

-- ============================================================================
-- Part 3: Backfill tiktok_handle for existing TikTok creator accounts
-- ============================================================================

-- Extract TikTok username from Lens handle by removing '-ks1' suffix
UPDATE lens_accounts
SET tiktok_handle = REGEXP_REPLACE(lens_handle, '-ks1$', '')
WHERE account_type = 'tiktok_creator'
  AND lens_handle LIKE '%-ks1'
  AND tiktok_handle IS NULL;

-- Verification query (run manually after migration):
-- SELECT lens_handle, tiktok_handle, account_type
-- FROM lens_accounts
-- WHERE account_type = 'tiktok_creator';
