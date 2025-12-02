#!/usr/bin/env bun
/**
 * Generate Trivia Exercises (Improved Pedagogy)
 *
 * Combines SongFacts (factual) + Genius (interpretive) for well-rounded trivia.
 * Uses better prompts for tricky distractors and varied difficulty.
 *
 * Usage:
 *   bun src/scripts/generate-trivia.ts --iswc=T0112199333
 *   bun src/scripts/generate-trivia.ts --iswc=T0112199333 --dry-run
 *   bun src/scripts/generate-trivia.ts --iswc=T0112199333 --limit=5
 */

import { parseArgs } from 'util';
import { query } from '../db/connection';
import {
  getSongByISWC,
  getSongFactsBySong,
  createExercises,
  getArtistById,
  type CreateExerciseData,
} from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv, OPENROUTER_API_KEY } from '../config';
import type { QuestionData, GeniusReferent, SongFactRecord, Song } from '../types';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    all: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
    source: { type: 'string' }, // 'songfacts', 'genius', or 'all' (default)
  },
  strict: true,
});

// ============================================================================
// IMPROVED AI PROMPTS
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
// SONGFACTS TRIVIA (Factual Questions)
// ============================================================================

type Difficulty = 'easy' | 'medium' | 'hard';

interface TriviaQuestion extends QuestionData {
  difficulty: Difficulty;
  category: 'factual' | 'interpretive' | 'cultural';
  source: 'songfacts' | 'genius';
}

