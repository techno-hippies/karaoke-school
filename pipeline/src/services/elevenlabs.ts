/**
 * ElevenLabs Service
 * Forced Alignment API for word-level + character-level karaoke timestamps
 *
 * API Docs: https://elevenlabs.io/docs/api-reference/forced-alignment
 */

import { ELEVENLABS_API_KEY } from '../config';

export interface ElevenLabsCharacter {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

export interface ElevenLabsWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
  loss: number; // alignment quality score (lower = better)
}

export interface ElevenLabsAlignmentResponse {
  characters: ElevenLabsCharacter[];
  words: ElevenLabsWord[];
  loss: number; // overall alignment quality
}

export interface ElevenLabsAlignmentResult {
  words: ElevenLabsWord[];
  totalWords: number;
  characters: ElevenLabsCharacter[];
  totalCharacters: number;
  overallLoss: number;
  alignmentDurationMs: number;
}

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Forced alignment: Align known lyrics to audio
 * Returns word-level + character-level timestamps
 *
 * @param audioUrl URL to audio file (mp3, wav, etc.)
 * @param lyricsText Plain text lyrics (no timestamps)
 * @returns Alignment result with word and character-level timestamps
 */
export async function forcedAlignment(
  audioUrl: string,
  lyricsText: string
): Promise<ElevenLabsAlignmentResult> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  if (!lyricsText || lyricsText.trim().length === 0) {
    throw new Error('Cannot align: lyrics text is empty');
  }

  console.log('   Downloading audio...');

  // Download audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioSizeMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(2);

  console.log(`   Running forced alignment (${audioSizeMB} MB audio, ${lyricsText.length} chars)...`);

  // Build multipart/form-data request
  const boundary = '----ElevenLabsBoundary' + Math.random().toString(36);
  const textEncoder = new TextEncoder();

  const bodyParts: Uint8Array[] = [];

  // Part 1: Audio file
  bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
  bodyParts.push(textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
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
  const response = await fetch(`${ELEVENLABS_API_URL}/forced-alignment`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: combinedBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ElevenLabsAlignmentResponse;
  const processingTime = (Date.now() - startTime) / 1000;

  // Calculate duration from words (last word's end time)
  const lastWord = data.words[data.words.length - 1];
  const alignmentDurationMs = lastWord ? Math.round(lastWord.end * 1000) : 0;

  console.log(
    `   ✅ Alignment complete in ${processingTime.toFixed(1)}s: ` +
      `${data.words.length} words, ${data.characters.length} chars, ` +
      `loss: ${data.loss.toFixed(3)}`
  );

  return {
    words: data.words,
    totalWords: data.words.length,
    characters: data.characters,
    totalCharacters: data.characters.length,
    overallLoss: data.loss,
    alignmentDurationMs,
  };
}

/**
 * Calculate line start/end times from word timings
 */
export function calculateLineTimes(
  words: ElevenLabsWord[]
): { start_ms: number; end_ms: number } | null {
  if (words.length === 0) {
    return null;
  }

  return {
    start_ms: Math.round(words[0].start * 1000),
    end_ms: Math.round(words[words.length - 1].end * 1000),
  };
}
