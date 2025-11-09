/**
 * Migration 006: Translation Quiz Questions
 *
 * Adds storage for per-line translation multiple-choice questions
 * and extends audio task/stage enums for the new quiz generation step.
 */

BEGIN;

-- ============================================================================
-- 1. Extend audio task enum with translation_quiz
-- ============================================================================

ALTER TABLE audio_tasks
  DROP CONSTRAINT IF EXISTS audio_tasks_task_type_check;

ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_task_type_check
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
      'encrypt'
    ));

-- ============================================================================
-- 2. Extend track stage enum with translation_quiz_ready
-- ============================================================================

ALTER TABLE tracks
  DROP CONSTRAINT IF EXISTS tracks_stage_check;

ALTER TABLE tracks
  ADD CONSTRAINT tracks_stage_check
    CHECK ((stage = ANY (ARRAY[
      'pending'::text,
      'discovered'::text,
      'matched'::text,
      'enriched'::text,
      'lyrics_acquired'::text,
      'audio_ready'::text,
      'aligned'::text,
      'translated'::text,
      'translation_quiz_ready'::text,
      'trivia_ready'::text,
      'separated'::text,
      'segmented'::text,
      'enhanced'::text,
      'ready'::text,
      'pkp_minted'::text,
      'lens_created'::text,
      'grc20_ready'::text,
      'grc20_submitted'::text,
      'encrypted'::text,
      'unlock_deployed'::text,
      'published'::text,
      'failed'::text
    ])));

-- ============================================================================
-- 3. Translation quiz question storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS song_translation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES karaoke_lines(line_id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('zh','vi','id')),
  prompt TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractors JSONB NOT NULL,
  choices JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(line_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_song_translation_questions_track
  ON song_translation_questions(spotify_track_id);

CREATE INDEX IF NOT EXISTS idx_song_translation_questions_line
  ON song_translation_questions(line_id);

COMMIT;