async function generateTriviaFromSongFact(
  fact: SongFactRecord,
  songTitle: string,
  artistName: string,
  allFacts: SongFactRecord[]
): Promise<TriviaQuestion | null> {
  // Skip very short facts
  if (fact.text.length < 100) return null;

  const systemPrompt = `You are creating music trivia for a karaoke learning app. Your goal is to create educational, engaging questions that teach listeners about songs.

CRITICAL RULES FOR DISTRACTORS:
1. Distractors must be PLAUSIBLE - things that COULD be true but aren't
2. Never use obviously absurd answers
3. Use real names, real numbers, real events as distractors
4. Distractors should require KNOWLEDGE to eliminate, not logic

GOOD distractors for "What movie featured Lose Yourself?":
- "Get Rich or Die Tryin'" (real rap movie, wrong artist)
- "Hustle & Flow" (real movie about rapper, wrong one)
- "Straight Outta Compton" (real rap biopic, wrong era)

BAD distractors:
- "A romantic comedy about cats" (obviously wrong)
- "He never made a movie" (too easy to eliminate)`;

  const userPrompt = `Create a trivia question from this fact about "${songTitle}" by ${artistName}.

FACT:
"""
${fact.text}
"""

Requirements:
1. Extract ONE testable fact (a name, number, event, or verifiable claim)
2. Create a clear, specific question
3. Generate 3 PLAUSIBLE distractors using:
   - Similar artists/songs from the same era
   - Real but incorrect numbers/dates
   - Common misconceptions
   - Things true of similar songs but not this one

Determine difficulty:
- EASY: Basic facts (year, movie, award name)
- MEDIUM: Specific details (chart position, collaborators)
- HARD: Obscure details (studio techniques, early versions)

Return JSON:
{
  "prompt": "The question (be specific, not vague)",
  "correct_answer": "The factual answer",
  "distractors": ["Plausible wrong 1", "Plausible wrong 2", "Plausible wrong 3"],
  "explanation": "Why this is correct + interesting context",
  "difficulty": "easy|medium|hard"
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      prompt: parsed.prompt,
      correct_answer: parsed.correct_answer,
      distractors: parsed.distractors || [],
      explanation: parsed.explanation,
      difficulty: parsed.difficulty || 'medium',
      category: 'factual',
      source: 'songfacts',
    };
  } catch (error) {
    console.error(`   Failed to generate from SongFact:`, error);
    return null;
  }
}

// ============================================================================
// GENIUS TRIVIA (Interpretive Questions)
// ============================================================================

async function generateTriviaFromGenius(
  referent: GeniusReferent,
  songTitle: string,
  artistName: string
): Promise<TriviaQuestion | null> {
  const annotation = referent.annotations as { plain?: string } | undefined;
  if (!annotation?.plain || annotation.plain.length < 50) return null;

  const systemPrompt = `You are creating music trivia for a karaoke learning app. Focus on lyric interpretation and literary/cultural references.

CRITICAL RULES FOR DISTRACTORS:
1. Distractors must be PLAUSIBLE interpretations
2. Use common misreadings or alternative theories
3. Reference real literary works, real events, real cultural phenomena
4. Avoid obviously wrong or absurd options

GOOD distractors for "What does 'Bohemian' in Bohemian Rhapsody refer to?":
- "The Czech region of Bohemia" (plausible geographic interpretation)
- "A type of classical music composition" (sounds scholarly)
- "Freddie Mercury's ethnic heritage" (common misconception)

BAD distractors:
- "A type of sandwich" (absurd)
- "Nothing, it's random" (dismissive)`;

  const userPrompt = `Create an interpretive trivia question from this lyric annotation.

Song: "${songTitle}" by ${artistName}
Lyric: "${referent.fragment}"

Annotation:
"""
${annotation.plain}
"""

Requirements:
1. Focus on meaning, literary references, or cultural context
2. Question should test understanding, not just recall
3. Distractors should be alternative interpretations that seem reasonable

Determine difficulty:
- EASY: Surface-level meaning
- MEDIUM: Cultural references, wordplay
- HARD: Deep literary analysis, obscure references

Return JSON:
{
  "prompt": "Question about meaning or reference",
  "correct_answer": "The correct interpretation",
  "distractors": ["Alternative reading 1", "Alternative reading 2", "Alternative reading 3"],
  "explanation": "Why this interpretation is correct",
  "difficulty": "easy|medium|hard"
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      prompt: parsed.prompt,
      correct_answer: parsed.correct_answer,
      distractors: parsed.distractors || [],
      explanation: parsed.explanation,
      difficulty: parsed.difficulty || 'medium',
      category: 'interpretive',
      source: 'genius',
    };
  } catch (error) {
    console.error(`   Failed to generate from Genius:`, error);
    return null;
  }
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function isDuplicateQuestion(
  newQ: TriviaQuestion,
  existing: TriviaQuestion[]
): boolean {
  const newPromptLower = newQ.prompt.toLowerCase();
  const newAnswerLower = newQ.correct_answer.toLowerCase();

  for (const q of existing) {
    // Check if prompts are too similar
    const existingPromptLower = q.prompt.toLowerCase();
    if (
      newPromptLower.includes(existingPromptLower.slice(0, 30)) ||
      existingPromptLower.includes(newPromptLower.slice(0, 30))
    ) {
      return true;
    }

    // Check if answers are the same
    if (newAnswerLower === q.correct_answer.toLowerCase()) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// GENERATE TRIVIA FOR A SINGLE SONG
// ============================================================================

interface GenerationResult {
  songTitle: string;
  artistName: string;
  questionsGenerated: number;
  byDifficulty: { easy: number; medium: number; hard: number };
  bySource: { songfacts: number; genius: number };
}

async function generateTriviaForSong(
  song: Song,
  options: {
    limit: number;
    sourceFilter: string;
    dryRun: boolean;
  }
): Promise<GenerationResult> {
  const { limit, sourceFilter, dryRun } = options;

  // Get artist name
  let artistName = 'Unknown Artist';
  if (song.artist_id) {
    const artist = await getArtistById(song.artist_id);
    if (artist) artistName = artist.name;
  }

  console.log(`\n━━━ "${song.title}" by ${artistName} ━━━`);

  const questions: TriviaQuestion[] = [];

  // -------------------------------------------------------------------------
  // SONGFACTS (Factual)
  // -------------------------------------------------------------------------
  if (sourceFilter === 'all' || sourceFilter === 'songfacts') {
    const songFacts = await getSongFactsBySong(song.id);

    if (songFacts.length > 0) {
      console.log(`   📚 SongFacts: ${songFacts.length} facts`);

      // Prioritize longer, more detailed facts
      const sortedFacts = [...songFacts].sort((a, b) => b.text.length - a.text.length);

      for (const fact of sortedFacts) {
        if (questions.length >= limit) break;

        const q = await generateTriviaFromSongFact(fact, song.title, artistName, songFacts);
        if (q && !isDuplicateQuestion(q, questions)) {
          questions.push(q);
          console.log(`      ✅ [${q.difficulty}] ${q.prompt.slice(0, 50)}...`);
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      console.log(`   📚 SongFacts: none`);
    }
  }

  // -------------------------------------------------------------------------
  // GENIUS (Interpretive)
  // -------------------------------------------------------------------------
  if (sourceFilter === 'all' || sourceFilter === 'genius') {
    const referents = await query<GeniusReferent>(
      `SELECT * FROM genius_referents WHERE song_id = $1 ORDER BY votes_total DESC`,
      [song.id]
    );

    if (referents.length > 0) {
      console.log(`   🎭 Genius: ${referents.length} referents`);

      for (const ref of referents) {
        if (questions.length >= limit) break;

        const q = await generateTriviaFromGenius(ref, song.title, artistName);
        if (q && !isDuplicateQuestion(q, questions)) {
          questions.push(q);
          console.log(`      ✅ [${q.difficulty}] ${q.prompt.slice(0, 50)}...`);
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      console.log(`   🎭 Genius: none`);
    }
  }

  // Calculate stats
  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  const bySource = { songfacts: 0, genius: 0 };

  for (const q of questions) {
    byDifficulty[q.difficulty]++;
    bySource[q.source]++;
  }

  // Save to database (unless dry run)
  if (!dryRun && questions.length > 0) {
    const exerciseData: CreateExerciseData[] = questions.map((q) => ({
      song_id: song.id,
      exercise_type: 'trivia' as const,
      language_code: 'en',
      question_data: {
        prompt: q.prompt,
        correct_answer: q.correct_answer,
        distractors: q.distractors,
        explanation: q.explanation,
      },
    }));

    await createExercises(exerciseData);
  }

  console.log(`   💾 Generated: ${questions.length} trivia questions`);

  return {
    songTitle: song.title,
    artistName,
    questionsGenerated: questions.length,
    byDifficulty,
    bySource,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  validateEnv(['DATABASE_URL', 'OPENROUTER_API_KEY']);

  const dryRun = values['dry-run'] ?? false;
  const limit = values.limit ? parseInt(values.limit) : 10;
  const sourceFilter = values.source || 'all';
  const processAll = values.all ?? false;

  if (!values.iswc && !processAll) {
    console.error('Usage:');
    console.error('  bun src/scripts/generate-trivia.ts --iswc=<ISWC>');
    console.error('  bun src/scripts/generate-trivia.ts --all');
    console.error('Options: --dry-run, --limit=N, --source=songfacts|genius|all');
    process.exit(1);
  }

  console.log('\n🎯 Generating Improved Trivia');
  console.log(`   Source: ${sourceFilter}`);
  console.log(`   Limit per song: ${limit}`);
  if (dryRun) console.log('   [DRY RUN]');

  // Get songs to process
  let songs: Song[];

  if (processAll) {
    songs = await query<Song>(`SELECT * FROM songs ORDER BY title`);
    console.log(`   Processing: ${songs.length} songs`);
  } else {
    const iswc = normalizeISWC(values.iswc!);
    const song = await getSongByISWC(iswc);
    if (!song) {
      console.error(`Song not found: ${iswc}`);
      process.exit(1);
    }
    songs = [song];
  }

  // Process each song
  const results: GenerationResult[] = [];

  for (const song of songs) {
    try {
      const result = await generateTriviaForSong(song, { limit, sourceFilter, dryRun });
      results.push(result);

      // Delay between songs to avoid rate limiting
      if (songs.length > 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  let totalQuestions = 0;
  const totalByDifficulty = { easy: 0, medium: 0, hard: 0 };
  const totalBySource = { songfacts: 0, genius: 0 };

  for (const r of results) {
    totalQuestions += r.questionsGenerated;
    totalByDifficulty.easy += r.byDifficulty.easy;
    totalByDifficulty.medium += r.byDifficulty.medium;
    totalByDifficulty.hard += r.byDifficulty.hard;
    totalBySource.songfacts += r.bySource.songfacts;
    totalBySource.genius += r.bySource.genius;
  }

  console.log(`\nSongs processed: ${results.length}`);
  console.log(`Total questions: ${totalQuestions}`);
  console.log(`\nBy difficulty:`);
  console.log(`   Easy:   ${totalByDifficulty.easy}`);
  console.log(`   Medium: ${totalByDifficulty.medium}`);
  console.log(`   Hard:   ${totalByDifficulty.hard}`);
  console.log(`\nBy source:`);
  console.log(`   SongFacts: ${totalBySource.songfacts}`);
  console.log(`   Genius:    ${totalBySource.genius}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes saved to database');
  }

  console.log('\n✅ Done');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
