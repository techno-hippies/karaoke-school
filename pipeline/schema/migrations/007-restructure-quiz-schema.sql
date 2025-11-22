BEGIN;

-- Ensure distractor columns have sensible defaults
ALTER TABLE song_trivia_questions
  ALTER COLUMN distractors SET DEFAULT '[]'::jsonb;

ALTER TABLE song_trivia_questions
  ALTER COLUMN distractors SET NOT NULL;

ALTER TABLE song_trivia_localizations
  ADD COLUMN IF NOT EXISTS distractors JSONB DEFAULT '[]'::jsonb;

-- Trivia questions: add canonical correct answer derived from stored choices
ALTER TABLE song_trivia_questions
  ADD COLUMN IF NOT EXISTS correct_answer TEXT;

WITH extracted AS (
  SELECT id,
         (
           SELECT arr.value->>'text'
           FROM jsonb_array_elements(choices) WITH ORDINALITY AS arr(value, ordinality)
           WHERE arr.ordinality - 1 = correct_index
           LIMIT 1
         ) AS correct_text
  FROM song_trivia_questions
)
UPDATE song_trivia_questions q
SET correct_answer = extracted.correct_text
FROM extracted
WHERE extracted.id = q.id;

ALTER TABLE song_trivia_questions
  ALTER COLUMN correct_answer SET NOT NULL;

-- Trivia localizations: capture translated correct answer + distractors before dropping choices
ALTER TABLE song_trivia_localizations
  ADD COLUMN IF NOT EXISTS correct_answer TEXT;

WITH correct_labels AS (
  SELECT q.id AS question_id,
         (
           SELECT upper(arr.value->>'label')
           FROM jsonb_array_elements(q.choices) WITH ORDINALITY AS arr(value, ordinality)
           WHERE arr.ordinality - 1 = q.correct_index
           LIMIT 1
         ) AS correct_label
  FROM song_trivia_questions q
),
localized AS (
  SELECT
    l.id,
    (
      SELECT choice->>'text'
      FROM jsonb_array_elements(l.choices) choice
      JOIN correct_labels cl ON cl.question_id = l.question_id
      WHERE upper(choice->>'label') = cl.correct_label
      LIMIT 1
    ) AS correct_text,
    (
      SELECT COALESCE(jsonb_agg(choice->>'text'), '[]'::jsonb)
      FROM jsonb_array_elements(l.choices) choice
      JOIN correct_labels cl ON cl.question_id = l.question_id
      WHERE upper(choice->>'label') <> cl.correct_label
    ) AS distractor_array
  FROM song_trivia_localizations l
  JOIN correct_labels cl ON cl.question_id = l.question_id
)
UPDATE song_trivia_localizations l
SET correct_answer = localized.correct_text,
    distractors = localized.distractor_array
FROM localized
WHERE localized.id = l.id;

ALTER TABLE song_trivia_localizations
  ALTER COLUMN correct_answer SET NOT NULL;

ALTER TABLE song_trivia_localizations
  ALTER COLUMN distractors SET NOT NULL;

-- Drop legacy columns now that data is migrated
ALTER TABLE song_trivia_questions
  DROP COLUMN IF EXISTS choices,
  DROP COLUMN IF EXISTS correct_index;

ALTER TABLE song_trivia_localizations
  DROP COLUMN IF EXISTS choices;

-- Translation quiz table cleanup
ALTER TABLE song_translation_questions
  ALTER COLUMN distractors SET DEFAULT '[]'::jsonb;

ALTER TABLE song_translation_questions
  ALTER COLUMN distractors SET NOT NULL;

ALTER TABLE song_translation_questions
  DROP COLUMN IF EXISTS choices,
  DROP COLUMN IF EXISTS correct_index;

COMMIT;
