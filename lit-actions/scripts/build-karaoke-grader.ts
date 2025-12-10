#!/usr/bin/env bun

/**
 * Build Karaoke Line Grader with embedded phoneme dictionary
 *
 * Combines:
 * - actions/karaoke-line-grader-v1.js (main logic)
 * - data/phonemes.generated.js (phoneme dictionary)
 *
 * Output: output/karaoke-line-grader-v1-phonemes.js
 *
 * Usage:
 *   bun scripts/build-karaoke-grader.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

async function main() {
  console.log('🔧 Building Karaoke Line Grader with Phonemes\n');

  // Read phoneme dictionary
  const phonemePath = join(ROOT_DIR, 'data/phonemes.generated.js');
  if (!existsSync(phonemePath)) {
    console.error('❌ Phoneme dictionary not found. Run generate-phoneme-dict.ts first.');
    process.exit(1);
  }

  const phonemeContent = readFileSync(phonemePath, 'utf-8');

  // Extract just the PHONEMES object (remove export)
  const phonemeMatch = phonemeContent.match(/export const PHONEMES=\{[\s\S]*\};/);
  if (!phonemeMatch) {
    console.error('❌ Could not parse PHONEMES from dictionary');
    process.exit(1);
  }

  // Convert to plain const
  const phonemeDict = phonemeMatch[0].replace('export const PHONEMES=', 'const PHONEMES=');

  // Read the main grader source
  const graderPath = join(ROOT_DIR, 'actions/karaoke-line-grader-v1.js');
  const graderContent = readFileSync(graderPath, 'utf-8');

  // Find the SCORING section and replace it with phoneme-based scoring
  const scoringSectionStart = graderContent.indexOf('// ============================================================\n// SCORING');
  const scoringSectionEnd = graderContent.indexOf('// ============================================================\n// CONTRACT SUBMISSION');

  if (scoringSectionStart === -1 || scoringSectionEnd === -1) {
    console.error('❌ Could not find SCORING section markers');
    process.exit(1);
  }

  const beforeScoring = graderContent.slice(0, scoringSectionStart);
  const afterScoring = graderContent.slice(scoringSectionEnd);

  // New phoneme-based scoring section
  const newScoringSection = `// ============================================================
// PHONEME DICTIONARY (Auto-generated from CMU Dict)
// ============================================================

${phonemeDict}

// Similar phoneme pairs for reduced penalty
const SIMILAR_PHONEMES = [
  ['AA', 'AH'], ['AE', 'EH'], ['IH', 'IY'], ['UH', 'UW'], ['AO', 'OW'],
  ['P', 'B'], ['T', 'D'], ['K', 'G'], ['F', 'V'], ['S', 'Z'],
  ['TH', 'DH'], ['SH', 'ZH'], ['CH', 'JH'], ['M', 'N'], ['L', 'R'],
];

// Build similarity lookup
const SIMILAR_MAP = new Map();
for (const [a, b] of SIMILAR_PHONEMES) {
  if (!SIMILAR_MAP.has(a)) SIMILAR_MAP.set(a, new Set());
  if (!SIMILAR_MAP.has(b)) SIMILAR_MAP.set(b, new Set());
  SIMILAR_MAP.get(a).add(b);
  SIMILAR_MAP.get(b).add(a);
}

// ============================================================
// SCORING (Phoneme-based)
// ============================================================

/**
 * Simple stemmer - strip common suffixes to find base form
 */
function stem(word) {
  // Try exact match first
  if (PHONEMES[word]) return word;

  // Common suffix patterns (order matters - longer first)
  const suffixes = [
    'ingly', 'edly', 'tion', 'sion', 'ness', 'ment', 'able', 'ible',
    'ing', 'ied', 'ies', 'ers', 'est', 'ful', 'ous', 'ive',
    'ed', 'er', 'es', 'ly', 's'
  ];

  for (const suffix of suffixes) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      if (PHONEMES[base]) return base;
      // Try adding 'e' back (e.g., "biting" -> "bit" -> "bite")
      if (PHONEMES[base + 'e']) return base + 'e';
    }
  }

  return word;
}

/**
 * Get phonemes for a word, with stemming fallback
 */
