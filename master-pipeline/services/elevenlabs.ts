/**
 * ElevenLabs Service
 *
 * - Forced Alignment: Align lyrics to audio with word-level timestamps
 * - STT (optional): Speech-to-text transcription
 *
 * Based on audio-matching-test/scripts/match-audio-alignment.mjs
 */

import { readFileSync } from 'fs';
import { BaseService, ServiceConfig } from './base.js';

export interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type?: string;
}

export interface ElevenLabsTranscriptionResult {
  text: string;
  language: string;
  words: ElevenLabsWord[];
  duration: number;
}

export interface ElevenLabsAlignmentResult {
  words: ElevenLabsWord[];
  alignment: any;
}

export interface ElevenLabsConfig extends ServiceConfig {
  model?: string;
}

export class ElevenLabsService extends BaseService {
  private model: string;

  constructor(config: ElevenLabsConfig = {}) {
    super('ElevenLabs', {
      baseUrl: 'https://api.elevenlabs.io/v1',
      ...config,
      apiKey: config.apiKey ?? process.env.ELEVENLABS_API_KEY,
    });

    this.model = config.model || 'scribe_v1';
  }

  /**
   * Forced alignment: Align known lyrics to audio
   * Returns word-level timestamps for the entire song
   *
   * @param audioPath Path to audio file (mp3, wav, etc.)
   * @param lyricsText Plain text lyrics (no timestamps)
   * @returns Alignment result with word-level timestamps
   */
  async forcedAlignment(
    audioPath: string,
    lyricsText: string
  ): Promise<ElevenLabsAlignmentResult> {
    const apiKey = this.requireApiKey();

    this.log(`Running forced alignment on: ${audioPath}`);

    const audioBuffer = readFileSync(audioPath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    const textEncoder = new TextEncoder();

    const bodyParts: Uint8Array[] = [];

    // Add audio file part
    bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
    bodyParts.push(
      textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n')
    );
    bodyParts.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
    bodyParts.push(new Uint8Array(audioBuffer));
    bodyParts.push(textEncoder.encode('\r\n'));

    // Add text part
    bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
    bodyParts.push(textEncoder.encode('Content-Disposition: form-data; name="text"\r\n\r\n'));
    bodyParts.push(textEncoder.encode(lyricsText));
    bodyParts.push(textEncoder.encode('\r\n'));

    // End boundary
    bodyParts.push(textEncoder.encode(`--${boundary}--\r\n`));

    // Combine all parts
    const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
    const combinedBody = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of bodyParts) {
      combinedBody.set(part, offset);
      offset += part.length;
    }

    const response = await fetch(`${this.config.baseUrl}/forced-alignment`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: combinedBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs forced alignment error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    this.log(`Forced alignment complete: ${data.words?.length || 0} words aligned`);

    return {
      words: data.words || [],
      alignment: data.alignment || data,
    };
  }

  /**
   * Transcribe audio file to text with word-level timestamps
   * NOTE: Voxstral is preferred for clip STT, this is mainly for reference
   *
   * @param audioPath Path to audio file (mp3, wav, etc.)
   * @param languageCode Optional language code (defaults to 'en')
   * @returns Transcription result with text, words, and timestamps
   */
  async transcribe(
    audioPath: string,
    languageCode: string = 'en'
  ): Promise<ElevenLabsTranscriptionResult> {
    const apiKey = this.requireApiKey();

    this.log(`Transcribing audio file: ${audioPath}`);

    // Read audio file
    const audioBuffer = readFileSync(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    // Create form data
    const formData = new FormData();
    formData.append('file', audioBlob, audioPath.split('/').pop());
    formData.append('model_id', this.model);
    formData.append('language_code', languageCode);

    // Call API
    const response = await fetch(`${this.config.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Filter out whitespace-only words
    if (data.words) {
      data.words = data.words.filter((word: ElevenLabsWord) => {
        return word.text.trim().length > 0;
      });
    }

    this.log(
      `Transcription complete: ${data.words?.length || 0} words (${data.language || languageCode})`
    );
    this.log(`Text: "${data.text?.slice(0, 100)}..."`);

    return {
      text: data.text || '',
      language: data.language || languageCode,
      words: data.words || [],
      duration: data.duration || 0,
    };
  }
}
