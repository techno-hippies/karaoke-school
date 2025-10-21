/**
 * Translation Service
 *
 * Provides multilingual translation for creator content
 * Default languages: Vietnamese (vi) + Mandarin Chinese (zh)
 * Configurable via TRANSLATION_LANGUAGES env var
 *
 * Uses OpenRouter API with Gemini Flash 2.5 Lite
 */

import { BaseService, ServiceConfig } from './base.js';
import type { OpenRouterMessage, OpenRouterResponse } from './openrouter.js';

export interface TranslationConfig extends ServiceConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  defaultLanguages?: string[];
}

export interface TranslationResult {
  [languageCode: string]: string;
}

export class TranslationService extends BaseService {
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private defaultLanguages: string[];

  // Language code to full name mapping
  private static readonly LANGUAGE_NAMES: Record<string, string> = {
    vi: 'Vietnamese',
    zh: 'Mandarin Chinese (Simplified)',
    'zh-CN': 'Mandarin Chinese (Simplified)',
    'zh-TW': 'Traditional Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    'pt-BR': 'Brazilian Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
    hi: 'Hindi',
    th: 'Thai',
    id: 'Indonesian',
  };

  constructor(config: TranslationConfig = {}) {
    super('Translation', {
      baseUrl: 'https://openrouter.ai/api/v1',
      ...config,
      apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY,
    });

    this.model = config.model || 'google/gemini-2.5-flash-lite-preview-09-2025';
    this.temperature = config.temperature ?? 0.3; // Lower for consistent translations
    this.maxTokens = config.maxTokens ?? 2048;

    // Parse default languages from env or use vi,zh
    const envLanguages = process.env.TRANSLATION_LANGUAGES;
    this.defaultLanguages =
      config.defaultLanguages ||
      (envLanguages ? envLanguages.split(',').map((l) => l.trim()) : ['vi', 'zh']);

    this.log(`Default languages: ${this.defaultLanguages.join(', ')}`);
  }

  /**
   * Get language name from code
   */
  private getLanguageName(code: string): string {
    return TranslationService.LANGUAGE_NAMES[code] || code;
  }

  /**
   * Call OpenRouter API for translation
   */
  private async callOpenRouter(
    messages: OpenRouterMessage[]
  ): Promise<OpenRouterResponse> {
    const apiKey = this.requireApiKey();

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://karaoke-school.ai',
        'X-Title': 'Karaoke School Translation Service',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Translate text to target language
   *
   * @param text English text to translate
   * @param targetLanguage Language code (e.g., 'vi', 'zh')
   * @returns Translated text
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    const languageName = this.getLanguageName(targetLanguage);

    const prompt = `Translate the following English text to ${languageName}.
Preserve the meaning and tone as accurately as possible.
Only return the translated text, nothing else.

English text:
${text}`;

    const response = await this.callOpenRouter([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const translatedText = response.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('Empty translation response from OpenRouter');
    }

    return translatedText;
  }

  /**
   * Translate text to multiple languages
   *
   * @param text English text to translate
   * @param languages Language codes (defaults to service's default languages)
   * @param rateLimitMs Delay between requests in milliseconds
   * @returns Object mapping language codes to translated text
   */
  async translateToMultiple(
    text: string,
    languages?: string[],
    rateLimitMs: number = 1000
  ): Promise<TranslationResult> {
    const targetLanguages = languages || this.defaultLanguages;
    const result: TranslationResult = {};

    this.log(`Translating to ${targetLanguages.length} languages...`);

    for (let i = 0; i < targetLanguages.length; i++) {
      const lang = targetLanguages[i];

      try {
        this.log(`Translating to ${lang}... (${i + 1}/${targetLanguages.length})`);
        result[lang] = await this.translateText(text, lang);
        this.log(`✓ ${lang}: "${result[lang].slice(0, 50)}..."`);

        // Rate limiting
        if (i < targetLanguages.length - 1 && rateLimitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
        }
      } catch (error: any) {
        this.log(`✗ Translation to ${lang} failed: ${error.message}`);
        result[lang] = `[Translation failed: ${text}]`;
      }
    }

    return result;
  }

  /**
   * Translate profile bio
   *
   * @param bio English bio text
   * @param languages Language codes (optional)
   * @returns Object mapping language codes to translated bios
   */
  async translateBio(bio: string, languages?: string[]): Promise<TranslationResult> {
    this.log('Translating profile bio...');
    return this.translateToMultiple(bio, languages);
  }

  /**
   * Translate video description
   *
   * @param description English description text
   * @param languages Language codes (optional)
   * @returns Object mapping language codes to translated descriptions
   */
  async translateDescription(
    description: string,
    languages?: string[]
  ): Promise<TranslationResult> {
    this.log('Translating video description...');
    return this.translateToMultiple(description, languages);
  }

  /**
   * Translate multiple texts in batch
   * Useful for translating multiple video descriptions at once
   *
   * @param texts Array of English texts
   * @param languages Language codes (optional)
   * @returns Array of translation results
   */
  async translateBatch(
    texts: string[],
    languages?: string[]
  ): Promise<TranslationResult[]> {
    this.log(`Translating ${texts.length} texts...`);

    const results: TranslationResult[] = [];

    for (let i = 0; i < texts.length; i++) {
      this.log(`\nTranslating text ${i + 1}/${texts.length}...`);
      results.push(await this.translateToMultiple(texts[i], languages));
    }

    return results;
  }

  /**
   * Get default languages for this service instance
   */
  getDefaultLanguages(): string[] {
    return this.defaultLanguages;
  }

  /**
   * Check if a language code is supported
   */
  isLanguageSupported(code: string): boolean {
    return code in TranslationService.LANGUAGE_NAMES;
  }

  /**
   * Get all supported language codes
   */
  static getSupportedLanguages(): string[] {
    return Object.keys(TranslationService.LANGUAGE_NAMES);
  }
}
