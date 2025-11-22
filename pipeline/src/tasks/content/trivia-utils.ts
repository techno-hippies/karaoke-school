import type { TriviaCategory } from '../../types/trivia';

export const WORD_LIMIT_PER_CHOICE = 8;
export const MAX_EXPLANATION_LENGTH = 120;
export const ALLOWED_CATEGORIES = new Set<TriviaCategory>([
  'meaning',
  'culture',
  'slang',
  'history',
  'idiom',
]);

const CATEGORY_KEYWORDS: Array<[RegExp, TriviaCategory]> = [
  [/culture|cultural|tradition|context/i, 'culture'],
  [/slang|street|colloquial/i, 'slang'],
  [/history|historical|origin/i, 'history'],
  [/idiom|idiomatic|expression/i, 'idiom'],
  [/figurative|metaphor|symbol|imagery|poetic/i, 'idiom'],
  [/meaning|definition|interpret|theme/i, 'meaning'],
];

export function sanitizeLyrics(lyrics: string, maxLength = 8000): string {
  const cleaned = lyrics.replace(/\r/g, '').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength)}...`;
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function flattenAnnotation(annotations: any): string {
  if (!annotations) return '';

  const entries = Array.isArray(annotations) ? annotations : [annotations];

  const fragments = entries
    .map((annotation) => {
      const dom = annotation?.body?.dom;
      if (!dom) return '';
      return flattenDomNode(dom).trim();
    })
    .filter(Boolean);

  return fragments.join('\n\n');
}

export function flattenDomNode(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    return node.map(flattenDomNode).join('');
  }

  const children = node.children ? flattenDomNode(node.children) : '';

  switch (node.tag) {
    case 'br':
      return '\n';
    case 'p':
    case 'span':
    case 'em':
    case 'strong':
    case 'a':
    case 'root':
      return children;
    case 'img':
      return node.attributes?.alt ? `[Image: ${node.attributes.alt}]` : '';
    default:
      return children;
  }
}

export function normalizeCategory(rawCategory: string): TriviaCategory {
  const candidate = rawCategory.trim().toLowerCase();

  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(candidate)) {
      return category;
    }
  }

  if (ALLOWED_CATEGORIES.has(candidate as TriviaCategory)) {
    return candidate as TriviaCategory;
  }

  return 'meaning';
}

export function sanitizeChoiceText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function dedupeChoiceTexts(values: string[]): string[] {
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
