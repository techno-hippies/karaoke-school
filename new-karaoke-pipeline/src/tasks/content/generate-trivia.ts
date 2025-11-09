#!/usr/bin/env bun

import '../../env';
import { query } from '../../db/connection';
import {
  ensureAudioTask,
  startTask,
  completeTask,
  failTask,
  updateTrackStage,
} from '../../db/audio-tasks';
import { AudioTaskType, TrackStage } from '../../db/task-stages';
import {
  clearTriviaForTrack,
  insertTriviaQuestions,
  TriviaQuestionInput,
  getTriviaQuestionIdsForTrack,
} from '../../db/trivia';
import { OpenRouterService } from '../../services/openrouter';
import type { TriviaCategory } from '../../types/trivia.ts';
import {
  MAX_EXPLANATION_LENGTH,
  normalizeCategory,
  WORD_LIMIT_PER_CHOICE,
  countWords,
  flattenAnnotation,
  dedupeChoiceTexts,
  sanitizeChoiceText,
  sanitizeLyrics,
} from './trivia-utils';
import {
  exerciseEventsEnabled,
  uploadExerciseMetadata,
  emitTriviaQuestionOnChain,
  toggleExerciseQuestion,
} from './exercise-events';

interface TrackRow {
  spotify_track_id: string;
  title: string;
  artists: any;
  normalized_lyrics: string;
  genius_song_id: number;
}

interface ReferentRow {
  referent_id: number;
  fragment: string;
  classification: string | null;
  votes_total: number | null;
  comment_count: number | null;
  is_verified: boolean | null;
  annotations: any;
}

const MIN_REFERENTS_FOR_TRIVIA = 2;
const MAX_QUESTIONS = 8;
const TRIVIA_DISTRACTOR_POOL = 6;
const ONCHAIN_DELAY_MS = 500;
const TRIVIA_BASE_LANGUAGE = 'en';
function validateQuestionPayload(
  rawQuestion: any,
  referentMap: Map<string, ReferentRow>
): Omit<TriviaQuestionInput, 'spotifyTrackId'> {
  if (!rawQuestion || typeof rawQuestion !== 'object') {
    throw new Error('Question payload is not an object');
  }

  const reference = rawQuestion.reference;
  if (!reference || typeof reference.referent_id === 'undefined') {
    throw new Error('Question is missing referent reference');
  }

  const referentId = String(reference.referent_id);
  const referent = referentMap.get(referentId);
  if (!referent) {
    throw new Error(`Unknown referent referenced in question: ${referentId}`);
  }

  const candidateCategory = String(rawQuestion.category || 'meaning');
  const category = normalizeCategory(candidateCategory);

  const prompt = String(rawQuestion.prompt || '').trim();
  if (!prompt) {
    throw new Error('Prompt is empty');
  }

  const correctAnswer = String(rawQuestion.correct_answer || '').trim();
  if (!correctAnswer) {
    throw new Error('Correct answer is empty');
  }

  if (countWords(correctAnswer) > WORD_LIMIT_PER_CHOICE) {
    throw new Error('Correct answer exceeds word limit');
  }

  const explanation = String(rawQuestion.explanation || '').trim();
  if (explanation.length > MAX_EXPLANATION_LENGTH) {
    throw new Error('Explanation exceeds length limit');
  }

  const rawDistractors = Array.isArray(rawQuestion.distractors)
    ? rawQuestion.distractors
    : Array.isArray(rawQuestion.distractor_pool)
      ? rawQuestion.distractor_pool
      : [];

  if (!Array.isArray(rawDistractors) || rawDistractors.length < TRIVIA_DISTRACTOR_POOL) {
    throw new Error(`Need at least ${TRIVIA_DISTRACTOR_POOL} distractors`);
  }

  const correctLower = correctAnswer.toLowerCase();
  const sanitizedDistractors = dedupeChoiceTexts(
    rawDistractors
      .map((entry: any) => sanitizeChoiceText(String(entry ?? '')))
      .filter((text) => text && text.toLowerCase() !== correctLower)
  );

  if (sanitizedDistractors.length < TRIVIA_DISTRACTOR_POOL) {
    throw new Error(`Need at least ${TRIVIA_DISTRACTOR_POOL} unique distractors`);
  }

  for (const option of sanitizedDistractors) {
    if (countWords(option) > WORD_LIMIT_PER_CHOICE) {
      throw new Error(`Distractor "${option}" exceeds word limit (${WORD_LIMIT_PER_CHOICE})`);
    }
  }

  return {
    referentIds: [referent.referent_id],
    fragment: referent.fragment,
    category,
    prompt,
    correctAnswer,
    explanation,
    distractors: sanitizedDistractors,
    metadata: {
      referent_id: referent.referent_id,
      classification: referent.classification,
      votes_total: referent.votes_total,
      is_verified: referent.is_verified,
    },
  } satisfies Omit<TriviaQuestionInput, 'spotifyTrackId'>;
}

