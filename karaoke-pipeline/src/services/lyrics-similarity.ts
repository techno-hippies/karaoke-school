/**
 * Lyrics Similarity Calculation
 * Uses Jaccard + Levenshtein to determine if two lyrics sources corroborate
 */

/**
 * Normalize lyrics formatting for comparison
 * Removes formatting differences (line breaks, extra whitespace)
 * while preserving content for meaningful similarity comparison
 */
function normalizeFormatting(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace various line break types with spaces
    .replace(/[\r\n]+/g, ' ')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    // Remove extra punctuation that doesn't affect meaning
    .replace(/[,;:]/g, ' ')
    // Clean up any remaining multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaccard similarity between two sets of words
 * Returns 0.0 to 1.0 (1.0 = identical)
 */
function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns edit distance (lower = more similar)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Convert Levenshtein distance to similarity score (0.0 to 1.0)
 */
function levenshteinSimilarity(text1: string, text2: string): number {
  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);

  if (maxLength === 0) return 1.0;

  return 1.0 - distance / maxLength;
}

/**
 * Calculate combined similarity score
 * Weighs Jaccard + Levenshtein equally
 * Returns 0.0 to 1.0 (0.80+ = corroborated)
 */
export function calculateSimilarity(lyrics1: string, lyrics2: string): {
  jaccardScore: number;
  levenshteinScore: number;
  combinedScore: number;
  corroborated: boolean;
} {
  // Normalize formatting (line breaks, whitespace, punctuation)
  // then lowercase and trim for comparison
  const norm1 = normalizeFormatting(lyrics1);
  const norm2 = normalizeFormatting(lyrics2);

  const jaccardScore = jaccardSimilarity(norm1, norm2);
  const levenshteinScore = levenshteinSimilarity(norm1, norm2);

  // Combined score: average of both metrics
  const combinedScore = (jaccardScore + levenshteinScore) / 2;

  // Corroborated if similarity >= 80%
  const corroborated = combinedScore >= 0.80;

  return {
    jaccardScore: Math.round(jaccardScore * 100) / 100,
    levenshteinScore: Math.round(levenshteinScore * 100) / 100,
    combinedScore: Math.round(combinedScore * 100) / 100,
    corroborated,
  };
}
