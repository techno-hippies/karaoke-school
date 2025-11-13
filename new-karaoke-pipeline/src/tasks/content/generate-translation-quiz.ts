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
  clearTranslationQuestionsForTrack,
  insertTranslationQuestions,
  getTranslationQuestionIdsForTrack,
} from '../../db/translation-quiz';
import { SUPPORTED_TRIVIA_LOCALES } from '../../db/trivia';
import { OpenRouterService } from '../../services/openrouter';
import {
  DEFAULT_DISTRACTOR_POOL_SIZE,
  isLineEligible,
  sanitizeCandidate,
} from './translation-quiz-helpers';
import { sanitizeLyrics } from './trivia-utils';
import {
  bufferToHex,
  exerciseEventsEnabled,
  uploadExerciseMetadata,
  emitTranslationQuestionOnChain,
  toggleExerciseQuestion,
} from './exercise-events';

interface TrackRow {
  spotify_track_id: string;
  title: string;
  normalized_lyrics: string;
}

interface LineRow {
  line_id: string;
  line_index: number;
  original_text: string;
  segment_hash: Buffer | string | null;
}

interface TranslationRow {
  language_code: string;
  lines: any;
}

interface TranslationQuestionEntry {
  spotifyTrackId: string;
  lineId: string;
  lineIndex: number;
  segmentHash: string;
  languageCode: string;
  prompt: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  metadata: Record<string, unknown>;
}

const LANGUAGE_NAMES: Record<(typeof SUPPORTED_TRIVIA_LOCALES)[number], string> = {
  zh: 'Simplified Chinese',
  vi: 'Vietnamese',
  id: 'Indonesian',
};

const DISTRACTOR_POOL_SIZE = DEFAULT_DISTRACTOR_POOL_SIZE;
const MAX_LINES_PER_TRACK = 10;
const AI_DELAY_MS = 500;
const TRANSLATION_CHOICE_WORD_LIMIT = 12;

const EXPLANATION_TRANSLATION_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'translation_quiz_explanation_localization',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['translated_explanation'],
      properties: {
        translated_explanation: { type: 'string' },
      },
    },
  },
};


function buildTranslationMap(lines: any): Map<number, string> {
  const map = new Map<number, string>();
  if (!Array.isArray(lines)) return map;

  for (const entry of lines) {
    const index = Number(entry?.lineIndex ?? entry?.line_index);
    const translation = sanitizeCandidate(String(entry?.translatedText ?? entry?.translated_text ?? ''));
    if (!Number.isNaN(index) && translation) {
      map.set(index, translation);
    }
  }

  return map;
}

function surroundingContext(lines: LineRow[], targetIndex: number): { previous?: string; next?: string } {
  const previousLine = lines.find(line => line.line_index === targetIndex - 1);
  const nextLine = lines.find(line => line.line_index === targetIndex + 1);
  return {
    previous: previousLine?.original_text,
    next: nextLine?.original_text,
  };
}