function buildPrompt(
  track: TrackRow,
  referents: ReferentRow[],
  expectedQuestions: number
): string {
  const referentBlocks = referents
    .map((referent, idx) => {
      const annotationText = flattenAnnotation(referent.annotations);
      const metadataLines = [
        `classification=${referent.classification ?? 'unknown'}`,
        `votes=${referent.votes_total ?? 0}`,
        `comments=${referent.comment_count ?? 0}`,
        `verified=${referent.is_verified ? 'true' : 'false'}`,
      ].join(', ');

      return `Referent ${idx + 1} (ID: ${referent.referent_id}):
Fragment:
"""${referent.fragment.trim()}"""

Annotation:
"""${annotationText || 'No annotation text provided'}"""

Metadata: ${metadataLines}`;
    })
    .join('\n\n');

  return `You are creating high-quality trivia questions for language learners studying English through music.

Requirements:
- Generate exactly ${expectedQuestions} questions.
- Each question must focus on meaning, culture, slang, idioms, or historical context drawn from the fragment and annotation provided.
- Quote lyric phrases exactly as given inside double quotes and keep them in English.
- Provide one concise correct_answer (<= ${WORD_LIMIT_PER_CHOICE} words).
- Provide a distractors array with at least ${TRIVIA_DISTRACTOR_POOL} unique incorrect answers, each <= ${WORD_LIMIT_PER_CHOICE} words.
- Provide a concise explanation (<= ${MAX_EXPLANATION_LENGTH} characters) for why the correct answer is right.
- Reference the corresponding referent ID in the output so we can track provenance.

Full song lyrics (context only, do not quote excessively):
"""${sanitizeLyrics(track.normalized_lyrics)}"""

Referent source material:
${referentBlocks}`;
}

