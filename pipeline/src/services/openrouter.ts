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
 * Language configurations for localization
 * 12 target languages for global coverage
 */
export const LANGUAGES = {
  zh: { code: 'zh', name: 'Mandarin Chinese (Simplified)' },
  vi: { code: 'vi', name: 'Vietnamese' },
  id: { code: 'id', name: 'Indonesian' },
  ja: { code: 'ja', name: 'Japanese' },
  ko: { code: 'ko', name: 'Korean' },
  es: { code: 'es', name: 'Spanish' },
  pt: { code: 'pt', name: 'Portuguese (Brazilian)' },
  ar: { code: 'ar', name: 'Arabic' },
  tr: { code: 'tr', name: 'Turkish' },
  ru: { code: 'ru', name: 'Russian' },
  hi: { code: 'hi', name: 'Hindi' },
  th: { code: 'th', name: 'Thai' },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

/**
 * Localized metadata result type
 */
export interface LocalizedMetadata {
  title_zh: string;
  title_vi: string;
  title_id: string;
  title_ja: string;
  title_ko: string;
  title_es: string;
  title_pt: string;
  title_ar: string;
  title_tr: string;
  title_ru: string;
  title_hi: string;
  title_th: string;
  artist_zh: string;
  artist_vi: string;
  artist_id: string;
  artist_ja: string;
  artist_ko: string;
  artist_es: string;
  artist_pt: string;
  artist_ar: string;
  artist_tr: string;
  artist_ru: string;
  artist_hi: string;
  artist_th: string;
}

/**
 * Translate song title and artist name for localization
 *
 * Returns translations for all 12 supported languages at once to minimize API calls.
 * Artist names get transliterated (phonetic) for Western artists, or use
 * local names for Asian artists who have established ones.
 */
export async function translateSongMetadata(
  title: string,
  artistName: string
): Promise<LocalizedMetadata> {
  const systemPrompt = `You are a music metadata translator. Translate song titles and artist names for language learners.

SONG TITLES:
- Translate the meaning to each target language
- Keep it natural and recognizable
- If the title is a proper noun or brand name, transliterate it phonetically

ARTIST NAMES:
- For Western artists: use phonetic transliteration in non-Latin scripts
  - Chinese: 泰勒·斯威夫特 (Taylor Swift)
  - Japanese: テイラー・スウィフト
  - Korean: 테일러 스위프트
  - Arabic: تايلور سويفت
  - Russian: Тейлор Свифт
  - Hindi: टेलर स्विफ्ट
  - Thai: เทย์เลอร์ สวิฟต์
- For Latin-script languages (Spanish, Portuguese, Vietnamese, Indonesian, Turkish): keep Western names as-is
- For Asian artists: use their established local name if known (e.g., "Jay Chou" → "周杰伦")
- If unsure, use phonetic transliteration

Return ONLY valid JSON with exactly these 24 keys:
{
  "title_zh": "...", "title_vi": "...", "title_id": "...", "title_ja": "...", "title_ko": "...",
  "title_es": "...", "title_pt": "...", "title_ar": "...", "title_tr": "...", "title_ru": "...",
  "title_hi": "...", "title_th": "...",
  "artist_zh": "...", "artist_vi": "...", "artist_id": "...", "artist_ja": "...", "artist_ko": "...",
  "artist_es": "...", "artist_pt": "...", "artist_ar": "...", "artist_tr": "...", "artist_ru": "...",
  "artist_hi": "...", "artist_th": "..."
}`;

  const userPrompt = `Translate this song metadata:
- Song Title: "${title}"
- Artist Name: "${artistName}"

Translate to: Chinese (Simplified), Vietnamese, Indonesian, Japanese, Korean, Spanish, Portuguese, Arabic, Turkish, Russian, Hindi, Thai`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // Extract JSON from response
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in translation response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate all required keys exist
  const requiredKeys = [
    'title_zh', 'title_vi', 'title_id', 'title_ja', 'title_ko',
    'title_es', 'title_pt', 'title_ar', 'title_tr', 'title_ru',
    'title_hi', 'title_th',
    'artist_zh', 'artist_vi', 'artist_id', 'artist_ja', 'artist_ko',
    'artist_es', 'artist_pt', 'artist_ar', 'artist_tr', 'artist_ru',
    'artist_hi', 'artist_th',
  ];
  for (const key of requiredKeys) {
    if (!parsed[key] || typeof parsed[key] !== 'string') {
      throw new Error(`Missing or invalid key in translation response: ${key}`);
    }
  }

  return parsed;
}
