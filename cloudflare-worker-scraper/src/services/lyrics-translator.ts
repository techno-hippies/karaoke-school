/**
 * Lyrics Translation Service
 * Translates lyric lines using Gemini Flash 2.5 Lite via OpenRouter
 */

import { OpenRouterService, type OpenRouterMessage } from './openrouter';
import type { LyricLine } from './lyrics-line-parser';

export interface TranslatedLine {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  words: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

export interface TranslationResult {
  lines: TranslatedLine[];
  sourceLanguage: string;
  targetLanguage: string;
  translationSource: string;
  confidenceScore: number;
}

// Supported target languages
export const SUPPORTED_LANGUAGES = {
  zh: 'Mandarin Chinese',
  vi: 'Vietnamese',
  id: 'Indonesian',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export class LyricsTranslator {
  private openRouter: OpenRouterService;

  constructor(openRouterApiKey: string) {
    this.openRouter = new OpenRouterService(openRouterApiKey);
  }

  /**
   * Translate all lines to target language
   */
  async translateLines(
    lines: LyricLine[],
    targetLanguage: LanguageCode,
    sourceLanguage: string = 'en'
  ): Promise<TranslationResult> {
    const languageName = SUPPORTED_LANGUAGES[targetLanguage];

    // Build prompt for batch translation
    const prompt = this.buildTranslationPrompt(lines, languageName);

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are a professional translator specializing in song lyrics. Translate line-by-line, preserving the poetic meaning and emotional tone. Return ONLY a JSON array of translated lines, no explanation.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Request structured JSON response using OpenRouter's json_schema format
    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'lyrics_translation',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              description: 'Array of translated lyric lines',
              items: {
                type: 'object',
                properties: {
                  lineIndex: {
                    type: 'number',
                    description: 'Zero-based index of the line',
                  },
                  translatedText: {
                    type: 'string',
                    description: 'Translated lyric text for this line',
                  },
                },
                required: ['lineIndex', 'translatedText'],
                additionalProperties: false,
              },
            },
          },
          required: ['translations'],
          additionalProperties: false,
        },
      },
    };

    const response = await this.openRouter.chat(messages, responseFormat);

    // Parse response
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    const translations = parsed.translations;

    // Merge translations with original lines
    const translatedLines: TranslatedLine[] = lines.map((line, index) => {
      const translation = translations.find((t: any) => t.lineIndex === index);

      return {
        lineIndex: line.lineIndex,
        originalText: line.originalText,
        translatedText: translation?.translatedText || '[Translation missing]',
        start: line.start,
        end: line.end,
        words: line.words,
      };
    });

    // Calculate confidence score (simple heuristic)
    const missingTranslations = translatedLines.filter(
      (l) => l.translatedText === '[Translation missing]'
    ).length;
    const confidenceScore = Math.max(
      0,
      Math.min(1, (lines.length - missingTranslations) / lines.length)
    );

    return {
      lines: translatedLines,
      sourceLanguage,
      targetLanguage,
      translationSource: 'gemini-flash-2.5',
      confidenceScore,
    };
  }

  /**
   * Build translation prompt
   */
  private buildTranslationPrompt(lines: LyricLine[], targetLanguage: string): string {
    const linesText = lines
      .map((line, index) => `${index}: ${line.originalText}`)
      .join('\n');

    return `Translate these song lyrics to ${targetLanguage}. Preserve the poetic meaning, emotional tone, and poetic flow suitable for singing.

Lyrics to translate:
${linesText}

Important:
- Maintain the same emotional intensity and meaning
- Keep translations natural and singable
- Preserve rhyme schemes where possible
- Match the syllable count roughly to fit the melody`;
  }

  /**
   * Batch translate to multiple languages
   */
  async translateToMultipleLanguages(
    lines: LyricLine[],
    targetLanguages: LanguageCode[]
  ): Promise<Map<LanguageCode, TranslationResult>> {
    const results = new Map<LanguageCode, TranslationResult>();

    // Translate sequentially to avoid rate limits
    for (const lang of targetLanguages) {
      const result = await this.translateLines(lines, lang);
      results.set(lang, result);
    }

    return results;
  }
}
