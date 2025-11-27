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
// TRANSLATION EXERCISE GENERATION
// ============================================================================

async function generateTranslationExercise(
  enLine: Lyric,
  zhLine: Lyric,
  allZhLines: Lyric[]
): Promise<QuestionData> {
  // Get 3 random distractors from other Chinese lines
  const otherLines = allZhLines.filter((l) => l.line_index !== zhLine.line_index);
  const shuffled = otherLines.sort(() => Math.random() - 0.5);
  const distractors = shuffled.slice(0, 3).map((l) => l.text);

  // If not enough distractors, generate some
  while (distractors.length < 3) {
    distractors.push(`(No translation ${distractors.length + 1})`);
  }

  return {
    prompt: `What is the Chinese translation of: "${enLine.text}"`,
    correct_answer: zhLine.text,
    distractors,
    explanation: `"${enLine.text}" translates to "${zhLine.text}"`,
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
  // TRANSLATION
  // -------------------------------------------------------------------------
  if (exerciseType === 'all' || exerciseType === 'translation') {
    console.log('\n🌐 Generating translation exercises...');

    // Create translation exercises for each line pair
    const zhByIndex = new Map(zhLyrics.map((l) => [l.line_index, l]));
    let translationCount = 0;

    for (const enLine of enLyrics) {
      if (translationCount >= limit) break;

      const zhLine = zhByIndex.get(enLine.line_index);
      if (!zhLine) continue;

      const questionData = await generateTranslationExercise(enLine, zhLine, zhLyrics);

      exercises.push({
        song_id: song.id,
        lyric_id: enLine.id,
        exercise_type: 'translation',
        language_code: 'zh',
        question_data: questionData,
      });

      translationCount++;
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
