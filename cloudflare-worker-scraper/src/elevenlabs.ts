/**
 * ElevenLabs Service
 * Forced Alignment API for word-level karaoke timestamps
 */

export interface ElevenLabsWord {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
  type?: string;
}

export interface ElevenLabsAlignmentResult {
  words: ElevenLabsWord[];
  alignment: any;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.model = 'scribe_v1';
  }

  /**
   * Forced alignment: Align known lyrics to audio
   * Returns word-level timestamps for the entire song
   *
   * @param audioUrl URL to audio file to download
   * @param lyricsText Plain text lyrics (no timestamps)
   * @returns Alignment result with word-level timestamps
   */
  async forcedAlignment(
    audioUrl: string,
    lyricsText: string
  ): Promise<ElevenLabsAlignmentResult> {
    console.log(`ElevenLabs: Downloading audio from ${audioUrl}`);

    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();

    console.log(`ElevenLabs: Running forced alignment (${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

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
      throw new Error(`ElevenLabs forced alignment error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log(`ElevenLabs: Forced alignment complete - ${data.words?.length || 0} words aligned`);

    return {
      words: data.words || [],
      alignment: data.alignment || data,
    };
  }

  /**
   * Align lyrics from LRCLIB to audio from Grove/freyr
   * Stores result in elevenlabs_word_alignments table
   *
   * @param groveUrl URL to audio file on Grove IPFS
   * @param plainLyrics Plain text lyrics from LRCLIB
   * @returns Word-level alignment data
   */
  async alignFromGrove(
    groveUrl: string,
    plainLyrics: string
  ): Promise<ElevenLabsAlignmentResult> {
    if (!plainLyrics || plainLyrics.trim().length === 0) {
      throw new Error('Cannot align: lyrics are empty');
    }

    return await this.forcedAlignment(groveUrl, plainLyrics);
  }
}
