/**
 * Lyrics Translation Service
 * Translates lyrics line-by-line using Gemini Flash 2.5 via OpenRouter
 * Preserves word-level timing from ElevenLabs forced alignment
 */

import type { OpenRouterMessage } from './openrouter';
import { OpenRouterService } from './openrouter';
import type { ElevenLabsWord } from './elevenlabs';

// Lyric line with word timing (parsed from synced LRC or ElevenLabs)
export interface LyricLine {
  lineIndex: number;
  originalText: string;
  start: number;  // seconds
  end: number;    // seconds
  words: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

// Translated line with timing preserved
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
  translatedWords: Array<{
    text: string;
    start: number;  // Approximated from original timing
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

// Supported target languages (expand as needed)
export const SUPPORTED_LANGUAGES = {
  es: 'Spanish',
  zh: 'Mandarin Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  vi: 'Vietnamese',
  id: 'Indonesian',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export class LyricsTranslator {
  private openRouter: OpenRouterService;

  constructor(openRouterApiKey: string) {
    this.openRouter = new OpenRouterService(openRouterApiKey);
  }

  /**
   * Translate lyrics lines to target language
   * Preserves word-level timing from ElevenLabs alignment
   *
   * @param lines Lyric lines with word timing
   * @param targetLanguage ISO 639-1 language code
   * @param sourceLanguage Source language (auto-detected if not provided)
   * @returns Translation result with preserved timing
   */
  async translateLines(
    lines: LyricLine[],
    targetLanguage: LanguageCode,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult> {
    const languageName = SUPPORTED_LANGUAGES[targetLanguage];

    if (!languageName) {
      throw new Error(`Unsupported target language: ${targetLanguage}`);
    }

    console.log(`[Translator] Translating ${lines.length} lines to ${languageName} (${targetLanguage})`);

    // Build translation prompt
    const prompt = this.buildTranslationPrompt(lines, languageName, sourceLanguage);

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content:
          `You are a professional translator specializing in song lyrics. ` +
          `Translate line-by-line, preserving the poetic meaning, emotional tone, and singability. ` +
          `Return ONLY a JSON array of translated lines, no explanation.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Request structured JSON response
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
            detectedSourceLanguage: {
              type: 'string',
              description: 'ISO 639-1 code of detected source language (e.g., "en", "ko")',
            },
          },
          required: ['translations', 'detectedSourceLanguage'],
          additionalProperties: false,
        },
      },
    };

    const response = await this.openRouter.chat(messages, responseFormat);

    // Parse response
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    const translations = parsed.translations;
    const detectedSourceLang = parsed.detectedSourceLanguage || sourceLanguage;

    console.log(`[Translator] Detected source language: ${detectedSourceLang}`);

    // Merge translations with original lines and preserve timing
    const translatedLines: TranslatedLine[] = lines.map((line, index) => {
      const translation = translations.find((t: any) => t.lineIndex === index);
      const translatedText = translation?.translatedText || '[Translation missing]';

      // Approximate word timing for translated words
      // Simple approach: distribute translated words evenly across the line duration
      const translatedWords = this.approximateTranslatedWordTiming(
        translatedText,
        line.start,
        line.end
      );

      return {
        lineIndex: line.lineIndex,
        originalText: line.originalText,
        translatedText,
        start: line.start,
        end: line.end,
        words: line.words,
        translatedWords,
      };
    });

    // Calculate confidence score
    const missingTranslations = translatedLines.filter(
      (l) => l.translatedText === '[Translation missing]'
    ).length;
    const confidenceScore = Math.max(
      0,
      Math.min(1, (lines.length - missingTranslations) / lines.length)
    );

    console.log(
      `[Translator] Translation complete: ${translatedLines.length} lines, ` +
      `confidence: ${(confidenceScore * 100).toFixed(1)}%`
    );

    return {
      lines: translatedLines,
      sourceLanguage: detectedSourceLang,
      targetLanguage,
      translationSource: 'gemini-flash-2.5',
      confidenceScore,
    };
  }

  /**
   * Build translation prompt for Gemini
   */
  private buildTranslationPrompt(
    lines: LyricLine[],
    targetLanguage: string,
    sourceLanguage: string
  ): string {
    const linesText = lines
      .map((line, index) => `${index}: ${line.originalText}`)
      .join('\n');

    const sourceLangHint = sourceLanguage === 'auto'
      ? 'Detect the source language automatically.'
      : `The source language is ${sourceLanguage}.`;

    return `Translate these song lyrics to ${targetLanguage}. ${sourceLangHint}

Lyrics to translate:
${linesText}

Important:
- Maintain the same emotional intensity and meaning
- Keep translations natural and singable
- Preserve rhyme schemes where possible
- Match syllable count roughly to fit the melody
- For mixed-language songs (e.g., K-pop with English), translate ALL parts to ${targetLanguage}
- Return the detected source language code (ISO 639-1) as "detectedSourceLanguage"`;
  }

  /**
   * Approximate word timing for translated text
   * Simple approach: distribute words evenly across line duration
   *
   * TODO: Improve with word-level alignment for target language
   */
  private approximateTranslatedWordTiming(
    translatedText: string,
    lineStart: number,
    lineEnd: number
  ): Array<{ text: string; start: number; end: number }> {
    // Split translated text into words
    const words = translatedText.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      return [];
    }

    // Calculate duration per word (evenly distributed)
    const lineDuration = lineEnd - lineStart;
    const wordDuration = lineDuration / words.length;

    return words.map((word, index) => ({
      text: word,
      start: lineStart + index * wordDuration,
      end: lineStart + (index + 1) * wordDuration,
    }));
  }

  /**
   * Batch translate to multiple languages
   * Processes sequentially to avoid rate limits
   */
  async translateToMultipleLanguages(
    lines: LyricLine[],
    targetLanguages: LanguageCode[],
    sourceLanguage: string = 'auto'
  ): Promise<Map<LanguageCode, TranslationResult>> {
    const results = new Map<LanguageCode, TranslationResult>();

    console.log(`[Translator] Translating to ${targetLanguages.length} languages: ${targetLanguages.join(', ')}`);

    for (const lang of targetLanguages) {
      try {
        const result = await this.translateLines(lines, lang, sourceLanguage);
        results.set(lang, result);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Translator] Failed to translate to ${lang}:`, error);
      }
    }

    return results;
  }

  /**
   * Parse ElevenLabs word alignment into lyric lines
   * Groups words into lines based on sentence boundaries
   *
   * @param words ElevenLabs word alignment
   * @param lyricsText Original lyrics text (for line splitting)
   * @returns Lyric lines with word timing
   */
  static parseLinesFromAlignment(
    words: ElevenLabsWord[],
    lyricsText: string
  ): LyricLine[] {
    // Split lyrics into lines
    const textLines = lyricsText.split('\n').filter(line => line.trim().length > 0);

    const lines: LyricLine[] = [];
    let wordIndex = 0;

    for (let lineIndex = 0; lineIndex < textLines.length; lineIndex++) {
      const lineText = textLines[lineIndex].trim();
      const lineWords: typeof words = [];

      // Extract words for this line
      const lineWordTexts = lineText.split(/\s+/).filter(w => w.length > 0);

      for (let i = 0; i < lineWordTexts.length && wordIndex < words.length; i++) {
        lineWords.push(words[wordIndex]);
        wordIndex++;
      }

      if (lineWords.length > 0) {
        lines.push({
          lineIndex,
          originalText: lineText,
          start: lineWords[0].start,
          end: lineWords[lineWords.length - 1].end,
          words: lineWords.map(w => ({
            text: w.text,
            start: w.start,
            end: w.end,
          })),
        });
      }
    }

    return lines;
  }
}
