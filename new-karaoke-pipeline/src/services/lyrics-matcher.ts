/**
 * Lyrics Matcher Service
 * Uses Gemini Flash 2.5 Lite to match STT transcripts to full song lyrics
 *
 * Flow:
 * 1. Receive STT transcript (from Voxtral)
 * 2. Query song_lyrics table for full normalized lyrics
 * 3. Use Gemini to fuzzy-match transcript to specific lines
 * 4. Return line indices for FA lookup
 *
 * This allows imperfect STT to be mapped to perfect pre-aligned timestamps.
 */

import { OpenRouterService } from './openrouter';
import { query } from '../db/connection';

/**
 * Lyrics match result
 */
export interface LyricsMatchResult {
  startLineIndex: number;  // 0-based line index in normalized_lyrics
  endLineIndex: number;    // 0-based line index in normalized_lyrics
  matchedText: string;     // Exact lyrics from song
  confidence: number;      // 0-1 confidence score
}

/**
 * Lyrics Matcher Service
 */
export class LyricsMatcherService {
  private openRouter: OpenRouterService;

  constructor(apiKey: string) {
    this.openRouter = new OpenRouterService(apiKey);
  }

  /**
   * Match STT transcript to song lyrics
   *
   * @param transcript - Raw transcript from Voxtral (may have errors)
   * @param spotifyTrackId - Spotify track ID to query lyrics
   * @returns Line indices and matched text for FA lookup
   */
  async matchTranscriptToLyrics(
    transcript: string,
    spotifyTrackId: string
  ): Promise<LyricsMatchResult> {
    console.log(`[LyricsMatcher] Matching transcript to song ${spotifyTrackId}...`);
    console.log(`[LyricsMatcher] Transcript: "${transcript}"`);

    // 1. Get full song lyrics from database
    const lyricsRows = await query<{ normalized_lyrics: string; plain_lyrics: string }>(
      `SELECT normalized_lyrics, plain_lyrics
       FROM song_lyrics
       WHERE spotify_track_id = $1`,
      [spotifyTrackId]
    );

    if (lyricsRows.length === 0) {
      throw new Error(`No lyrics found for track ${spotifyTrackId}`);
    }

    const fullLyrics = lyricsRows[0].normalized_lyrics || lyricsRows[0].plain_lyrics;
    if (!fullLyrics) {
      throw new Error(`Empty lyrics for track ${spotifyTrackId}`);
    }

    // Split into lines for line indexing
    const lyricsLines = fullLyrics.split('\n').filter(line => line.trim().length > 0);

    console.log(`[LyricsMatcher] Full lyrics has ${lyricsLines.length} lines`);

    // 2. Use Gemini Flash to fuzzy-match transcript to lyrics
    const systemPrompt = `You are a lyrics matching assistant. Your task is to match a short audio transcript to the correct lines in a full song's lyrics.

The transcript may have minor transcription errors (wrong words, spelling mistakes) but should be close to the actual lyrics.

Return JSON with:
- start_line: 0-based line index where match starts
- end_line: 0-based line index where match ends (inclusive)
- matched_text: exact lyrics from the song (not the transcript)
- confidence: 0-1 score (1 = perfect match, 0.5 = fuzzy match)

Be forgiving with minor transcription errors. Focus on semantic meaning and word overlap.`;

    const userPrompt = `Full song lyrics (line by line):
${lyricsLines.map((line, idx) => `${idx}: ${line}`).join('\n')}

Transcript from audio clip:
"${transcript}"

Which lines match this transcript? Return JSON only.`;

    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'lyrics_match',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            start_line: {
              type: 'integer',
              description: '0-based line index where match starts',
            },
            end_line: {
              type: 'integer',
              description: '0-based line index where match ends (inclusive)',
            },
            matched_text: {
              type: 'string',
              description: 'Exact lyrics from the song that match',
            },
            confidence: {
              type: 'number',
              description: 'Match confidence 0-1',
            },
          },
          required: ['start_line', 'end_line', 'matched_text', 'confidence'],
          additionalProperties: false,
        },
      },
    };

    const geminiResponse = await this.openRouter.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      responseFormat
    );

    const result = JSON.parse(geminiResponse.choices[0].message.content);

    console.log(`[LyricsMatcher] ✓ Match found: lines ${result.start_line}-${result.end_line} (confidence: ${result.confidence})`);
    console.log(`[LyricsMatcher] Matched text: "${result.matched_text}"`);

    return {
      startLineIndex: result.start_line,
      endLineIndex: result.end_line,
      matchedText: result.matched_text,
      confidence: result.confidence,
    };
  }
}

/**
 * Factory function to create LyricsMatcher from environment
 */
export function createLyricsMatcherService(): LyricsMatcherService {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable not set');
  }
  return new LyricsMatcherService(apiKey);
}
