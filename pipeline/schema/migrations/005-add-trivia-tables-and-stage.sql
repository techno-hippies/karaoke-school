/**
 * Migration 005: Trivia Question Tables & Stage Update
 *
 * Adds storage for song trivia questions and localized translations,
 * extends audio task enumeration with the new `trivia` task, and
 * introduces the `trivia_ready` stage for track progression.
 */

BEGIN;

-- ============================================================================
-- 1. Extend audio_tasks.task_type enum with `trivia`
-- ============================================================================

ALTER TABLE audio_tasks
  DROP CONSTRAINT IF EXISTS audio_tasks_task_type_check;

ALTER TABLE audio_tasks
  ADD CONSTRAINT audio_tasks_task_type_check
    CHECK (task_type IN (
      'download',
      'align',
      'translate',
      'trivia',
      'separate',
      'segment',
      'enhance',
      'clip',
      'encrypt'
    ));

COMMENT ON CONSTRAINT audio_tasks_task_type_check ON audio_tasks IS
  'Track-level tasks: audio processing (download→clip) + trivia generation + encryption';

-- ============================================================================
-- 2. Extend tracks.stage enum with `trivia_ready`
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

COMMENT ON CONSTRAINT tracks_stage_check ON tracks IS
  'Track stage progression including trivia readiness and downstream identity milestones';

-- ============================================================================
-- 3. Trivia question storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS song_trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id TEXT NOT NULL REFERENCES tracks(spotify_track_id) ON DELETE CASCADE,
  referent_ids BIGINT[] NOT NULL,
  fragment TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'meaning',
    'culture',
    'slang',
    'history',
    'idiom'
  )),
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL,
  distractors JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_trivia_questions_track
  ON song_trivia_questions(spotify_track_id);

COMMENT ON TABLE song_trivia_questions IS 'English-source trivia questions derived from Genius referents';
COMMENT ON COLUMN song_trivia_questions.choices IS 'JSON array of answer choices with labels and text';
COMMENT ON COLUMN song_trivia_questions.distractors IS 'Full pool of alternative choices for future rotations';
COMMENT ON COLUMN song_trivia_questions.metadata IS 'Optional metadata: referent classification, votes, annotation hashes, etc.';

-- ============================================================================
-- 4. Trivia localization storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS song_trivia_localizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES song_trivia_questions(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('zh', 'vi', 'id')),
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_song_trivia_localizations_question
  ON song_trivia_localizations(question_id);

COMMENT ON TABLE song_trivia_localizations IS 'Localized trivia content for supported karaoke study languages';

COMMIT;
