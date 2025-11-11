/**
 * Cartesia STT Service
 * Speech-to-text transcription for TikTok videos using Cartesia Ink-Whisper
 *
 * API Docs: https://docs.cartesia.ai/api-reference/stt/transcribe
 *
 * Use Cases:
 * - Transcribe TikTok creator commentary/reactions
 * - Extract spoken lyrics from performance videos
 * - Generate subtitles for karaoke content
 *
 * Features:
 * - Word-level timestamps
 * - Multiple language support
 * - Fast inference (optimized Whisper)
 */

import { CARTESIA_CONFIG } from '../config';

/**
 * Word-level timestamp from Cartesia STT
 */
export interface CartesiaWord {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

/**
 * Transcription segment with timing
 */
export interface CartesiaSegment {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
  words: CartesiaWord[];
}

/**
 * Complete transcription result
 */
export interface CartesiaTranscriptionResult {
  text: string;                  // Full transcript
  segments: CartesiaSegment[];   // Segments with timing
  language: string;              // Detected language code (e.g., "en")
  duration: number;              // Audio duration in seconds
  wordCount: number;             // Total words transcribed
}

/**
 * Transcription options
 */
export interface TranscriptionOptions {
  /** Target language (auto-detected if not specified) */
  language?: string;

  /** Enable word-level timestamps (default: true) */
  wordTimestamps?: boolean;

  /** Model to use (default: ink-whisper) */
  model?: string;

  /** API version (default: 2025-04-16) */
  version?: string;
}

/**
 * Cartesia STT Service
 *
 * Pattern: Similar to ElevenLabsService
 * - Constructor takes API key
 * - Main method: transcribe(audioUrl, options)
 * - Returns typed result with word-level timestamps
 */
export class CartesiaService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Cartesia API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = CARTESIA_CONFIG.baseUrl;
  }

  /**
   * Transcribe audio to text with word-level timestamps
   *
   * @param audioUrl - URL to audio/video file (supports mp3, wav, mp4, webm)
   * @param options - Transcription options (language, timestamps, etc.)
   * @returns Transcription result with segments and word-level timing
   */
  async transcribe(
    audioUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<CartesiaTranscriptionResult> {
    const {
      language,
      wordTimestamps = true,
      model = CARTESIA_CONFIG.model,
      version = CARTESIA_CONFIG.version,
    } = options;

    console.log(`[Cartesia] Downloading audio from: ${audioUrl}`);

    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(
        `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioSizeMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(2);

    console.log(`[Cartesia] Transcribing audio (size: ${audioSizeMB} MB, model: ${model})`);

    // Build multipart/form-data request
    const formData = new FormData();

    // Detect file extension from URL
    const extension = audioUrl.split('.').pop()?.split('?')[0] || 'mp4';
    const mimeType = this.getMimeType(extension);

    formData.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${extension}`);
    formData.append('model_id', model);

    if (language) {
      formData.append('language', language);
    }

    if (wordTimestamps) {
      formData.append('timestamp_granularity', CARTESIA_CONFIG.timestampGranularity);
    }

    const startTime = Date.now();

    // Call Cartesia STT API
    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: {
        'Cartesia-Version': version,
        'X-API-Key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cartesia STT failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;

    console.log(`[Cartesia] ✓ Transcription complete (${durationMs}ms)`);

    // Transform API response to our typed format
    return this.parseTranscriptionResult(result, durationMs);
  }

  /**
   * Parse Cartesia API response into our typed format
   */
  private parseTranscriptionResult(
    apiResponse: any,
    durationMs: number
  ): CartesiaTranscriptionResult {
    // Cartesia API response structure (based on Whisper format):
    // {
    //   text: "Full transcript...",
    //   segments: [
    //     {
    //       text: "Segment text",
    //       start: 0.0,
    //       end: 2.5,
    //       words: [{ word: "Hello", start: 0.0, end: 0.5 }, ...]
    //     }
    //   ],
    //   language: "en"
    // }

    const segments: CartesiaSegment[] = (apiResponse.segments || []).map((seg: any) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      words: (seg.words || []).map((w: any) => ({
        word: w.word || w.text,
        start: w.start,
        end: w.end,
      })),
    }));

    // Calculate total word count
    const wordCount = segments.reduce((sum, seg) => sum + seg.words.length, 0);

    // Estimate duration from last segment
    const duration = segments.length > 0
      ? segments[segments.length - 1].end
      : 0;

    return {
      text: apiResponse.text || '',
      segments,
      language: apiResponse.language || 'unknown',
      duration,
      wordCount,
    };
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Extract plain text transcript (no timestamps)
   */
  static getPlainText(result: CartesiaTranscriptionResult): string {
    return result.text;
  }

  /**
   * Extract all words with timestamps (flattened from segments)
   */
  static getAllWords(result: CartesiaTranscriptionResult): CartesiaWord[] {
    return result.segments.flatMap(seg => seg.words);
  }

  /**
   * Format transcript with timestamps (SRT-style)
   */
  static formatWithTimestamps(result: CartesiaTranscriptionResult): string {
    return result.segments
      .map((seg, idx) => {
        const startTime = this.formatTime(seg.start);
        const endTime = this.formatTime(seg.end);
        return `${idx + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
      })
      .join('\n');
  }

  /**
   * Format seconds to SRT timestamp (HH:MM:SS,mmm)
   */
  private static formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}

/**
 * Factory function to create Cartesia service from environment
 */
export function createCartesiaService(): CartesiaService {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    throw new Error('CARTESIA_API_KEY environment variable not set');
  }
  return new CartesiaService(apiKey);
}
