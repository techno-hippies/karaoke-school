#!/usr/bin/env bun
/**
 * Generate Exercises Script
 *
 * Creates exercises for a song:
 *   - trivia: From Genius referents (annotations)
 *   - translation: EN → ZH multiple choice
 *   - sayitback: Listen and repeat (uses word timings)
 *
 * Usage:
 *   bun src/scripts/generate-exercises.ts --iswc=T0704563291
 *   bun src/scripts/generate-exercises.ts --iswc=T0704563291 --type=translation
 *   bun src/scripts/generate-exercises.ts --iswc=T0704563291 --type=trivia --genius-id=12345
 */

import { parseArgs } from 'util';
import { query, queryOne } from '../db/connection';
import {
  getSongByISWC,
  getLyricsBySong,
  createReferents,
  createExercises,
  type CreateExerciseData,
  type CreateReferentData,
} from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv, GENIUS_API_KEY, OPENROUTER_API_KEY } from '../config';
import { callOpenRouter } from '../services/openrouter';
import type { Lyric, QuestionData, GeniusReferent } from '../types';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    type: { type: 'string' }, // 'trivia', 'translation', 'sayitback', or 'all'
    'genius-id': { type: 'string' },
    limit: { type: 'string', default: '20' },
  },
  strict: true,
});

// ============================================================================
// GENIUS API
// ============================================================================

interface GeniusReferentResponse {
  referent: {
    id: number;
    fragment: string;
    classification: string;
    annotator_id: number;
    annotations: Array<{
      id: number;
      body: {
        plain: string;
      };
      verified: boolean;
      votes_total: number;
    }>;
  };
}

interface GeniusReferentsResponse {
  referents: Array<{
    id: number;
    fragment: string;
    classification: string;
    annotations: Array<{
      id: number;
      body: {
        plain: string;
      };
      verified: boolean;
      votes_total: number;
    }>;
  }>;
}

