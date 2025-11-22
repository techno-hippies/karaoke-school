import { describe, expect, it } from 'bun:test';

import { dedupeCandidates, isLineEligible, sanitizeCandidate } from '../translation-quiz-helpers';

describe('translation-quiz-helpers', () => {
  it('flags lines with <= max words as eligible', () => {
    expect(isLineEligible('Hold me close')).toBe(true);
    expect(isLineEligible('This line has exactly eight words okay')).toBe(true);
    expect(isLineEligible('This particular lyric line definitely has more than eight words now')).toBe(false);
  });

  it('sanitizes candidates by trimming whitespace', () => {
    expect(sanitizeCandidate('  hello   world  ')).toBe('hello world');
  });

  it('dedupes candidate distractors case-insensitively', () => {
    expect(dedupeCandidates(['Hello', 'hello', 'HELLO', 'Hi'])).toEqual(['Hello', 'Hi']);
  });

  it('preserves original ordering for unique inputs', () => {
    expect(dedupeCandidates(['A', 'B', 'C'])).toEqual(['A', 'B', 'C']);
  });
});