function buildResponseFormat(expectedQuestions: number) {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'trivia_questions',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['questions'],
        properties: {
          questions: {
            type: 'array',
            minItems: expectedQuestions,
            maxItems: expectedQuestions,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['reference', 'category', 'prompt', 'correct_answer', 'distractors', 'explanation'],
              properties: {
                reference: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['referent_id'],
                  properties: {
                    referent_id: { type: ['string', 'number'] },
                    fragment: { type: 'string' },
                  },
                },
                category: { type: 'string' },
                prompt: { type: 'string' },
                correct_answer: { type: 'string' },
                distractors: {
                  type: 'array',
                  minItems: TRIVIA_DISTRACTOR_POOL,
                  items: {
                    type: 'string',
                  },
                },
                explanation: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

async function fetchTracks(limit: number): Promise<TrackRow[]> {
  return query(
    `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        sl.normalized_lyrics,
        gs.genius_song_id
      FROM tracks t
      JOIN song_lyrics sl ON sl.spotify_track_id = t.spotify_track_id
      JOIN genius_songs gs ON gs.spotify_track_id = t.spotify_track_id
      WHERE t.stage = $1
        AND EXISTS (
          SELECT 1 FROM genius_song_referents gr
          WHERE gr.genius_song_id = gs.genius_song_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM song_trivia_questions stq
          WHERE stq.spotify_track_id = t.spotify_track_id
        )
      ORDER BY t.updated_at ASC
      LIMIT $2`,
    [TrackStage.TranslationQuizReady, limit]
  );
}

async function fetchReferents(geniusSongId: number): Promise<ReferentRow[]> {
  return query(
    `SELECT
        referent_id,
        fragment,
        classification,
        votes_total,
        comment_count,
        is_verified,
        annotations
      FROM genius_song_referents
      WHERE genius_song_id = $1
      ORDER BY
        COALESCE(is_verified, false) DESC,
        COALESCE(votes_total, 0) DESC,
        COALESCE(comment_count, 0) DESC,
        referent_id ASC`,
    [geniusSongId]
  );
}

async function pause(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function generateTrivia(limit = 10) {
  console.log(`\n🧠 Trivia Generation (limit: ${limit})`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY is not set.');
    process.exit(1);
  }

  const openRouter = new OpenRouterService(apiKey);
  const tracks = await fetchTracks(limit);

  if (tracks.length === 0) {
    console.log('✓ No translated tracks require trivia generation.');
    return;
  }

  console.log(`Found ${tracks.length} track(s) ready for trivia.`);

  for (const track of tracks) {
    const trackLabel = `${track.title} (${track.spotify_track_id})`;

    try {
      await ensureAudioTask(track.spotify_track_id, AudioTaskType.Trivia);
      await startTask(track.spotify_track_id, AudioTaskType.Trivia);

      const referents = await fetchReferents(track.genius_song_id);

      if (referents.length < MIN_REFERENTS_FOR_TRIVIA) {
        throw new Error(`Not enough referents (${referents.length}) to generate trivia`);
      }

      const expectedQuestions = Math.min(
        Math.max(Math.floor(referents.length / 2), 1),
        MAX_QUESTIONS
      );

      const selectedReferents = referents.slice(0, expectedQuestions);
      const referentMap = new Map(selectedReferents.map((ref) => [String(ref.referent_id), ref] as const));

      const prompt = buildPrompt(track, selectedReferents, expectedQuestions);

      console.log(`\n🎯 Generating trivia for ${trackLabel}`);
      const response = await openRouter.chat(
        [
          {
            role: 'system',
            content:
              'You are an educational content creator producing multiple choice trivia for language learners. ' +
              'Follow all instructions exactly and respond only with valid JSON matching the provided schema.',
          },
          { role: 'user', content: prompt },
        ],
        buildResponseFormat(expectedQuestions)
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Model returned empty content');
      }

      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.questions)) {
        throw new Error('Response missing questions array');
      }

      const triviaInputs: TriviaQuestionInput[] = parsed.questions.map((question: any) => {
        const normalized = validateQuestionPayload(question, referentMap);
        return {
          ...normalized,
          spotifyTrackId: track.spotify_track_id,
        };
      });

      if (triviaInputs.length === 0) {
        throw new Error('No trivia questions generated');
      }

      const existingQuestionIds = await getTriviaQuestionIdsForTrack(track.spotify_track_id);

      await clearTriviaForTrack(track.spotify_track_id);
      const insertedIds = await insertTriviaQuestions(triviaInputs);

      if (insertedIds.length !== triviaInputs.length) {
        throw new Error('Mismatch between inserted trivia questions and generated inputs');
      }

      if (exerciseEventsEnabled && existingQuestionIds.length > 0) {
        console.log(`   🔁 Disabling ${existingQuestionIds.length} previous trivia question(s)`);
        for (const oldId of existingQuestionIds) {
          await toggleExerciseQuestion(oldId, false);
          await pause(ONCHAIN_DELAY_MS);
        }
      } else if (!exerciseEventsEnabled) {
        console.warn('   ⚠️  ExerciseEvents address not configured; skipping on-chain trivia toggles');
      }

      if (exerciseEventsEnabled) {
        console.log(`   🔗 Publishing ${triviaInputs.length} trivia question(s) on-chain`);
      }

      for (let index = 0; index < triviaInputs.length; index += 1) {
        const question = triviaInputs[index];
        const questionUuid = insertedIds[index];

        const metadataPayload = {
          questionId: questionUuid,
          exerciseType: 'trivia_multiple_choice',
          spotifyTrackId: question.spotifyTrackId,
          languageCode: TRIVIA_BASE_LANGUAGE,
          category: question.category,
          prompt: question.prompt,
          correctAnswer: question.correctAnswer,
          distractorPool: question.distractors,
          explanation: question.explanation,
          referentIds: question.referentIds,
          fragment: question.fragment,
          metadata: question.metadata,
          generatedAt: new Date().toISOString(),
        } satisfies Record<string, unknown>;

        const metadataUri = await uploadExerciseMetadata(
          `trivia-question-${questionUuid}.json`,
          metadataPayload
        );

        await emitTriviaQuestionOnChain({
          questionUuid,
          spotifyTrackId: question.spotifyTrackId,
          languageCode: TRIVIA_BASE_LANGUAGE,
          metadataUri,
          distractorPoolSize: question.distractors.length,
        });

        await pause(ONCHAIN_DELAY_MS);
      }

      await completeTask(track.spotify_track_id, AudioTaskType.Trivia, {
        metadata: {
          question_count: triviaInputs.length,
          referent_count: referents.length,
          inserted_ids: insertedIds,
          onchain_emitted: exerciseEventsEnabled,
        },
      });

      await updateTrackStage(track.spotify_track_id);

      console.log(
        `   ✓ Generated ${triviaInputs.length} question(s) from ${referents.length} referent(s); stage advanced to trivia_ready`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ✗ Failed to generate trivia for ${trackLabel}: ${message}`);

      await failTask(track.spotify_track_id, AudioTaskType.Trivia, message, {
        track: track.spotify_track_id,
      });
    }
  }
}

if (import.meta.main) {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

  generateTrivia(Number.isNaN(limit) ? 10 : limit).catch((error) => {
    console.error('Fatal error running trivia generation:', error);
    process.exit(1);
  });
}

export { generateTrivia };
