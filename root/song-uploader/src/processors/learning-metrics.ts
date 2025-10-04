import { readFileSync } from 'fs';
import type { LineWithWords } from '../types.js';

// Lazy load syllable library
let syllableLib: any = null;
async function getSyllable() {
  if (!syllableLib) {
    syllableLib = await import('syllable');
  }
  return syllableLib.syllable;
}

// Load top 1k English words
let TOP_1K: Set<string> | null = null;
function getTop1k(): Set<string> {
  if (!TOP_1K) {
    const words = readFileSync('./top-1k-english-words.txt', 'utf-8')
      .split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);
    TOP_1K = new Set(words);
  }
  return TOP_1K;
}

export interface LearningMetrics {
  difficultyLevel: number; // 1-5 (1=beginner, 5=advanced)
  vocabularyCoverage: {
    top1kPercent: number;
    top5kPercent: number;
    uniqueWords: number;
    totalWords: number;
    difficultWords: string[];
  };
  pace: {
    wordsPerSecond: number;
    totalWords: number;
    classification: 'slow' | 'conversational' | 'fast' | 'very-fast';
  };
  pronunciation: {
    syllablesPerWord: number;
    totalSyllables: number;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  analysis: {
    repeatedPhrases: string[];
    sentenceStructure: 'simple' | 'moderate' | 'complex';
    vocabularyLevel: string; // CEFR level estimate
  };
}

/**
 * Extract all words from lyric lines (excluding structural markers)
 */
function extractWords(lines: LineWithWords[]): string[] {
  const text = lines
    .map(line => line.originalText)
    .filter(text => !text.match(/^\s*[\(\[].*[\)\]]\s*$/)) // Exclude markers like (Verse 1)
    .join(' ');

  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '') // Keep hyphens and apostrophes
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Calculate vocabulary coverage
 */
function calculateVocabularyCoverage(words: string[]): LearningMetrics['vocabularyCoverage'] {
  const top1k = getTop1k();
  const uniqueWords = new Set(words);

  const inTop1k = words.filter(w => top1k.has(w)).length;
  const difficultWords = Array.from(uniqueWords).filter(w => !top1k.has(w));

  return {
    top1kPercent: (inTop1k / words.length) * 100,
    top5kPercent: 100, // TODO: Implement top 5k list
    uniqueWords: uniqueWords.size,
    totalWords: words.length,
    difficultWords: difficultWords.slice(0, 10) // Top 10 difficult words
  };
}

/**
 * Calculate speaking pace
 */
function calculatePace(words: string[], duration: number): LearningMetrics['pace'] {
  const wps = words.length / duration;

  let classification: LearningMetrics['pace']['classification'];
  if (wps < 1.5) classification = 'slow';
  else if (wps < 2.5) classification = 'conversational';
  else if (wps < 3.5) classification = 'fast';
  else classification = 'very-fast';

  return {
    wordsPerSecond: Math.round(wps * 100) / 100, // 2 decimal places
    totalWords: words.length,
    classification
  };
}

/**
 * Calculate pronunciation complexity using syllables
 */
async function calculatePronunciation(words: string[]): Promise<LearningMetrics['pronunciation']> {
  const syllable = await getSyllable();

  const totalSyllables = words.reduce((sum, word) => {
    try {
      return sum + syllable(word);
    } catch {
      return sum + 1; // Fallback to 1 syllable for unknown words
    }
  }, 0);

  const syllablesPerWord = totalSyllables / words.length;

  let complexity: LearningMetrics['pronunciation']['complexity'];
  if (syllablesPerWord < 1.4) complexity = 'simple';
  else if (syllablesPerWord < 1.8) complexity = 'moderate';
  else complexity = 'complex';

  return {
    syllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
    totalSyllables,
    complexity
  };
}

/**
 * Analyze text structure
 */
function analyzeStructure(words: string[]): LearningMetrics['analysis'] {
  // Find repeated words (excluding common articles/prepositions)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
  const wordCounts = new Map<string, number>();

  words.forEach(word => {
    if (!stopWords.has(word)) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  });

  const repeatedPhrases = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return {
    repeatedPhrases,
    sentenceStructure: 'simple', // TODO: Implement sentence analysis
    vocabularyLevel: 'A2-B1' // TODO: Implement CEFR estimation
  };
}

/**
 * Calculate overall difficulty score (1-5)
 */
function calculateDifficulty(
  vocabularyCoverage: LearningMetrics['vocabularyCoverage'],
  pace: LearningMetrics['pace'],
  pronunciation: LearningMetrics['pronunciation']
): number {
  let score = 0;

  // Vocabulary (40% weight) - 0-2 points
  if (vocabularyCoverage.top1kPercent < 70) score += 2;
  else if (vocabularyCoverage.top1kPercent < 85) score += 1;

  // Pace (40% weight) - 0-2 points
  if (pace.wordsPerSecond > 3.5) score += 2;
  else if (pace.wordsPerSecond > 2.5) score += 1;

  // Pronunciation (20% weight) - 0-1 point
  if (pronunciation.syllablesPerWord > 1.7) score += 1;

  // Map 0-5 to 1-5 scale (no clip is easier than level 1)
  return Math.max(1, Math.min(5, Math.round(score + 1)));
}

/**
 * Analyze lyrics and generate learning metrics
 */
export async function analyzeLyrics(
  lines: LineWithWords[],
  duration: number
): Promise<LearningMetrics> {
  const words = extractWords(lines);

  if (words.length === 0) {
    throw new Error('No valid words found in lyrics');
  }

  const vocabularyCoverage = calculateVocabularyCoverage(words);
  const pace = calculatePace(words, duration);
  const pronunciation = await calculatePronunciation(words);
  const analysis = analyzeStructure(words);
  const difficultyLevel = calculateDifficulty(vocabularyCoverage, pace, pronunciation);

  return {
    difficultyLevel,
    vocabularyCoverage,
    pace,
    pronunciation,
    analysis
  };
}

/**
 * Get words per second as uint8 for contract (multiply by 10)
 * Example: 2.3 wps -> 23
 */
export function getWordsPerSecondForContract(wps: number): number {
  return Math.round(wps * 10);
}
