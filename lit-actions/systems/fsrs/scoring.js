/**
 * Pronunciation Scoring Logic
 *
 * Compares expected lyrics with actual transcription using Levenshtein distance.
 * Converts similarity score to FSRS rating for spaced repetition scheduling.
 */

import { Rating } from './constants.js';

/**
 * Calculate Levenshtein distance between two strings
 * Measures minimum number of single-character edits (insertions, deletions, substitutions)
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Levenshtein distance
 */
export function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix
  const matrix = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        // Characters match, no operation needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of:
        // - Substitution (diagonal)
        // - Insertion (left)
        // - Deletion (top)
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize text for comparison
 * - Convert to lowercase
 * - Remove punctuation
 * - Normalize whitespace
 * - Trim
 *
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
}

/**
 * Calculate pronunciation score (0-100) based on similarity
 *
 * @param {string} expected - Expected lyrics
 * @param {string} actual - Actual transcription
 * @returns {number} Score (0-100)
 */
export function calculatePronunciationScore(expected, actual) {
  // Handle edge cases
  if (!expected || !actual) return 0;

  // Normalize both strings
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  // Both empty after normalization = perfect match (shouldn't happen)
  if (normalizedExpected.length === 0 && normalizedActual.length === 0) {
    return 100;
  }

  // One is empty = total failure
  if (normalizedExpected.length === 0 || normalizedActual.length === 0) {
    return 0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);

  // Calculate similarity as percentage
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);
  const similarity = 1 - (distance / maxLength);

  // Convert to 0-100 score
  const score = Math.max(0, Math.min(100, Math.round(similarity * 100)));

  return score;
}

/**
 * Convert pronunciation score (0-100) to FSRS rating (0-3)
 *
 * Thresholds:
 * - 90-100: Easy (3) - Excellent pronunciation
 * - 75-89:  Good (2) - Good pronunciation with minor errors
 * - 60-74:  Hard (1) - Difficult, many errors but recognizable
 * - 0-59:   Again (0) - Failed, not recognizable
 *
 * @param {number} score - Pronunciation score (0-100)
 * @returns {number} FSRS rating (0-3)
 */
export function scoreToRating(score) {
  if (score >= 90) return Rating.Easy;
  if (score >= 75) return Rating.Good;
  if (score >= 60) return Rating.Hard;
  return Rating.Again;
}

/**
 * Calculate pronunciation score for multiple lines
 *
 * @param {Array} expectedLines - Array of expected lyrics
 * @param {Array} actualLines - Array of actual transcriptions
 * @returns {Array} Array of scores (0-100) per line
 */
export function calculateMultiLineScores(expectedLines, actualLines) {
  const scores = [];
  const maxLength = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < maxLength; i++) {
    const expected = expectedLines[i] || '';
    const actual = actualLines[i] || '';
    scores.push(calculatePronunciationScore(expected, actual));
  }

  return scores;
}

/**
 * Get rating name for display
 *
 * @param {number} rating - FSRS rating (0-3)
 * @returns {string} Rating name
 */
export function getRatingName(rating) {
  switch (rating) {
    case Rating.Again: return 'Again';
    case Rating.Hard: return 'Hard';
    case Rating.Good: return 'Good';
    case Rating.Easy: return 'Easy';
    default: return 'Unknown';
  }
}

/**
 * Get score interpretation for display
 *
 * @param {number} score - Pronunciation score (0-100)
 * @returns {string} Interpretation
 */
export function getScoreInterpretation(score) {
  if (score >= 95) return 'Perfect! 🎉';
  if (score >= 90) return 'Excellent! ⭐';
  if (score >= 80) return 'Very Good! 👍';
  if (score >= 75) return 'Good 👌';
  if (score >= 65) return 'Decent, needs work 📝';
  if (score >= 60) return 'Hard, practice more 💪';
  if (score >= 50) return 'Difficult, keep trying 🔄';
  return 'Try again ❌';
}

/**
 * Calculate average score across multiple lines
 *
 * @param {Array<number>} scores - Array of scores (0-100)
 * @returns {number} Average score (0-100)
 */
export function calculateAverageScore(scores) {
  if (!scores || scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
}

/**
 * Calculate pass/fail for segment completion
 * Segment is "passed" if average score >= 60 (Hard threshold)
 *
 * @param {Array<number>} scores - Array of scores (0-100)
 * @returns {boolean} True if segment passed
 */
export function isSegmentPassed(scores) {
  const avgScore = calculateAverageScore(scores);
  return avgScore >= 60;
}

/**
 * Get detailed scoring breakdown for debugging
 *
 * @param {string} expected - Expected lyrics
 * @param {string} actual - Actual transcription
 * @returns {Object} Detailed breakdown
 */
export function getScoreBreakdown(expected, actual) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const score = calculatePronunciationScore(expected, actual);
  const rating = scoreToRating(score);

  return {
    expected,
    actual,
    normalizedExpected,
    normalizedActual,
    distance,
    maxLength: Math.max(normalizedExpected.length, normalizedActual.length),
    similarity: (1 - distance / Math.max(normalizedExpected.length, normalizedActual.length)),
    score,
    rating,
    ratingName: getRatingName(rating),
    interpretation: getScoreInterpretation(score)
  };
}
