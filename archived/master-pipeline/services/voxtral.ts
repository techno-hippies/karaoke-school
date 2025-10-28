/**
 * Voxtral Service (Mistral)
 *
 * Audio transcription using Mistral's Voxtral API
 * Preferred over ElevenLabs for TikTok clip STT (better quality)
 */

import { readFileSync } from 'fs';
import { BaseService, ServiceConfig } from './base.js';

export interface VoxtralTranscriptionResult {
  text: string;
  language: string;
  duration?: number;
}

export interface VoxtralConfig extends ServiceConfig {
  model?: string;
}

export class VoxtralService extends BaseService {
  private model: string;

  constructor(config: VoxtralConfig = {}) {
    super('Voxtral', {
      baseUrl: 'https://api.mistral.ai/v1',
      ...config,
      apiKey: config.apiKey ?? process.env.VOXTRAL_API_KEY,
    });

    this.model = config.model || 'voxtral-mini-latest';
  }

  /**
   * Transcribe audio file to text
   *
   * @param audioPath Path to audio file (mp3, wav, etc.)
   * @param language Optional language code (defaults to auto-detect)
   * @returns Transcription result with text and detected language
   */
  async transcribe(
    audioPath: string,
    language?: string
  ): Promise<VoxtralTranscriptionResult> {
    const apiKey = this.requireApiKey();

    this.log(`Transcribing audio file: ${audioPath}`);

    // Read audio file
    const audioData = readFileSync(audioPath);

    // Create multipart form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
    const parts: Buffer[] = [];

    // File field
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n`)
    );
    parts.push(Buffer.from(`Content-Type: audio/mpeg\r\n\r\n`));
    parts.push(audioData);
    parts.push(Buffer.from('\r\n'));

    // Model field
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\n`));
    parts.push(Buffer.from(`${this.model}\r\n`));

    // Language field (optional)
    if (language) {
      parts.push(Buffer.from(`--${boundary}\r\n`));
      parts.push(Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`));
      parts.push(Buffer.from(`${language}\r\n`));
    }

    // End boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    // Call API
    const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voxstral API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    this.log(`Transcription complete (${result.language || 'unknown'})`);
    this.log(`Text: "${result.text}"`);

    return {
      text: result.text || '',
      language: result.language || language || 'unknown',
      duration: result.duration,
    };
  }
}
