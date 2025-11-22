#!/usr/bin/env bun

import '../../env';

import { query } from '../../db/connection';
import {
  emitTranslationQuestionOnChain,
  exerciseEventsEnabled,
  uploadExerciseMetadata,
} from './exercise-events';

import { bytesToHex } from '../../utils/hex';

interface TranslationQuestionRow {
  id: string;
  spotify_track_id: string;
  line_id: string;
  language_code: string;
  prompt: string;
  correct_answer: string;
  distractors: any;
  explanation: string | null;
  metadata: any;
  line_index: number;
  segment_hash: any;
}

function normalizeDistractors(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw.map(value => String(value));
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeDistractors(parsed);
    } catch (_error) {
      return [raw];
    }
  }

  return [];
}

function mergeMetadata(original: any, segmentHash: string): Record<string, unknown> {
  const base = typeof original === 'object' && original !== null ? original : {};
  return {
    ...base,
    segment_hash: segmentHash,
  };
}

async function fetchQuestions(trackFilter?: string): Promise<TranslationQuestionRow[]> {
  if (trackFilter) {
    return query(
      `SELECT q.id,
              q.spotify_track_id,
              q.line_id,
              q.language_code,
              q.prompt,
              q.correct_answer,
              q.distractors,
              q.explanation,
              q.metadata,
              kl.line_index,
              kl.segment_hash
         FROM song_translation_questions q
         JOIN karaoke_lines kl ON kl.line_id::text = q.line_id::text
        WHERE q.spotify_track_id = $1`,
      [trackFilter]
    );
  }

  return query(
    `SELECT q.id,
            q.spotify_track_id,
            q.line_id,
            q.language_code,
            q.prompt,
            q.correct_answer,
            q.distractors,
            q.explanation,
            q.metadata,
            kl.line_index,
            kl.segment_hash
       FROM song_translation_questions q
       JOIN karaoke_lines kl ON kl.line_id::text = q.line_id::text
      WHERE (q.metadata->>'segment_hash') IS NULL
         OR q.metadata->>'segment_hash' = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      ORDER BY q.spotify_track_id, kl.line_index`,
    []
  );
}

async function updateQuestionMetadata(questionId: string, metadata: Record<string, unknown>): Promise<void> {
  await query(
    `UPDATE song_translation_questions
        SET metadata = $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [questionId, JSON.stringify(metadata)]
  );
}

async function processQuestion(question: TranslationQuestionRow): Promise<void> {
  const segmentHashHex = bytesToHex(question.segment_hash);
  if (!segmentHashHex) {
    console.warn(`⚠️  Skipping question ${question.id} - missing segment hash`);
    return;
  }

  const distractors = normalizeDistractors(question.distractors);

  const metadataObject = mergeMetadata(question.metadata, segmentHashHex);

  const payload = {
    questionId: question.id,
    exerciseType: 'translation_multiple_choice',
    spotifyTrackId: question.spotify_track_id,
    segmentHash: segmentHashHex,
    lineId: question.line_id,
    lineIndex: question.line_index,
    languageCode: question.language_code,
    prompt: question.prompt,
    correctAnswer: question.correct_answer,
    distractorPool: distractors,
    explanation: question.explanation ?? undefined,
    metadata: metadataObject,
    generatedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const metadataUri = await uploadExerciseMetadata(
    `translation-quiz-${question.id}.json`,
    payload
  );

  await updateQuestionMetadata(question.id, metadataObject);

  if (exerciseEventsEnabled) {
    await emitTranslationQuestionOnChain({
      questionUuid: question.id,
      lineUuid: question.line_id,
      segmentHash: segmentHashHex,
      lineIndex: question.line_index,
      spotifyTrackId: question.spotify_track_id,
      languageCode: question.language_code,
      metadataUri,
      distractorPoolSize: distractors.length,
    });
  } else {
    console.warn('⚠️  ExerciseEvents disabled; metadata updated without on-chain emission');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const trackArg = args.find(arg => arg.startsWith('--track='));
  const trackFilter = trackArg ? trackArg.split('=')[1] : undefined;

  const questions = await fetchQuestions(trackFilter);

  if (questions.length === 0) {
    console.log('No translation questions require updates.');
    return;
  }

  console.log(`Updating ${questions.length} translation question(s).`);

  for (const question of questions) {
    try {
      await processQuestion(question);
    } catch (error) {
      console.error(`✗ Failed to update question ${question.id}:`, error);
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error updating translation questions:', error);
    process.exit(1);
  });
}

export { main as updateTranslationQuestions };
