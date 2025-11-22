/**
 * Migration 014: Add TikTok Task Types to audio_tasks Constraint
 *
 * Updates the task_type CHECK constraint to include the 4 new TikTok task types:
 * - upload_tiktok_grove: Upload TikTok video to Grove IPFS
 * - transcribe_tiktok: Transcribe TikTok video using hybrid Voxtral STT
 * - translate_tiktok: Translate TikTok transcript using Gemini
 * - post_tiktok_lens: Publish TikTok video to Lens Protocol
 *
 * This migration completes the polymorphic audio_tasks infrastructure
 * started in migration 012.
 */

-- Drop the old constraint
ALTER TABLE audio_tasks
  DROP CONSTRAINT IF EXISTS audio_tasks_task_type_check;

-- Add new constraint with all task types (tracks + TikTok videos)
ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_task_type_check
  CHECK (task_type IN (
    -- Track-level tasks
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
    -- TikTok video tasks
    'upload_tiktok_grove',
    'transcribe_tiktok',
    'translate_tiktok',
    'post_tiktok_lens'
  ));

-- Verify constraint is correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audio_tasks_task_type_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'audio_tasks_task_type_check constraint not found after migration';
  END IF;
END $$;
