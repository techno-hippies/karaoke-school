import { query } from './connection';

export interface TranslationQuestionInput {
  spotifyTrackId: string;
  lineId: string;
  languageCode: string;
  prompt: string;
  correctAnswer: string;
  distractors: string[];
  explanation?: string;
  metadata?: Record<string, unknown>;
}

export async function clearTranslationQuestionsForTrack(
  spotifyTrackId: string
): Promise<void> {
  await query('DELETE FROM song_translation_questions WHERE spotify_track_id = $1', [spotifyTrackId]);
}

export async function insertTranslationQuestions(
  entries: TranslationQuestionInput[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const entry of entries) {
    const result = await query<{ id: string }>(
      `INSERT INTO song_translation_questions (
        spotify_track_id,
        line_id,
        language_code,
        prompt,
        correct_answer,
        distractors,
        explanation,
        metadata
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8::jsonb
      )
      ON CONFLICT (line_id, language_code) DO UPDATE SET
        prompt = EXCLUDED.prompt,
        correct_answer = EXCLUDED.correct_answer,
        distractors = EXCLUDED.distractors,
        explanation = EXCLUDED.explanation,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id`
      ,
      [
        entry.spotifyTrackId,
        entry.lineId,
        entry.languageCode,
        entry.prompt,
        entry.correctAnswer,
        JSON.stringify(entry.distractors),
        entry.explanation ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ]
    );

    if (result.length === 0 || !result[0].id) {
      throw new Error('Failed to insert translation question (missing id)');
    }

    ids.push(result[0].id);
  }

  return ids;
}

export async function getTranslationQuestionIdsForTrack(
  spotifyTrackId: string
): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM song_translation_questions WHERE spotify_track_id = $1`,
    [spotifyTrackId]
  );

  return rows.map(row => row.id);
}
