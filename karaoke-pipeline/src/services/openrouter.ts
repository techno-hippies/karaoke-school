/**
 * OpenRouter AI Service
 * Uses Gemini Flash 2.5 Lite for lyrics normalization and language detection
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-lite-preview-09-2025';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
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
 * Make OpenRouter API call
 */
async function callOpenRouter(
  messages: OpenRouterMessage[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in environment');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/karaoke-school',
      'X-Title': 'Karaoke Pipeline v2',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1, // Low temperature for consistency
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('OpenRouter returned no choices');
  }

  const content = data.choices[0].message.content;
  if (!content) {
    throw new Error('OpenRouter returned empty content');
  }

  return content.trim();
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
 * Detect language composition of lyrics
 * Critical for K-pop mixed-language handling
 */
export async function detectLanguages(
  lyrics: string,
  trackTitle: string,
  artistName: string
): Promise<{
  primary: string;
  breakdown: Array<{ code: string; language: string; percentage: number }>;
  confidence: number;
}> {
  const systemPrompt = `You are a language detection specialist. Your task is to analyze song lyrics and identify the languages used, including mixed-language songs (like K-pop which often mixes Korean and English).

IMPORTANT RULES:
1. Use ISO 639-1 two-letter language codes (en, ko, ja, es, etc.)
2. Estimate percentage for each language based on word/line count
3. The "primary" language is the one with highest percentage
4. Be accurate - K-pop songs often have 60-80% Korean, 20-40% English
5. Return ONLY valid JSON in this exact format:
{
  "primary": "ko",
  "breakdown": [
    {"code": "ko", "language": "Korean", "percentage": 70},
    {"code": "en", "language": "English", "percentage": 30}
  ],
  "confidence": 0.95
}`;

  const userPrompt = `Song: "${trackTitle}" by ${artistName}

Lyrics:
${lyrics}

Analyze the language composition. Return ONLY JSON, no explanations.`;

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
    if (!parsed.primary || !parsed.breakdown || !Array.isArray(parsed.breakdown)) {
      throw new Error('Invalid response structure');
    }

    // Ensure percentages add up to 100
    const total = parsed.breakdown.reduce((sum: number, lang: any) => sum + (lang.percentage || 0), 0);
    if (Math.abs(total - 100) > 5) {
      console.warn(`Language percentages don't sum to 100: ${total}`);
    }

    return {
      primary: parsed.primary,
      breakdown: parsed.breakdown,
      confidence: parsed.confidence || 0.9,
    };
  } catch (error: any) {
    console.error(`Failed to detect languages: ${error.message}`);

    // Fallback: assume English (most common default)
    return {
      primary: 'en',
      breakdown: [
        { code: 'en', language: 'English', percentage: 100 }
      ],
      confidence: 0.5, // Low confidence for fallback
    };
  }
}
