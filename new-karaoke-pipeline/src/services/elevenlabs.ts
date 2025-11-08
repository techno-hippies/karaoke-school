/**
 * ElevenLabs Service
 * Forced Alignment API for word-level + character-level karaoke timestamps
 *
 * API Docs: https://elevenlabs.io/docs/api-reference/forced-alignment
 */

// OpenAPI-compliant types from ElevenLabs API
export interface ElevenLabsCharacter {
  text: string;
  start: number;  // seconds (double)
  end: number;    // seconds (double)
}

export interface ElevenLabsWord {
  text: string;
  start: number;  // seconds (double)
  end: number;    // seconds (double)
  loss: number;   // alignment quality score (lower = better)
}

export interface ElevenLabsAlignmentResponse {
  characters: ElevenLabsCharacter[];
  words: ElevenLabsWord[];
  loss: number;  // overall alignment quality
}

export interface ElevenLabsAlignmentResult {
  words: ElevenLabsWord[];
  totalWords: number;
  characters: ElevenLabsCharacter[];
  totalCharacters: number;
  overallLoss: number;
  alignmentDurationMs: number;
  rawResponse: ElevenLabsAlignmentResponse;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Forced alignment: Align known lyrics to audio
   * Returns word-level + character-level timestamps for the entire song
   *
   * @param audioUrl URL to audio file (mp3, wav, etc.) - can be Grove/IPFS URL
   * @param lyricsText Plain text lyrics (no timestamps)
   * @returns Alignment result with word and character-level timestamps
   */
  async forcedAlignment(
    audioUrl: string,
    lyricsText: string
  ): Promise<ElevenLabsAlignmentResult> {
    // Validate inputs
    if (!lyricsText || lyricsText.trim().length === 0) {
      throw new Error('Cannot align: lyrics text is empty');
    }

    console.log(`[ElevenLabs] Downloading audio from: ${audioUrl}`);

    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(
        `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`
      );
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioSizeMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(2);

    console.log(`[ElevenLabs] Running forced alignment (audio: ${audioSizeMB} MB, lyrics: ${lyricsText.length} chars)`);

    // Build multipart/form-data request
    const boundary = '----ElevenLabsBoundary' + Math.random().toString(36);
    const textEncoder = new TextEncoder();

    const bodyParts: Uint8Array[] = [];

    // Part 1: Audio file
    bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
    bodyParts.push(
      textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n')
    );
    bodyParts.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
    bodyParts.push(new Uint8Array(audioBuffer));
    bodyParts.push(textEncoder.encode('\r\n'));

    // Part 2: Lyrics text
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

    // Call ElevenLabs API
    const startTime = Date.now();
    const response = await fetch(`${this.baseUrl}/forced-alignment`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: combinedBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs API error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as ElevenLabsAlignmentResponse;
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Calculate duration from words (last word's end time)
    const lastWord = data.words[data.words.length - 1];
    const alignmentDurationMs = lastWord ? Math.round(lastWord.end * 1000) : 0;

    console.log(
      `[ElevenLabs] Alignment complete (${processingTime}s): ` +
      `${data.words.length} words, ${data.characters.length} characters, ` +
      `loss: ${data.loss.toFixed(3)}, duration: ${(alignmentDurationMs / 1000).toFixed(1)}s`
    );

    return {
      words: data.words,
      totalWords: data.words.length,
      characters: data.characters,
      totalCharacters: data.characters.length,
      overallLoss: data.loss,
      alignmentDurationMs,
      rawResponse: data,
    };
  }

  /**
   * Convenience method: Align from Grove/IPFS URL
   * Same as forcedAlignment but with explicit method name
   *
   * @param groveUrl Grove/IPFS URL to audio file
   * @param plainLyrics Plain text lyrics from LRCLIB/lyrics.ovh
   * @returns Word-level + character-level alignment data
   */
  async alignFromGrove(
    groveUrl: string,
    plainLyrics: string
  ): Promise<ElevenLabsAlignmentResult> {
    return this.forcedAlignment(groveUrl, plainLyrics);
  }
}
