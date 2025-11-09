import { query } from './connection';
import type { TriviaCategory } from '../types/trivia.ts';

export interface TriviaQuestionInput {
  spotifyTrackId: string;
  referentIds: number[];
  fragment: string;
  category: TriviaCategory;
  prompt: string;
  correctAnswer: string;
  explanation: string;
  distractors: string[];
  metadata?: Record<string, unknown>;
}

export interface TriviaLocalizationInput {
  questionId: string;
  languageCode: string;
  prompt: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
}

export async function clearTriviaForTrack(spotifyTrackId: string): Promise<void> {
  await query('DELETE FROM song_trivia_questions WHERE spotify_track_id = $1', [spotifyTrackId]);
}

export async function insertTriviaQuestions(
  questions: TriviaQuestionInput[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const question of questions) {
    const result = await query<{ id: string }>(
      `INSERT INTO song_trivia_questions (
        spotify_track_id,
        referent_ids,
        fragment,
        category,
        prompt,
        correct_answer,
        explanation,
        distractors,
        metadata
      ) VALUES (
        $1,
        $2::bigint[],
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9::jsonb
      )
      RETURNING id`,
      [
        question.spotifyTrackId,
        question.referentIds,
        question.fragment,
        question.category,
        question.prompt,
        question.correctAnswer,
        question.explanation,
        JSON.stringify(question.distractors),
        JSON.stringify(question.metadata ?? {}),
      ]
    );

    ids.push(result[0].id);
  }

  return ids;
}

export async function insertTriviaLocalizations(
  localizations: TriviaLocalizationInput[]
): Promise<void> {
  for (const localization of localizations) {
    await query(
      `INSERT INTO song_trivia_localizations (
        question_id,
        language_code,
        prompt,
        correct_answer,
        distractors,
        explanation
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6
      )
      ON CONFLICT (question_id, language_code) DO UPDATE SET
        prompt = EXCLUDED.prompt,
        correct_answer = EXCLUDED.correct_answer,
        distractors = EXCLUDED.distractors,
        explanation = EXCLUDED.explanation,
        updated_at = NOW()`,
      [
        localization.questionId,
        localization.languageCode,
        localization.prompt,
        localization.correctAnswer,
        JSON.stringify(localization.distractors),
        localization.explanation,
      ]
    );
  }
}

export async function getQuestionsWithoutLocalization(
  languageCode: string,
  limit: number
): Promise<
  Array<{ id: string; prompt: string; correctAnswer: string; distractors: string[]; explanation: string }>
> {
  return query(
    `SELECT q.id, q.prompt, q.correct_answer, q.distractors, COALESCE(q.explanation, '') AS explanation
     FROM song_trivia_questions q
     LEFT JOIN song_trivia_localizations l
       ON l.question_id = q.id AND l.language_code = $1
     WHERE l.id IS NULL
     ORDER BY q.created_at ASC
     LIMIT $2`,
    [languageCode, limit]
  ).then(rows =>
    rows.map(row => ({
      id: row.id,
      prompt: row.prompt,
      correctAnswer: row.correct_answer,
      distractors: row.distractors as string[],
      explanation: row.explanation,
    }))
  );
}

export const SUPPORTED_TRIVIA_LOCALES = ['zh', 'vi', 'id'] as const;

export async function getTriviaQuestionIdsForTrack(
  spotifyTrackId: string
): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM song_trivia_questions WHERE spotify_track_id = $1`,
    [spotifyTrackId]
  );

  return rows.map(row => row.id);
}
