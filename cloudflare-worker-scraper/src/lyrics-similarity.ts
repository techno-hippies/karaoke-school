/**
 * Lyrics Similarity & Validation
 * Algorithms for comparing lyrics from different sources
 */

export interface LyricsSimilarityResult {
  jaccardSimilarity: number;        // 0.0 to 1.0 (word overlap)
  levenshteinDistance: number;      // Edit distance
  normalizedSimilarity: number;     // Overall score 0.0 to 1.0
  corroborated: boolean;            // TRUE if similarity > threshold
  validationStatus: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'conflict';
}

/**
 * Normalize lyrics for comparison
 * - Lowercase
 * - Collapse whitespace
 * - Remove punctuation
 * - Remove common artifacts (copyright notices, etc.)
 */
export function normalizeLyrics(lyrics: string): string {
  return lyrics
    .toLowerCase()
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove common artifacts
    .replace(/\*+.*this.*lyrics.*not.*commercial.*\*+/gi, '')
    .replace(/lyrics.*provided.*by.*musixmatch/gi, '')
    .replace(/copyright.*\d{4}/gi, '')
    // Remove timestamps (for LRC format)
    .replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '')
    // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')  // max 2 newlines
    .replace(/[ \t]+/g, ' ')     // collapse spaces
    // Remove punctuation (but keep spaces and newlines)
    .replace(/[^\w\s\n]/g, '')
    .trim();
}

/**
 * Jaccard Similarity: Measures word overlap between two texts
 * Returns 0.0 (no overlap) to 1.0 (identical)
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 0));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 0));

  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Levenshtein Distance: Edit distance between two strings
 * Lower is better (0 = identical)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalized Levenshtein Similarity
 * Converts edit distance to 0.0-1.0 similarity score
 */
export function normalizedLevenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1.0 - (distance / maxLen);
}

/**
 * Compare two lyrics texts and return similarity metrics
 *
 * @param lyrics1 First lyrics text
 * @param lyrics2 Second lyrics text
 * @param threshold Similarity threshold for corroboration (default: 0.80)
 * @returns Similarity metrics and validation status
 */
export function compareLyrics(
  lyrics1: string,
  lyrics2: string,
  threshold: number = 0.80
): LyricsSimilarityResult {
  // Normalize both texts
  const norm1 = normalizeLyrics(lyrics1);
  const norm2 = normalizeLyrics(lyrics2);

  // Calculate similarity metrics
  const jaccard = jaccardSimilarity(norm1, norm2);
  const levenshtein = levenshteinDistance(norm1, norm2);
  const levenshteinNorm = normalizedLevenshteinSimilarity(norm1, norm2);

  // Weighted average: 60% Jaccard (word overlap), 40% Levenshtein (character)
  const normalizedSimilarity = (jaccard * 0.6) + (levenshteinNorm * 0.4);

  // Determine validation status
  let validationStatus: LyricsSimilarityResult['validationStatus'];
  if (normalizedSimilarity >= 0.90) {
    validationStatus = 'high_confidence';
  } else if (normalizedSimilarity >= 0.70) {
    validationStatus = 'medium_confidence';
  } else if (normalizedSimilarity >= 0.50) {
    validationStatus = 'low_confidence';
  } else {
    validationStatus = 'conflict';
  }

  const corroborated = normalizedSimilarity >= threshold;

  return {
    jaccardSimilarity: Number(jaccard.toFixed(4)),
    levenshteinDistance: levenshtein,
    normalizedSimilarity: Number(normalizedSimilarity.toFixed(4)),
    corroborated,
    validationStatus,
  };
}

/**
 * Get human-readable validation notes based on similarity result
 */
export function getValidationNotes(result: LyricsSimilarityResult): string {
  const { normalizedSimilarity, validationStatus } = result;
  const percent = (normalizedSimilarity * 100).toFixed(1);

  switch (validationStatus) {
    case 'high_confidence':
      return `High confidence match (${percent}% similarity). Sources corroborate each other.`;
    case 'medium_confidence':
      return `Medium confidence match (${percent}% similarity). Minor differences found but acceptable.`;
    case 'low_confidence':
      return `Low confidence match (${percent}% similarity). Significant differences detected. Manual review recommended.`;
    case 'conflict':
      return `Conflict detected (${percent}% similarity). Sources may be for different versions or have major discrepancies.`;
  }
}
