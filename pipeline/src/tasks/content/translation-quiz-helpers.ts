import { countWords } from './trivia-utils';

export const MAX_LINE_WORDS = 8;
export const DEFAULT_DISTRACTOR_POOL_SIZE = 6;

export function isLineEligible(text: string, maxWords = MAX_LINE_WORDS): boolean {
  const words = countWords(text);
  return words > 0 && words <= maxWords;
}

export function sanitizeCandidate(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function dedupeCandidates(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(value);
    }
  }

  return deduped;
}