function getPhonemes(word) {
  const normalized = word.toLowerCase().replace(/[^a-z']/g, '');

  // Direct lookup first
  if (PHONEMES[normalized]) return PHONEMES[normalized];

  // Try stemmed form
  const stemmed = stem(normalized);
  return PHONEMES[stemmed] || null;
}

/**
 * Calculate phoneme distance between two phoneme arrays
 * Uses weighted Levenshtein where similar phonemes have lower cost
 */
function phonemeDistance(phonemes1, phonemes2) {
  if (!phonemes1 || !phonemes2) return Infinity;

  const m = phonemes1.length;
  const n = phonemes2.length;

  // Create DP matrix
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const p1 = phonemes1[i - 1];
      const p2 = phonemes2[j - 1];

      if (p1 === p2) {
        dp[i][j] = dp[i - 1][j - 1]; // No cost for exact match
      } else {
        // Check if similar phonemes (reduced cost)
        const isSimilar = SIMILAR_MAP.get(p1)?.has(p2) || false;
        const substituteCost = isSimilar ? 0.3 : 1;

        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + substituteCost, // Substitute
          dp[i][j - 1] + 1,                  // Insert
          dp[i - 1][j] + 1                   // Delete
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate phoneme similarity between two words (0-1)
 */
function phonemeSimilarity(word1, word2) {
  const p1 = getPhonemes(word1);
  const p2 = getPhonemes(word2);

  if (!p1 || !p2) {
    // Fallback to character-based if no phonemes
    return characterSimilarity(word1, word2);
  }

  const distance = phonemeDistance(p1, p2);
  const maxLen = Math.max(p1.length, p2.length);
  return Math.max(0, 1 - (distance / maxLen));
}

/**
 * Character-based similarity fallback
 */
function characterSimilarity(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();

  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  return 1 - (distance / Math.max(a.length, b.length));
}

/**
 * Levenshtein distance for character strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    // Expand common contractions
    .replace(/\\bi'ma?\\b/g, 'im going to')
    .replace(/\\bgonna\\b/g, 'going to')
    .replace(/\\bwanna\\b/g, 'want to')
    .replace(/\\bgotta\\b/g, 'got to')
    .replace(/\\bkinda\\b/g, 'kind of')
    .replace(/\\blemme\\b/g, 'let me')
    .replace(/\\b'?cause\\b/g, 'because')
    // Remove punctuation
    .replace(/[!"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_\`{|}~]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return normalizeText(text).split(' ').filter(w => w.length > 0);
}

/**
 * Find best phoneme match for a word in a list of candidates
 * Returns the best similarity score (0-1)
 */
function findBestMatch(targetWord, candidateWords) {
  let bestScore = 0;

  for (const candidate of candidateWords) {
    const similarity = phonemeSimilarity(targetWord, candidate);
    if (similarity > bestScore) {
      bestScore = similarity;
    }
    // Early exit on perfect match
    if (bestScore >= 0.99) break;
  }

  return bestScore;
}

/**
 * Calculate score in basis points (0-10000)
 *
 * Word-presence scoring with phoneme matching:
 * - For each expected word, find best phoneme match in transcript
 * - Don't penalize extra words (handles bleeding from adjacent lines)
 * - Use phoneme similarity for fuzzy matching
 */
function calculateLevenshteinScore(transcript, expectedText) {
  const expectedWords = tokenize(expectedText);
  const actualWords = tokenize(transcript);

  if (expectedWords.length === 0 && actualWords.length === 0) {
    return 10000;
  }

  if (expectedWords.length === 0) {
    // No expected words but we got some audio - likely silence expected
    return 5000;
  }

  if (actualWords.length === 0) {
    // Expected words but got nothing
    return 0;
  }

  // Score each expected word by best match in transcript
  let totalScore = 0;

  for (const expectedWord of expectedWords) {
    const matchScore = findBestMatch(expectedWord, actualWords);
    totalScore += matchScore;
  }

  // Average score across expected words
  const avgScore = totalScore / expectedWords.length;

  // Convert to basis points
  return Math.max(0, Math.min(10000, Math.round(avgScore * 10000)));
}

/**
 * Convert score to FSRS rating (0-3)
 * 0=Again, 1=Hard, 2=Good, 3=Easy
 */
function scoreToRating(scoreBp) {
  if (scoreBp >= 9000) return 3; // Easy - Excellent
  if (scoreBp >= 7500) return 2; // Good
  if (scoreBp >= 6000) return 1; // Hard
  return 0; // Again - Needs practice
}

`;

  // Combine into final output
  const output = beforeScoring + newScoringSection + afterScoring;

  // Ensure output directory exists
  const outputDir = join(ROOT_DIR, 'output');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, 'karaoke-line-grader-v1-phonemes.js');
  writeFileSync(outputPath, output);

  const sizeKB = (output.length / 1024).toFixed(1);
  console.log(`✅ Built output/karaoke-line-grader-v1-phonemes.js (${sizeKB} KB)`);

  if (output.length > 5 * 1024 * 1024) {
    console.error('⚠️  WARNING: Output exceeds 5MB Lit Action limit!');
    process.exit(1);
  }

  console.log('\n📋 Next steps:');
  console.log('   1. bun scripts/upload-action.ts karaoke-line-grader-v1-phonemes.js');
  console.log('   2. Update cids/dev.json with new CID');
  console.log('   3. bun scripts/encrypt-key.ts --action=karaoke-line');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
