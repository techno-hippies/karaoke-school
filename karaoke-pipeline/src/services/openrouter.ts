/**
 * OpenRouter AI Service
 * Uses Gemini Flash 2.5 Lite for lyrics normalization and language detection
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-lite-preview-09-2025';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenRouter Service Class
 * Provides chat completions via Gemini Flash 2.5
 */
export class OpenRouterService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Make OpenRouter chat completion with optional response format
   */
  async chat(
    messages: OpenRouterMessage[],
    responseFormat?: any
  ): Promise<OpenRouterResponse> {
    const body: any = {
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/karaoke-school',
        'X-Title': 'Karaoke Pipeline v2',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data: OpenRouterResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenRouter returned no choices');
    }

    return data;
  }

  /**
   * Simple text completion (legacy method for backward compatibility)
   */
  async complete(messages: OpenRouterMessage[]): Promise<string> {
    const response = await this.chat(messages);
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenRouter returned empty content');
    }
    return content.trim();
  }
}

/**
 * Legacy helper function for direct calls
 */
async function callOpenRouter(
  messages: OpenRouterMessage[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in environment');
  }

  const service = new OpenRouterService(apiKey);
  return service.complete(messages);
}

/**
 * Normalize lyrics using AI when multiple sources corroborate
 * Combines LRCLIB + Lyrics.ovh into single clean version
 */
export async function normalizeLyrics(
  lrclibLyrics: string,
  lyricsOvhLyrics: string,
  trackTitle: string,
  artistName: string
): Promise<string> {
  const systemPrompt = `You are a lyrics normalization specialist. Your task is to merge and normalize lyrics from two different sources into a single, clean, accurate version.

IMPORTANT RULES:
1. Remove timestamp markers like [00:12.34] or (0:12)
2. Remove metadata like [Chorus], [Verse], [Bridge], etc.
3. Use proper capitalization for names and song-specific terms
4. Keep the original language and spelling (don't translate)
5. Preserve line breaks that indicate song structure
6. Remove duplicate lines UNLESS they're intentional repetition in the song
7. Fix obvious typos, but DON'T change stylistic choices
8. Keep all words exactly as sung (no censoring, no substitutions)
9. Return ONLY the normalized lyrics - no explanations, no metadata`;

  const userPrompt = `Song: "${trackTitle}" by ${artistName}

Source 1 (LRCLIB):
${lrclibLyrics}

Source 2 (Lyrics.ovh):
${lyricsOvhLyrics}

Merge these into a single normalized version. Return only the lyrics, nothing else.`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const normalized = await callOpenRouter(messages);
    return normalized;
  } catch (error: any) {
    console.error(`Failed to normalize lyrics: ${error.message}`);
    // Fallback to LRCLIB (typically more accurate with timing info)
    return lrclibLyrics;
  }
}

/**
 * Clean and normalize lyrics from a single source
 * Removes metadata, timestamps, and formatting artifacts
 */
export async function cleanLyrics(
  lyrics: string,
  trackTitle: string,
  artistName: string
): Promise<string> {
  const systemPrompt = `You are a lyrics cleaning specialist. Your task is to clean and normalize lyrics by removing formatting artifacts while preserving the original text.

IMPORTANT RULES:
1. Remove timestamp markers like [00:12.34] or (0:12)
2. Remove metadata like [Chorus], [Verse], [Bridge], [Intro], [Outro], etc.
3. Remove parenthetical sounds like (ooh), (ahh), (yeah), etc. UNLESS they appear in the main lyrics
4. Use proper capitalization for names and song-specific terms
5. Keep the original language and spelling (don't translate)
6. Preserve line breaks that indicate song structure
7. Remove duplicate lines UNLESS they're intentional repetition in the song
8. Fix obvious typos, but DON'T change stylistic choices
9. Keep all words exactly as sung (no censoring, no substitutions)
10. Return ONLY the cleaned lyrics - no explanations, no metadata`;

  const userPrompt = `Song: "${trackTitle}" by ${artistName}

Lyrics to clean:
${lyrics}

Clean these lyrics following the rules. Return only the lyrics, nothing else.`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const cleaned = await callOpenRouter(messages);
    return cleaned;
  } catch (error: any) {
    console.error(`Failed to clean lyrics: ${error.message}`);
    // Fallback to original
    return lyrics;
  }
}

/**
 * Language name mapping for ISO 639-1 codes
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  zh: 'Mandarin',
  ja: 'Japanese',
  ko: 'Korean',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
};

/**
 * Detect language composition of lyrics
 * Critical for K-pop mixed-language handling
 * Simple approach: Gemini identifies WHICH languages are present
 */
export async function detectLanguages(
  lyrics: string,
  trackTitle: string,
  artistName: string
): Promise<{
  primary: string;
  detectedLanguages: string[];
  confidence: number;
}> {
  const systemPrompt = `You are a language detection specialist. Identify all languages present in these song lyrics.

IMPORTANT:
1. Use ONLY ISO 639-1 two-letter language codes (en, ko, ja, es, zh, etc.)
2. NEVER return "und", "mul", or any 3-letter codes
3. Onomatopoeia and vocal ad-libs (da-da-da, mmm, uh-uh, sha-la-la, boom-boom, etc.) are sung sounds, NOT separate languages
4. Vocalizations should be classified as part of the primary language
5. Identify the PRIMARY language (the one used most)
6. List any SECONDARY languages present (if the song mixes languages like K-pop)
7. Return ONLY valid JSON in this exact format:

{
  "primary": "en",
  "detectedLanguages": ["en"],
  "hasSecondaryLanguages": false,
  "notes": "English song with vocal ad-libs",
  "confidence": 0.95
}

For a mixed-language song:
{
  "primary": "ko",
  "detectedLanguages": ["ko", "en"],
  "hasSecondaryLanguages": true,
  "notes": "K-pop with Korean verses and English chorus",
  "confidence": 0.92
}`;

  const userPrompt = `Song: "${trackTitle}" by ${artistName}

Lyrics:
${lyrics}

Identify all languages. Return ONLY JSON, no explanations.`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await callOpenRouter(messages);

    // Extract JSON from response (in case AI adds markdown formatting)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.primary || !Array.isArray(parsed.detectedLanguages)) {
      throw new Error('Invalid response structure - missing primary or detectedLanguages');
    }

    return {
      primary: parsed.primary,
      detectedLanguages: parsed.detectedLanguages,
      confidence: parsed.confidence || 0.9,
    };
  } catch (error: any) {
    console.error(`Failed to detect languages: ${error.message}`);

    // Fallback: assume English (most common default)
    return {
      primary: 'en',
      detectedLanguages: ['en'],
      confidence: 0.5, // Low confidence for fallback
    };
  }
}
