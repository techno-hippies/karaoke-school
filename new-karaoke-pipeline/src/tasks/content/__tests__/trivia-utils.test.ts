import { describe, expect, it } from 'bun:test';

import {
  MAX_EXPLANATION_LENGTH,
  WORD_LIMIT_PER_CHOICE,
  countWords,
  flattenAnnotation,
  normalizeCategory,
  sanitizeLyrics,
  sanitizeChoiceText,
  dedupeChoiceTexts,
} from '../trivia-utils';

describe('trivia-utils', () => {
  it('counts words ignoring extra whitespace', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  keep   your   cool  ')).toBe(3);
    expect(countWords('')).toBe(0);
  });

  it('sanitizes lyrics with truncation ellipsis', () => {
    const lyrics = 'a'.repeat(10_000);
    const sanitized = sanitizeLyrics(lyrics, 100);
    expect(sanitized.length).toBe(103); // 100 chars + "..."
    expect(sanitized.endsWith('...')).toBeTrue();
  });

  it('flattens annotation DOM trees into readable text', () => {
    const annotations = [
      {
        body: {
          dom: {
            tag: 'root',
            children: [
              { tag: 'p', children: ['Stay ', { tag: 'strong', children: ['resilient'] }] },
              { tag: 'br' },
              { tag: 'p', children: ['Keep your cool when stressed.'] },
            ],
          },
        },
      },
    ];

    const result = flattenAnnotation(annotations);
    expect(result).toContain('Stay resilient');
    expect(result).toContain('Keep your cool when stressed.');
  });

  it('exports shared constants for downstream validation', () => {
    expect(WORD_LIMIT_PER_CHOICE).toBeGreaterThan(0);
    expect(MAX_EXPLANATION_LENGTH).toBeGreaterThan(0);
  });

  it('normalizes loose category labels to allowed set', () => {
    expect(normalizeCategory('figurative language')).toBe('idiom');
    expect(normalizeCategory('Symbolism/Imagery')).toBe('idiom');
    expect(normalizeCategory('Cultural Reference')).toBe('culture');
    expect(normalizeCategory('random unused category')).toBe('meaning');
  });

  it('sanitizes option text by collapsing whitespace', () => {
    expect(sanitizeChoiceText('  hello   world  ')).toBe('hello world');
  });

  it('dedupes option text case-insensitively', () => {
    expect(dedupeChoiceTexts(['One', 'one', 'Two'])).toEqual(['One', 'Two']);
  });
});
