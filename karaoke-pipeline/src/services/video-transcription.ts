/**
 * TikTok Video Transcription Service
 *
 * Orchestrates the full workflow:
 * 1. Download TikTok video audio
 * 2. Transcribe with Cartesia STT (WORD-LEVEL TIMESTAMPS, 66% cheaper than ElevenLabs!)
 * 3. Translate to multiple languages (Gemini via OpenRouter)
 * 4. Generate embeddings (DeepInfra google/embeddinggemma-300m - 768 dims)
 * 5. Store in database
 */

import { CartesiaSTTService } from './cartesia-stt';
import { OpenRouterService } from './openrouter';
import { deepInfraEmbedding } from './deepinfra-embedding';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export interface TranscriptionResult {
  transcriptionText: string;
  detectedLanguage: string;
  confidence: number;
  processingTimeMs: number;
  embedding: number[];
  wordTimestamps?: any[];  // Word-level timestamps from Voxtral
}

export interface TranslationResult {
  languageCode: string;
  translatedText: string;
  confidence: number;
  embedding: number[];
}

export interface VideoTranscriptionResult {
  transcription: TranscriptionResult;
  translations: TranslationResult[];
}

export class VideoTranscriptionService {
  private cartesia: CartesiaSTTService;
  private openRouter: OpenRouterService;

  constructor(cartesiaApiKey: string, openRouterApiKey: string) {
    this.cartesia = new CartesiaSTTService({ apiKey: cartesiaApiKey });
    this.openRouter = new OpenRouterService(openRouterApiKey);
  }

  /**
   * Download audio from TikTok video URL using yt-dlp
   */
  private async downloadAudio(videoUrl: string, outputPath: string): Promise<string> {
    console.log(`[VideoTranscription] Downloading audio from ${videoUrl}`);

    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${videoUrl}"`;

    try {
      await execAsync(command);
      console.log(`[VideoTranscription] Audio downloaded to ${outputPath}`);
      return outputPath;
    } catch (error: any) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }

  /**
   * Transcribe TikTok video
   * Returns transcription text, detected language, and embedding
   */
  async transcribeVideo(
    videoUrl: string,
    videoId: string
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    // Download audio to temp file
    const audioPath = join(tmpdir(), `tiktok-${videoId}-${Date.now()}.mp3`);

    try {
      await this.downloadAudio(videoUrl, audioPath);

      // Transcribe with Cartesia STT (defaults to English, perfect for our use case!)
      console.log(`[VideoTranscription] Transcribing video ${videoId}`);
      const cartesiaResult = await this.cartesia.transcribe(audioPath);

      // Generate embedding
      console.log(`[VideoTranscription] Generating embedding for transcription`);
      const embedding = await deepInfraEmbedding.embed(cartesiaResult.text);

      const processingTime = Date.now() - startTime;

      return {
        transcriptionText: cartesiaResult.text,
        detectedLanguage: cartesiaResult.language || 'en',  // Cartesia defaults to English
        confidence: 0.95, // Use default confidence
        processingTimeMs: processingTime,
        embedding,
        wordTimestamps: cartesiaResult.words,  // Word-level timestamps from Cartesia!
      };
    } finally {
      // Cleanup temp file
      if (existsSync(audioPath)) {
        unlinkSync(audioPath);
      }
    }
  }

  /**
   * Translate transcription to target language
   */
  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    targetLanguageName: string
  ): Promise<TranslationResult> {
    console.log(`[VideoTranscription] Translating to ${targetLanguageName} (${targetLanguage})`);

    const systemPrompt = `You are a professional translator. Translate the text from ${sourceLanguage} to ${targetLanguageName}.
Preserve the original meaning, tone, and style. Return ONLY the translated text, no explanations.`;

    const userPrompt = `Translate this text to ${targetLanguageName}:\n\n${text}`;

    // Request structured JSON response
    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'translation',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            translatedText: {
              type: 'string',
              description: 'The translated text in the target language',
            },
            confidence: {
              type: 'number',
              description: 'Translation confidence score between 0 and 1',
            },
          },
          required: ['translatedText', 'confidence'],
          additionalProperties: false,
        },
      },
    };

    const response = await this.openRouter.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      responseFormat
    );

    const parsed = JSON.parse(response.choices[0].message.content);
    const translatedText = parsed.translatedText;
    const confidence = parsed.confidence || 0.9;

    // Generate embedding for translated text
    console.log(`[VideoTranscription] Generating embedding for ${targetLanguage} translation`);
    const embedding = await deepInfraEmbedding.embed(translatedText);

    return {
      languageCode: targetLanguage,
      translatedText,
      confidence,
      embedding,
    };
  }

  /**
   * Translate to multiple languages
   */
  async translateToMultipleLanguages(
    text: string,
    sourceLanguage: string,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<TranslationResult[]> {
    const translations: TranslationResult[] = [];

    for (const lang of targetLanguages) {
      try {
        const translation = await this.translateText(
          text,
          sourceLanguage,
          lang.code,
          lang.name
        );
        translations.push(translation);

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`[VideoTranscription] Failed to translate to ${lang.code}:`, error.message);
      }
    }

    return translations;
  }

  /**
   * Full workflow: transcribe + translate to all enabled languages
   */
  async processVideo(
    videoUrl: string,
    videoId: string,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<VideoTranscriptionResult> {
    console.log(`[VideoTranscription] Processing video ${videoId}`);

    // Step 1: Transcribe
    const transcription = await this.transcribeVideo(videoUrl, videoId);

    console.log(`[VideoTranscription] Transcription complete: "${transcription.transcriptionText.substring(0, 100)}..."`);
    console.log(`[VideoTranscription] Detected language: ${transcription.detectedLanguage}`);

    // Step 2: Translate to all target languages
    const translations = await this.translateToMultipleLanguages(
      transcription.transcriptionText,
      transcription.detectedLanguage,
      targetLanguages
    );

    console.log(`[VideoTranscription] Completed ${translations.length} translations`);

    return {
      transcription,
      translations,
    };
  }
}

/**
 * Language code to name mapping (for translation prompts)
 */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Mandarin Chinese (Simplified)',
  vi: 'Vietnamese',
  id: 'Indonesian',
  es: 'Spanish',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  th: 'Thai',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  it: 'Italian',
};
