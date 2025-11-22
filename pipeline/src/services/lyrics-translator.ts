/**
 * Lyrics Translation Service
 * Translates lyrics line-by-line using Gemini Flash 2.5 via OpenRouter
 * Preserves word-level timing from ElevenLabs forced alignment
 */

import type { OpenRouterMessage } from './openrouter';
import { OpenRouterService } from './openrouter';

// ElevenLabs word format (from elevenlabs_word_alignments table)
export interface ElevenLabsWord {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
}

// Lyric line with word timing (parsed from ElevenLabs alignment)
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
  words: Array<{        // English word-level timing (for highlighting)
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

      return {
        lineIndex: line.lineIndex,
        originalText: line.originalText,
        translatedText,     // Translated text (line level)
        start: line.start,  // Timing already at line level
        end: line.end,
        words: line.words,  // English word-level timing for highlighting
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
      translationSource: 'gemini-flash-2.5-lite',
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
   * Groups words by newline characters (\n) in the ElevenLabs word array
   *
   * IMPORTANT: ElevenLabs returns words with spaces and newlines as separate elements.
   * We group words by finding '\n' markers in the word array itself.
   *
   * @param words ElevenLabs word alignment (includes spaces and newlines)
   * @param lyricsText Original lyrics text (unused, kept for compatibility)
   * @returns Lyric lines with word timing
   */
  static parseLinesFromAlignment(
    words: ElevenLabsWord[],
    lyricsText: string
  ): LyricLine[] {
    const lines: LyricLine[] = [];
    let currentLineWords: Array<{ text: string; start: number; end: number }> = [];
    let lineIndex = 0;

    for (const word of words) {
      // Newline marks end of line
      if (word.text === '\n') {
        if (currentLineWords.length > 0) {
          // Build line from accumulated words
          const lineText = currentLineWords.map(w => w.text).join('').trim();

          // Filter out space-only words for clean display
          const cleanWords = currentLineWords
            .filter(w => w.text.trim().length > 0)
            .map(w => ({
              text: w.text.trim(),
              start: Math.round(w.start * 100) / 100,
              end: Math.round(w.end * 100) / 100,
            }));

          if (cleanWords.length > 0) {
            lines.push({
              lineIndex,
              originalText: lineText,
              start: Math.round(currentLineWords[0].start * 100) / 100,
              end: Math.round(currentLineWords[currentLineWords.length - 1].end * 100) / 100,
              words: cleanWords,
            });
            lineIndex++;
          }

          currentLineWords = [];
        }
        continue;
      }

      // Add word to current line (includes spaces)
      currentLineWords.push({
        text: word.text,
        start: word.start,
        end: word.end,
      });
    }

    // Flush final line if exists
    if (currentLineWords.length > 0) {
      const lineText = currentLineWords.map(w => w.text).join('').trim();
      const cleanWords = currentLineWords
        .filter(w => w.text.trim().length > 0)
        .map(w => ({
          text: w.text.trim(),
          start: Math.round(w.start * 100) / 100,
          end: Math.round(w.end * 100) / 100,
        }));

      if (cleanWords.length > 0) {
        lines.push({
          lineIndex,
          originalText: lineText,
          start: Math.round(currentLineWords[0].start * 100) / 100,
          end: Math.round(currentLineWords[currentLineWords.length - 1].end * 100) / 100,
          words: cleanWords,
        });
      }
    }

    return lines;
  }
}