function buildDistractorPrompt(
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  line: LineRow,
  correctTranslation: string,
  context: { previous?: string; next?: string },
  fullLyrics: string
): string {
  const languageName = LANGUAGE_NAMES[languageCode];
  const contextLines = [
    context.previous ? `Previous line: "${context.previous}"` : null,
    context.next ? `Next line: "${context.next}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `You are preparing multiple choice translation practice for English learners.

Original English lyric:
"""${line.original_text}"""

Target language: ${languageName}
Canonical translation:
"""${correctTranslation}"""

Context:
${contextLines || 'No adjacent lines provided'}

Full song lyrics (for reference only, do not quote extensively):
"""${sanitizeLyrics(fullLyrics)}"""

Requirements:
- Produce exactly ${DISTRACTOR_POOL_SIZE} distractor translations in ${languageName}.
- Each distractor must be linguisticly plausible but meaningfully incorrect.
- Keep each distractor under ${TRANSLATION_CHOICE_WORD_LIMIT} words.
- Avoid repeating the canonical translation or trivial variants.
- Provide a concise explanation (1-2 sentences max) that explains why the canonical translation is correct. Focus only on the correct answer, not the distractors.
- Return JSON that matches the provided schema.

Return only JSON, no additional commentary.`;
}

function buildResponseFormat() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'translation_quiz_distractors',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['distractors'],
        properties: {
          explanation: { type: 'string' },
          distractors: {
            type: 'array',
            minItems: DISTRACTOR_POOL_SIZE,
            maxItems: DISTRACTOR_POOL_SIZE,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text'],
              properties: {
                text: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

function validateDistractors(
  rawDistractors: any,
  correctAnswer: string
): { texts: string[]; reasons: string[] } {
  if (!Array.isArray(rawDistractors) || rawDistractors.length !== DISTRACTOR_POOL_SIZE) {
    throw new Error(`Expected ${DISTRACTOR_POOL_SIZE} distractors`);
  }

  const correctLower = correctAnswer.toLowerCase();
  const texts: string[] = [];
  const reasons: string[] = [];
  const seen = new Set<string>();

  for (const entry of rawDistractors) {
    const text = sanitizeCandidate(String(entry?.text ?? ''));
    if (!text) {
      throw new Error('Distractor text is empty');
    }
    if (text.toLowerCase() === correctLower) {
      throw new Error('Distractor matches correct answer');
    }
    if (text.split(/\s+/).filter(Boolean).length > TRANSLATION_CHOICE_WORD_LIMIT) {
      throw new Error(`Distractor exceeds ${TRANSLATION_CHOICE_WORD_LIMIT}-word limit`);
    }
    if (seen.has(text.toLowerCase())) {
      throw new Error('Duplicate distractor detected');
    }
    seen.add(text.toLowerCase());
    texts.push(text);
    reasons.push(sanitizeCandidate(String(entry?.reason ?? '')));
  }

  return { texts, reasons };
}

async function fetchTracks(limit: number): Promise<TrackRow[]> {
  // ✅ RETROACTIVE PROCESSING: Query by pending tasks, not by stage
  // This allows processing tracks at ANY stage (including 'ready') as long as they have:
  // 1. Translations in target languages
  // 2. A pending translation_quiz task
  // 3. No existing questions
  return query(
    `SELECT t.spotify_track_id, t.title, sl.normalized_lyrics
     FROM tracks t
     JOIN song_lyrics sl ON sl.spotify_track_id = t.spotify_track_id
     WHERE EXISTS (
         SELECT 1 FROM lyrics_translations lt
         WHERE lt.spotify_track_id = t.spotify_track_id
           AND lt.language_code = ANY($1)
       )
       AND EXISTS (
         SELECT 1 FROM audio_tasks at
         WHERE at.spotify_track_id = t.spotify_track_id
           AND at.task_type = 'translation_quiz'
           AND at.status = 'pending'
       )
       AND NOT EXISTS (
         SELECT 1 FROM song_translation_questions q
         WHERE q.spotify_track_id = t.spotify_track_id
       )
     ORDER BY t.updated_at ASC
     LIMIT $2`,
    [SUPPORTED_TRIVIA_LOCALES, limit]
  );
}

async function fetchLines(spotifyTrackId: string): Promise<LineRow[]> {
  return query(
    `SELECT line_id, line_index, original_text, segment_hash
     FROM karaoke_lines
     WHERE spotify_track_id = $1
     ORDER BY line_index ASC`,
    [spotifyTrackId]
  );
}

async function fetchTranslations(spotifyTrackId: string): Promise<Map<string, Map<number, string>>> {
  const rows: TranslationRow[] = await query(
    `SELECT language_code, lines
     FROM lyrics_translations
     WHERE spotify_track_id = $1
       AND language_code = ANY($2)`,
    [spotifyTrackId, SUPPORTED_TRIVIA_LOCALES]
  );

  const map = new Map<string, Map<number, string>>();
  for (const row of rows) {
    map.set(row.language_code, buildTranslationMap(row.lines));
  }
  return map;
}

async function pause(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

interface DistractorResult {
  distractors: string[];
  reasons: string[];
  explanation: string;
}

async function translateExplanationForLanguage(
  openRouter: OpenRouterService,
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  explanation: string
): Promise<string> {
  const sanitized = sanitizeCandidate(explanation);
  if (!sanitized) {
    throw new Error('Explanation text is empty');
  }

  if (languageCode === 'en') {
    return sanitized;
  }

  const languageName = LANGUAGE_NAMES[languageCode] ?? 'target language';

  const response = await openRouter.chat(
    [
      {
        role: 'system',
        content: `You translate concise language-learning explanations into ${languageName}. Preserve meaning, keep it conversational, and never add commentary. Return JSON matching the schema.`,
      },
      {
        role: 'user',
        content: `Translate the following explanation into ${languageName}. Maintain tone, keep it to 1-2 sentences, and avoid English translations in parentheses.

Explanation:
"""${sanitized}"""`,
      },
    ],
    EXPLANATION_TRANSLATION_RESPONSE_FORMAT
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Explanation translation returned empty response');
  }

  const parsed = JSON.parse(content);
  const translated = sanitizeCandidate(String(parsed.translated_explanation ?? ''));

  if (!translated) {
    throw new Error('Explanation translation produced empty text');
  }

  return translated;
}

async function requestDistractors(
  openRouter: OpenRouterService,
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  line: LineRow,
  correctAnswer: string,
  context: { previous?: string; next?: string },
  fullLyrics: string,
  additionalGuidance?: string
): Promise<DistractorResult> {
  const prompt = buildDistractorPrompt(languageCode, line, correctAnswer, context, fullLyrics);
  const finalPrompt = additionalGuidance
    ? `${prompt}\n\nAdditional instructions:\n${additionalGuidance.trim()}`
    : prompt;

  const response = await openRouter.chat(
    [
      {
        role: 'system',
        content:
          'You create challenging yet fair language-learning distractors. Respond strictly in JSON matching the schema.',
      },
      { role: 'user', content: finalPrompt },
    ],
    buildResponseFormat()
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Model returned empty content');
  }

  const parsed = JSON.parse(content);
  const { texts: distractors, reasons } = validateDistractors(parsed.distractors, correctAnswer);
  let explanation = sanitizeCandidate(String(parsed.explanation ?? ''));

  // Validate explanation focuses on correct answer, not distractors
  const explanationLower = explanation.toLowerCase();
  if (explanationLower.includes('distractor') || explanationLower.includes('incorrect') || explanationLower.includes('wrong answer')) {
    throw new Error('Explanation must focus on why the correct answer is right, not on distractors');
  }

  return { distractors, reasons, explanation };
}

async function generateDistractorsWithRetries(
  openRouter: OpenRouterService,
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  line: LineRow,
  correctAnswer: string,
  context: { previous?: string; next?: string },
  fullLyrics: string,
  maxRetries: number = 2
): Promise<DistractorResult> {
  let attempt = 0;
  let extraGuidance = '';
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    try {
      return await requestDistractors(
        openRouter,
        languageCode,
        line,
        correctAnswer,
        context,
        fullLyrics,
        extraGuidance
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt += 1;

      if (attempt > maxRetries) {
        throw lastError;
      }

      const message = lastError.message.toLowerCase();
      if (message.includes('word limit')) {
        extraGuidance = `Ensure every distractor is ${TRANSLATION_CHOICE_WORD_LIMIT} words or fewer.`;
      } else if (message.includes('duplicate')) {
        extraGuidance = 'Provide unique distractors with clearly distinct vocabulary.';
      } else if (message.includes('matches correct answer')) {
        extraGuidance = 'Avoid repeating the canonical translation; each distractor must change meaning.';
      } else if (message.includes('distractor') && message.includes('explanation')) {
        extraGuidance = 'The explanation field must only explain why the correct translation is appropriate. Do not mention distractors, incorrect answers, or wrong choices. Focus solely on the canonical translation.';
      } else {
        extraGuidance = 'Double-check the JSON structure and constraints before responding again.';
      }

      await pause(AI_DELAY_MS);
    }
  }

  throw lastError ?? new Error('Distractor generation failed');
}

async function generateTranslationQuiz(limit = 5, maxLines = MAX_LINES_PER_TRACK) {
  console.log(`\n🈯 Translation Quiz Generation (limit: ${limit}, max lines: ${maxLines})`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY is not set.');
    process.exit(1);
  }

  const openRouter = new OpenRouterService(apiKey);
  const tracks = await fetchTracks(limit);

  if (tracks.length === 0) {
    console.log('✓ No translated tracks require translation quizzes.');
    return;
  }

  console.log(`Found ${tracks.length} track(s) ready for translation quizzes.`);

  for (const track of tracks) {
    const trackLabel = `${track.title} (${track.spotify_track_id})`;

    try {
      await ensureAudioTask(track.spotify_track_id, AudioTaskType.TranslationQuiz);
      await startTask(track.spotify_track_id, AudioTaskType.TranslationQuiz);

      const lines = await fetchLines(track.spotify_track_id);
      const translationsMap = await fetchTranslations(track.spotify_track_id);

      const eligibleLines = lines.filter(line => isLineEligible(line.original_text));
      if (eligibleLines.length === 0) {
        throw new Error('No eligible lyric lines (too long)');
      }

      const selectedLines = eligibleLines.slice(0, maxLines);

      const questionEntries: TranslationQuestionEntry[] = [];

      for (const languageCode of SUPPORTED_TRIVIA_LOCALES) {
        const translationMap = translationsMap.get(languageCode);
        if (!translationMap || translationMap.size === 0) {
          continue;
        }

        for (const line of selectedLines) {
          const correctAnswer = translationMap.get(line.line_index);
          if (!correctAnswer) {
            continue;
          }

          const segmentHashHex = bufferToHex(line.segment_hash);
          if (!segmentHashHex) {
            console.warn(
              `   ⚠️  Skipping line ${line.line_id} (index ${line.line_index}) due to missing segment hash`
            );
            continue;
          }

          const context = surroundingContext(lines, line.line_index);

          const { distractors, reasons, explanation } = await generateDistractorsWithRetries(
            openRouter,
            languageCode,
            line,
            correctAnswer,
            context,
            track.normalized_lyrics
          );

          const localizedExplanation = await translateExplanationForLanguage(
            openRouter,
            languageCode,
            explanation
          );

          questionEntries.push({
            spotifyTrackId: track.spotify_track_id,
            lineId: line.line_id,
            lineIndex: line.line_index,
            segmentHash: segmentHashHex,
            languageCode,
            prompt: line.original_text,
            correctAnswer,
            distractors,
            explanation: localizedExplanation,
            metadata: {
              distractor_reasons: reasons,
              segment_hash: segmentHashHex,
              explanation_english: explanation,
            },
          });

          await pause(AI_DELAY_MS);
        }
      }

      if (questionEntries.length === 0) {
        throw new Error('No questions generated (missing translations or eligible lines)');
      }

      const existingQuestionIds = await getTranslationQuestionIdsForTrack(track.spotify_track_id);

      await clearTranslationQuestionsForTrack(track.spotify_track_id);
      const insertedQuestionIds = await insertTranslationQuestions(questionEntries);

      if (insertedQuestionIds.length !== questionEntries.length) {
        throw new Error('Mismatch between inserted questions and generated entries');
      }

      if (exerciseEventsEnabled && existingQuestionIds.length > 0) {
        console.log(`   🔁 Disabling ${existingQuestionIds.length} previous translation question(s)`);
        for (const oldQuestionId of existingQuestionIds) {
          await toggleExerciseQuestion(oldQuestionId, false);
          await pause(AI_DELAY_MS);
        }
      }

      if (exerciseEventsEnabled) {
        console.log(`   🔗 Publishing ${questionEntries.length} translation question(s) on-chain`);
      } else {
        console.warn('   ⚠️  ExerciseEvents address not configured; skipping on-chain emissions');
      }

      for (let index = 0; index < questionEntries.length; index += 1) {
        const entry = questionEntries[index];
        const questionUuid = insertedQuestionIds[index];

        const metadataPayload = {
          questionId: questionUuid,
          exerciseType: 'translation_multiple_choice',
          spotifyTrackId: entry.spotifyTrackId,
          segmentHash: entry.segmentHash,
          lineId: entry.lineId,
          lineIndex: entry.lineIndex,
          languageCode: entry.languageCode,
          prompt: entry.prompt,
          correctAnswer: entry.correctAnswer,
          distractorPool: entry.distractors,
          explanation: entry.explanation,
          metadata: entry.metadata,
          generatedAt: new Date().toISOString(),
        } satisfies Record<string, unknown>;

        const metadataUri = await uploadExerciseMetadata(
          `translation-quiz-${questionUuid}.json`,
          metadataPayload
        );

        await emitTranslationQuestionOnChain({
          questionUuid,
          lineUuid: entry.lineId,
          segmentHash: entry.segmentHash,
          lineIndex: entry.lineIndex,
          spotifyTrackId: entry.spotifyTrackId,
          languageCode: entry.languageCode,
          metadataUri,
          distractorPoolSize: entry.distractors.length,
        });

        await pause(AI_DELAY_MS);
      }

      await completeTask(track.spotify_track_id, AudioTaskType.TranslationQuiz, 'track', {
        metadata: {
          question_count: questionEntries.length,
          languages: Array.from(new Set(questionEntries.map(entry => entry.languageCode))),
          lines_considered: selectedLines.length,
          onchain_emitted: exerciseEventsEnabled,
        },
      });

      await updateTrackStage(track.spotify_track_id);

      console.log(`   ✓ Generated ${questionEntries.length} translation quizzes for ${trackLabel}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ✗ Failed to generate translation quiz for ${trackLabel}: ${message}`);

      await failTask(track.spotify_track_id, AudioTaskType.TranslationQuiz, 'track', message, {
        track: track.spotify_track_id,
      });
    }
  }
}

if (import.meta.main) {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const maxLinesArg = process.argv.find((arg) => arg.startsWith('--max-lines='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;
  const maxLines = maxLinesArg ? parseInt(maxLinesArg.split('=')[1], 10) : MAX_LINES_PER_TRACK;

  generateTranslationQuiz(
    Number.isNaN(limit) ? 5 : limit,
    Number.isNaN(maxLines) ? MAX_LINES_PER_TRACK : maxLines
  ).catch((error) => {
    console.error('Fatal error during translation quiz generation:', error);
    process.exit(1);
  });
}

export { generateTranslationQuiz };
