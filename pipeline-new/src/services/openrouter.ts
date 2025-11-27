/**
 * OpenRouter Service
 *
 * Uses Gemini Flash 2.5 Lite for lyrics translation and cleaning.
 */

import { OPENROUTER_API_KEY } from '../config';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-lite-preview-09-2025';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call OpenRouter API with Gemini Flash 2.5 Lite
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  responseFormat?: Record<string, unknown>
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: 0.1,
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://github.com/karaoke-school',
      'X-Title': 'Karaoke Pipeline New',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Clean lyrics: remove adlibs, keep section markers
 *
 * Removes: (yeah), (uh), (ooh), ad-libs in parentheses
 * Keeps: [Verse 1], [Chorus], [Bridge], section markers
 */
export async function cleanLyrics(
  lyrics: string,
  title: string,
  artist: string
): Promise<string> {
  const systemPrompt = `You are a lyrics cleaning specialist. Clean song lyrics by:

REMOVE:
- Parenthetical ad-libs: (yeah), (uh), (ooh), (come on), (woo), etc.
- Parenthetical sounds: (breathing), (laughing), (screaming), etc.
- Parenthetical stage directions: (repeat), (x2), (fade out)
- Background vocals in parentheses unless they're significant lyrics

KEEP:
- Section markers in brackets: [Verse 1], [Chorus], [Bridge], [Intro], [Outro], [Pre-Chorus], [Hook]
- ALL actual lyrics, even if explicit
- Line breaks between lines
- The original structure

Return ONLY the cleaned lyrics. No explanations.`;

  const userPrompt = `Song: "${title}" by ${artist}

Lyrics:
${lyrics}

Clean these lyrics following the rules.`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return result.trim();
}

/**
 * Translate lyrics line-by-line
 */
export async function translateLyrics(
  lines: string[],
  targetLanguage: string,
  languageName: string
): Promise<string[]> {
  const systemPrompt = `You are a professional song lyrics translator. Translate each line to ${languageName}.

RULES:
- Translate line-by-line, preserving line count exactly
- Keep section markers like [Verse 1], [Chorus] unchanged
- Maintain emotional tone and meaning
- Make it natural and singable in ${languageName}
- Match syllable count roughly where possible
- Return ONLY a JSON array of translated lines, nothing else

Example input: ["[Verse 1]", "His palms are sweaty", "Knees weak, arms are heavy"]
Example output: ["[Verse 1]", "他手心出汗", "膝盖发软，手臂沉重"]`;

  const userPrompt = `Translate these lyrics to ${languageName}:

${JSON.stringify(lines, null, 2)}

Return ONLY a JSON array of translated strings.`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // Extract JSON array from response
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in translation response');
  }

  const translated: string[] = JSON.parse(jsonMatch[0]);

  // Validate line count
  if (translated.length !== lines.length) {
    console.warn(`⚠️  Line count mismatch: expected ${lines.length}, got ${translated.length}`);
  }

  return translated;
}

/**
 * Language configurations
 */
export const LANGUAGES = {
  zh: { code: 'zh', name: 'Mandarin Chinese (Simplified)' },
  vi: { code: 'vi', name: 'Vietnamese' },
  id: { code: 'id', name: 'Indonesian' },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
