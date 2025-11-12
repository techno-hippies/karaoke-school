/**
 * Voxtral (Mistral AI) STT Service
 * Speech-to-text transcription using Mistral's Voxtral model
 *
 * API Docs: https://docs.mistral.ai/api/audio/transcriptions
 *
 * Use Cases:
 * - Transcribe TikTok videos with multilingual content
 * - Handle Spanish/English code-switching
 * - Extract lyrics from music videos
 *
 * Features:
 * - Excellent multilingual support (especially Spanish)
 * - Auto language detection
 * - Cost effective ($0.18/hour = $0.00005/second)
 *
 * Limitations:
 * - No word-level timestamps (segments array is empty)
 * - Requires Gemini + FA lookup for timing
 */

import { VOXTRAL_CONFIG } from '../config';

/**
 * Voxtral transcription result (no word-level timestamps)
 */
export interface VoxtralTranscriptionResult {
  text: string;          // Full transcript
  language: string | null;  // Detected language (often null with auto-detection)
  duration: number;      // Audio duration in seconds (from usage.prompt_audio_seconds)
  wordCount: number;     // Approximate word count from text
  model: string;         // Model used (voxtral-mini-latest)
}

/**
 * Transcription options
 */
export interface VoxtralTranscriptionOptions {
  /** Model to use (default: voxtral-mini-latest) */
  model?: string;
}

/**
 * Voxtral STT Service
 *
 * Pattern: Simple fetch wrapper (no word timestamps)
 * - Constructor takes API key
 * - Main method: transcribe(audioUrl, options)
 * - Returns text-only result (no timing data)
 */
export class VoxtralService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Voxtral API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = VOXTRAL_CONFIG.baseUrl;
  }

  /**
   * Transcribe audio to text (no word-level timestamps)
   *
   * @param audioUrl - URL to audio/video file (supports mp3, mp4, webm, etc.)
   * @param options - Transcription options (model selection)
   * @returns Transcription result with text only
   */
  async transcribe(
    audioUrl: string,
    options: VoxtralTranscriptionOptions = {}
  ): Promise<VoxtralTranscriptionResult> {
    const { model = VOXTRAL_CONFIG.model } = options;

    console.log(`[Voxtral] Downloading audio from: ${audioUrl}`);

    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(
        `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioSizeMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(2);

    console.log(`[Voxtral] Transcribing audio (size: ${audioSizeMB} MB, model: ${model})`);

    // Build multipart/form-data request manually (Mistral API requires specific format)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);

    const encoder = new TextEncoder();

    // Model field
    const modelPart = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`;
    const modelPartBytes = encoder.encode(modelPart);

    // File field
    const extension = audioUrl.split('.').pop()?.split('?')[0] || 'mp4';
    const mimeType = this.getMimeType(extension);
    const filePart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const filePartBytes = encoder.encode(filePart);

    // Footer
    const footer = `\r\n--${boundary}--\r\n`;
    const footerBytes = encoder.encode(footer);

    // Combine all parts
    const bodyBytes = new Uint8Array(
      modelPartBytes.length +
        filePartBytes.length +
        audioBuffer.byteLength +
        footerBytes.length
    );

    let offset = 0;
    bodyBytes.set(modelPartBytes, offset);
    offset += modelPartBytes.length;
    bodyBytes.set(filePartBytes, offset);
    offset += filePartBytes.length;
    bodyBytes.set(new Uint8Array(audioBuffer), offset);
    offset += audioBuffer.byteLength;
    bodyBytes.set(footerBytes, offset);

    const startTime = Date.now();

    // Call Voxtral API
    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Voxtral STT failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;

    console.log(`[Voxtral] ✓ Transcription complete (${durationMs}ms)`);

    // Transform API response to our typed format
    return this.parseTranscriptionResult(result);
  }

  /**
   * Parse Voxtral API response into our typed format
   */
  private parseTranscriptionResult(apiResponse: any): VoxtralTranscriptionResult {
    // Voxtral API response structure:
    // {
    //   model: "voxtral-mini-latest",
    //   text: "Full transcript...",
    //   language: null,  // Often null with auto-detection
    //   segments: [],    // Empty - no word-level timestamps
    //   usage: {
    //     prompt_audio_seconds: 11,
    //     prompt_tokens: 3,
    //     total_tokens: 397,
    //     completion_tokens: 19
    //   }
    // }

    const text = apiResponse.text || '';
    const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;

    return {
      text,
      language: apiResponse.language,
      duration: apiResponse.usage?.prompt_audio_seconds || 0,
      wordCount,
      model: apiResponse.model || 'voxtral-mini-latest',
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
}

/**
 * Factory function to create Voxtral service from environment
 */
export function createVoxtralService(): VoxtralService {
  const apiKey = process.env.VOXTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('VOXTRAL_API_KEY environment variable not set');
  }
  return new VoxtralService(apiKey);
}