async function fetchGeniusReferents(songId: number): Promise<GeniusReferentsResponse['referents']> {
  const response = await fetch(
    `https://api.genius.com/referents?song_id=${songId}&per_page=50&text_format=plain`,
    {
      headers: {
        Authorization: `Bearer ${GENIUS_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Genius API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response.referents;
}

// ============================================================================
// OPENROUTER AI
// ============================================================================

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callOpenRouter(
  messages: OpenRouterMessage[],
  model = 'openai/gpt-4o-mini'
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============================================================================
// TRIVIA GENERATION
// ============================================================================

async function generateTriviaFromReferent(
  referent: GeniusReferent,
  songTitle: string
): Promise<QuestionData | null> {
  const annotation = referent.annotations as { plain?: string } | undefined;
  if (!annotation?.plain) return null;

  const prompt = `Generate a trivia question about this song lyric and its meaning.

Song: ${songTitle}
Lyric fragment: "${referent.fragment}"
Annotation: ${annotation.plain}

Create a multiple-choice question with:
1. A clear question about the lyric's meaning, cultural reference, or background
2. One correct answer
3. Three plausible but incorrect distractors

Respond in JSON format:
{
  "prompt": "The question text",
  "correct_answer": "The correct answer",
  "distractors": ["Wrong answer 1", "Wrong answer 2", "Wrong answer 3"],
  "explanation": "Brief explanation of why this is correct"
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a music trivia expert. Generate educational trivia questions about song lyrics.' },
      { role: 'user', content: prompt },
    ]);

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as QuestionData;
  } catch (error) {
    console.error(`   Failed to generate trivia for referent ${referent.referent_id}:`, error);
    return null;
  }
}

// ============================================================================
// TRANSLATION EXERCISE GENERATION (AI-powered distractors)
// ============================================================================

const LANGUAGE_NAMES: Record<string, string> = {
  zh: 'Simplified Chinese',
  vi: 'Vietnamese',
  id: 'Indonesian',
};

const DISTRACTOR_POOL_SIZE = 6;
const MAX_DISTRACTOR_WORDS = 12;

interface DistractorResult {
  distractors: string[];
  explanation: string;
  explanationLocalized: string;
}

interface TranslationExerciseResult {
  correctAnswer: string;
  distractors: string[];
  explanationLocalized: string;
}

/**
 * Generate a complete translation exercise using AI.
 *
 * IMPORTANT: We generate a PURE translation as the correct answer, not the artistic
 * Chinglish from zh-lyrics.txt. Song lyrics often mix languages for artistic effect,
 * but for language learning we need proper translations.
 */
async function generateTranslationExerciseAI(
  enLine: Lyric,
  languageCode: string,
  songTitle: string,
  contextLines: { previous?: string; next?: string }
): Promise<TranslationExerciseResult> {
  const languageName = LANGUAGE_NAMES[languageCode] || languageCode;

  const contextStr = [
    contextLines.previous ? `Previous line: "${contextLines.previous}"` : null,
    contextLines.next ? `Next line: "${contextLines.next}"` : null,
  ].filter(Boolean).join('\n');

  const systemPrompt = `You create language-learning translation exercises for ${languageName} speakers learning English. Respond strictly in JSON.`;

  const userPrompt = `Create a multiple-choice translation quiz for this English lyric.

English lyric to translate:
"""${enLine.text}"""

Song: ${songTitle}

Context:
${contextStr || 'No adjacent lines'}

Requirements:
1. Provide ONE correct translation in ${languageName}:
   - Must be written ENTIRELY in ${languageName} (NO English words)
   - Natural, accurate translation that captures the meaning
   - NOT a transliteration or Chinglish mix

2. Generate exactly ${DISTRACTOR_POOL_SIZE} incorrect translations in ${languageName}:
   - Each written ENTIRELY in ${languageName} (NO English words)
   - Linguistically plausible but meaningfully wrong
   - Under ${MAX_DISTRACTOR_WORDS} words each
   - All unique (no duplicates)

3. Provide a brief explanation in ${languageName} for the learner

Return JSON:
{
  "correct_answer": "the correct ${languageName} translation (NO English)",
  "distractors": ["wrong answer 1", "wrong answer 2", ...],
  "explanation": "Brief explanation in ${languageName} for the learner"
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const correctAnswer = (parsed.correct_answer || '').trim();
    if (!correctAnswer) {
      throw new Error('No correct answer provided');
    }

    // Validate distractors
    let distractors: string[] = parsed.distractors || [];
    const correctLower = correctAnswer.toLowerCase();

    // Filter out any that match correct answer or are empty
    distractors = distractors
      .map((d: string) => d.trim())
      .filter((d: string) => d && d.toLowerCase() !== correctLower);

    // Deduplicate
    distractors = [...new Set(distractors.map((d: string) => d.toLowerCase()))]
      .map(lower => distractors.find((d: string) => d.toLowerCase() === lower)!);

    // Ensure we have enough distractors
    while (distractors.length < 3) {
      distractors.push(`(选项 ${distractors.length + 1})`);
    }

    return {
      correctAnswer,
      distractors: distractors.slice(0, DISTRACTOR_POOL_SIZE),
      explanationLocalized: parsed.explanation || `正确翻译是"${correctAnswer}"`,
    };
  } catch (error: any) {
    console.error(`   ⚠️ AI translation exercise generation failed: ${error.message}`);
    throw error; // Re-throw to skip this line
  }
}

async function generateTranslationExercise(
  enLine: Lyric,
  allEnLines: Lyric[],
  languageCode: string,
  songTitle: string
): Promise<QuestionData> {
  // Get context (previous/next English lines)
  const prevLine = allEnLines.find(l => l.line_index === enLine.line_index - 1);
  const nextLine = allEnLines.find(l => l.line_index === enLine.line_index + 1);

  const context = {
    previous: prevLine?.text,
    next: nextLine?.text,
  };

  // Generate complete exercise with AI (correct answer + distractors)
  // This ensures PURE translations without Chinglish mixing
  const { correctAnswer, distractors, explanationLocalized } = await generateTranslationExerciseAI(
    enLine,
    languageCode,
    songTitle,
    context
  );

  // Prompt is just the English text - learner identifies correct translation
  // Both correct answer and distractors are pure target language (no English)
  return {
    prompt: enLine.text,
    correct_answer: correctAnswer,
    distractors,
    explanation: explanationLocalized,
  };
}

// ============================================================================
// SAYITBACK EXERCISE GENERATION
// ============================================================================

function generateSayItBackExercise(lyric: Lyric): QuestionData {
  return {
    prompt: `Listen and repeat: "${lyric.text}"`,
    correct_answer: lyric.text,
    distractors: [], // Not applicable for speech exercises
    explanation: 'Speak the line clearly, matching the rhythm and pronunciation.',
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL']);

  // Validate required args
  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    console.log('\nUsage:');
    console.log('  bun src/scripts/generate-exercises.ts --iswc=T0704563291');
    console.log('  bun src/scripts/generate-exercises.ts --iswc=T0704563291 --type=translation');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const exerciseType = values.type || 'all';
  const limit = parseInt(values.limit!);

  console.log('\n📚 Generating Exercises');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Type: ${exerciseType}`);
  console.log(`   Limit: ${limit}`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  console.log(`   Title: ${song.title}`);

  // Get lyrics
  const enLyrics = await getLyricsBySong(song.id, 'en');
  const zhLyrics = await getLyricsBySong(song.id, 'zh');

  console.log(`   EN lines: ${enLyrics.length}`);
  console.log(`   ZH lines: ${zhLyrics.length}`);

  const exercises: CreateExerciseData[] = [];

  // -------------------------------------------------------------------------
  // TRIVIA (from Genius)
  // -------------------------------------------------------------------------
  if (exerciseType === 'all' || exerciseType === 'trivia') {
    console.log('\n🎯 Generating trivia exercises...');

    // Check if we have Genius ID
    const geniusId = values['genius-id'] ? parseInt(values['genius-id']) : song.genius_song_id;

    if (!geniusId) {
      console.log('   ⚠️  No Genius ID provided. Skipping trivia.');
    } else {
      validateEnv(['GENIUS_API_KEY', 'OPENROUTER_API_KEY']);

      // Fetch referents
      console.log(`   Fetching Genius referents for song ${geniusId}...`);
      const referents = await fetchGeniusReferents(geniusId);
      console.log(`   Found ${referents.length} referents`);

      // Store referents
      const referentData: CreateReferentData[] = referents.map((r) => ({
        song_id: song.id,
        referent_id: r.id,
        genius_song_id: geniusId,
        fragment: r.fragment,
        classification: r.classification,
        annotations: r.annotations[0]?.body || null,
        votes_total: r.annotations[0]?.votes_total || 0,
        is_verified: r.annotations[0]?.verified || false,
      }));

      if (referentData.length > 0) {
        await createReferents(referentData);
        console.log(`   Stored ${referentData.length} referents`);
      }

      // Get stored referents
      const storedReferents = await query<GeniusReferent>(
        `SELECT * FROM genius_referents WHERE song_id = $1 ORDER BY votes_total DESC LIMIT $2`,
        [song.id, limit]
      );

      // Generate trivia for top referents
      let triviaCount = 0;
      for (const ref of storedReferents) {
        if (triviaCount >= limit) break;

        const questionData = await generateTriviaFromReferent(ref, song.title);
        if (questionData) {
          exercises.push({
            song_id: song.id,
            exercise_type: 'trivia',
            language_code: 'en',
            question_data: questionData,
            referent_id: ref.referent_id,
          });
          triviaCount++;
          console.log(`   ✅ Trivia ${triviaCount}: ${questionData.prompt.slice(0, 50)}...`);
        }
      }

      console.log(`   Generated ${triviaCount} trivia exercises`);
    }
  }

  // -------------------------------------------------------------------------
  // TRANSLATION (AI generates both correct answer + distractors)
  // -------------------------------------------------------------------------
  if (exerciseType === 'all' || exerciseType === 'translation') {
    console.log('\n🌐 Generating translation exercises (AI-powered, pure translations)...');
    validateEnv(['OPENROUTER_API_KEY']);

    let translationCount = 0;

    for (const enLine of enLyrics) {
      if (translationCount >= limit) break;

      // Skip section markers like [Verse 1], [Chorus]
      if (enLine.text.match(/^\[.*\]$/)) continue;

      // Skip very short lines (less than 3 words)
      const wordCount = enLine.text.split(/\s+/).length;
      if (wordCount < 3) continue;

      console.log(`   📝 Line ${translationCount + 1}: "${enLine.text.slice(0, 40)}..."`);

      try {
        // AI generates BOTH correct answer and distractors (pure Chinese, no Chinglish)
        const questionData = await generateTranslationExercise(
          enLine,
          enLyrics,
          'zh',
          song.title
        );

        exercises.push({
          song_id: song.id,
          lyric_id: enLine.id,
          exercise_type: 'translation',
          language_code: 'zh',
          question_data: questionData,
        });

        translationCount++;
      } catch (error: any) {
        console.log(`   ⚠️ Skipped: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`   Generated ${translationCount} translation exercises`);
  }

  // -------------------------------------------------------------------------
  // SAYITBACK
  // -------------------------------------------------------------------------
  if (exerciseType === 'all' || exerciseType === 'sayitback') {
    console.log('\n🎤 Generating sayitback exercises...');

    // Create sayitback exercises for lines with timing
    let sayitbackCount = 0;

    for (const enLine of enLyrics) {
      if (sayitbackCount >= limit) break;

      // Skip lines without timing
      if (enLine.start_ms == null || enLine.end_ms == null) continue;

      const questionData = generateSayItBackExercise(enLine);

      exercises.push({
        song_id: song.id,
        lyric_id: enLine.id,
        exercise_type: 'sayitback',
        language_code: 'en',
        question_data: questionData,
      });

      sayitbackCount++;
    }

    console.log(`   Generated ${sayitbackCount} sayitback exercises`);
  }

  // -------------------------------------------------------------------------
  // SAVE TO DATABASE
  // -------------------------------------------------------------------------
  if (exercises.length > 0) {
    console.log('\n💾 Saving exercises to database...');
    const saved = await createExercises(exercises);
    console.log(`   Saved ${saved.length} exercises`);
  } else {
    console.log('\n⚠️  No exercises generated');
  }

  // Summary
  console.log('\n✅ Exercise generation complete');
  console.log(`   Total: ${exercises.length} exercises`);

  // Count by type
  const byType = exercises.reduce(
    (acc, e) => {
      acc[e.exercise_type] = (acc[e.exercise_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${type}: ${count}`);
  }

  console.log('\n💡 Next steps:');
  console.log(`   • Emit to chain: bun src/scripts/emit-exercises.ts --iswc=${iswc}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
