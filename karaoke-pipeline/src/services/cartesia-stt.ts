/**
 * Cartesia STT Service
 *
 * Speech-to-text transcription with ink-whisper model
 * 1/3 the price of ElevenLabs!
 * Testing if it returns word-level timestamps...
 */

import { readFileSync } from 'fs';

export interface CartesiaWord {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface CartesiaTranscriptionResult {
  text: string;
  language: string;
  words?: CartesiaWord[];
  duration?: number;
}

export interface CartesiaConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class CartesiaSTTService {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: CartesiaConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.CARTESIA_API_KEY ?? '';
    this.model = config.model ?? 'ink-whisper';
    this.baseUrl = config.baseUrl ?? 'https://api.cartesia.ai/stt';

    if (!this.apiKey) {
      throw new Error('CARTESIA_API_KEY required');
    }
  }

  /**
   * Transcribe audio file to text
   * Testing to see if Cartesia returns word-level timestamps
   *
   * @param audioPath Path to audio file (mp3, wav, etc.)
   * @param languageCode Optional language code
   * @returns Transcription result
   */
  async transcribe(
    audioPath: string,
    languageCode?: string
  ): Promise<CartesiaTranscriptionResult> {
    console.log(`[Cartesia] Transcribing audio file: ${audioPath}`);

    // Read audio file
    const audioBuffer = readFileSync(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    // Create form data
    const formData = new FormData();
    formData.append('file', audioBlob, audioPath.split('/').pop() || 'audio.mp3');
    formData.append('model', this.model);

    if (languageCode) {
      formData.append('language', languageCode);
    }

    // REQUEST WORD-LEVEL TIMESTAMPS!
    formData.append('timestamp_granularities[]', 'word');

    // Call API
    const startTime = Date.now();
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Cartesia-Version': '2025-04-16',  // Latest version with word timestamps
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cartesia API error (${response.status}): ${errorText}`);
    }

    // For batch API, response should be complete JSON
    const data = await response.json();
    const processingTime = Date.now() - startTime;

    const wordCount = data.words?.length || 0;

    console.log(`[Cartesia] Transcription complete (${data.language || languageCode || 'detected'}) in ${processingTime}ms`);
    console.log(`[Cartesia] Text: "${data.text?.slice(0, 100)}${data.text?.length > 100 ? '...' : ''}"`);
    console.log(`[Cartesia] Word timestamps: ${wordCount} words`);

    // Normalize word structure to match ElevenLabs format (text field)
    const normalizedWords = (data.words || []).map((w: any) => ({
      text: w.word,  // Cartesia uses "word", normalize to "text"
      start: w.start,
      end: w.end,
    }));

    return {
      text: data.text || '',
      language: data.language || languageCode || 'unknown',
      words: normalizedWords,
      duration: data.duration || 0,
    };
  }

  /**
   * Transcribe audio buffer directly (no file system)
   *
   * @param audioBuffer Audio data buffer
   * @param filename Filename for API (e.g., "audio.mp3")
   * @param languageCode Optional language code
   * @returns Transcription result
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    filename: string = 'audio.mp3',
    languageCode?: string
  ): Promise<CartesiaTranscriptionResult> {
    console.log(`[Cartesia] Transcribing audio buffer (${audioBuffer.length} bytes)`);

    // Create blob and form data
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', this.model);

    if (languageCode) {
      formData.append('language', languageCode);
    }

    // REQUEST WORD-LEVEL TIMESTAMPS!
    formData.append('timestamp_granularities[]', 'word');

    // Call API
    const startTime = Date.now();
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Cartesia-Version': '2025-04-16',  // Latest version with word timestamps
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cartesia API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    const wordCount = data.words?.length || 0;

    console.log(`[Cartesia] Transcription complete (${data.language || languageCode || 'detected'}) in ${processingTime}ms`);
    console.log(`[Cartesia] Word timestamps: ${wordCount} words`);

    // Normalize word structure to match ElevenLabs format (text field)
    const normalizedWords = (data.words || []).map((w: any) => ({
      text: w.word,  // Cartesia uses "word", normalize to "text"
      start: w.start,
      end: w.end,
    }));

    return {
      text: data.text || '',
      language: data.language || languageCode || 'unknown',
      words: normalizedWords,
      duration: data.duration || 0,
    };
  }
}
