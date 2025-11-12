/**
 * Forced Alignment Lookup Service
 * Extracts word-level timestamps from pre-existing ElevenLabs FA data
 *
 * Flow:
 * 1. Query elevenlabs_word_alignments for full song
 * 2. Use line indices from LyricsMatcher to extract relevant words
 * 3. Return segments with perfect word-level timing
 *
 * This avoids expensive re-alignment and leverages existing FA data.
 */

import { query } from '../db/connection';

/**
 * Word with timing (karaoke/STT-compatible format)
 */
export interface WordWithTiming {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

/**
 * Segment with word-level timing (karaoke/STT-compatible format)
 */
export interface SegmentWithTiming {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
  words: WordWithTiming[];
}

/**
 * ElevenLabs FA data structure (from database)
 */
interface ElevenLabsWord {
  text: string;
  start: number;  // seconds (not ms in this schema)
  end: number;    // seconds (not ms in this schema)
  loss?: number;  // confidence metric
}

/**
 * Forced Alignment Lookup Service
 */
export class FALookupService {
  /**
   * Extract word timestamps for specific line range
   *
   * @param spotifyTrackId - Track ID to query FA data
   * @param startLineIndex - Starting line index (0-based)
   * @param endLineIndex - Ending line index (0-based, inclusive)
   * @returns Segments with word-level timing suitable for Lens/app metadata
   */
  async extractWordsForLines(
    spotifyTrackId: string,
    startLineIndex: number,
    endLineIndex: number
  ): Promise<SegmentWithTiming[]> {
    console.log(`[FALookup] Extracting words for track ${spotifyTrackId}, lines ${startLineIndex}-${endLineIndex}...`);

    // 1. Query elevenlabs_word_alignments table (only words, no lines column)
    const rows = await query<{ words: any }>(
      `SELECT words
       FROM elevenlabs_word_alignments
       WHERE spotify_track_id = $1`,
      [spotifyTrackId]
    );

    if (rows.length === 0) {
      throw new Error(`No forced alignment data found for track ${spotifyTrackId}`);
    }

    const allWords: ElevenLabsWord[] = rows[0].words;

    if (!allWords || allWords.length === 0) {
      throw new Error(`Empty words array for track ${spotifyTrackId}`);
    }

    console.log(`[FALookup] Found ${allWords.length} words`);

    // 2. Get normalized lyrics to reconstruct line boundaries
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
    const lyricsLines = fullLyrics.split('\n').filter(line => line.trim().length > 0);

    console.log(`[FALookup] Lyrics has ${lyricsLines.length} lines`);

    if (startLineIndex >= lyricsLines.length || endLineIndex >= lyricsLines.length) {
      throw new Error(`Line indices out of bounds: ${startLineIndex}-${endLineIndex} (max: ${lyricsLines.length - 1})`);
    }

    // 3. Extract words for the specified lines by matching text
    // Strategy: Match lyrics line text to word sequence in FA data
    let segments: SegmentWithTiming[] = [];

    for (let lineIdx = startLineIndex; lineIdx <= endLineIndex; lineIdx++) {
      const lineText = lyricsLines[lineIdx];

      // Normalize line text for matching (remove punctuation, lowercase)
      const normalizedLine = lineText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const lineTokens = normalizedLine.split(' ').filter(t => t.length > 0);

      if (lineTokens.length === 0) {
        console.warn(`[FALookup] Empty line ${lineIdx}, skipping`);
        continue;
      }

      // Find matching word sequence in FA data
      let matchedWords: ElevenLabsWord[] = [];

      // Simple greedy matching: find first occurrence of token sequence
      for (let i = 0; i < allWords.length - lineTokens.length + 1; i++) {
        let match = true;
        const candidateWords: ElevenLabsWord[] = [];

        let tokenIdx = 0;
        let wordIdx = i;

        while (tokenIdx < lineTokens.length && wordIdx < allWords.length) {
          const word = allWords[wordIdx];
          const wordNorm = word.text?.toLowerCase().replace(/[^\w\s]/g, '').trim();

          if (wordNorm === lineTokens[tokenIdx]) {
            candidateWords.push(word);
            tokenIdx++;
            wordIdx++;
          } else if (wordNorm === '' || wordNorm === '\n') {
            // Skip whitespace/newlines
            wordIdx++;
          } else {
            // Mismatch
            match = false;
            break;
          }
        }

        if (match && tokenIdx === lineTokens.length) {
          matchedWords = candidateWords;
          break;
        }
      }

      if (matchedWords.length === 0) {
        console.warn(`[FALookup] Could not match line ${lineIdx}: "${lineText}"`);
        continue;
      }

      // Convert to metadata-friendly format (already in seconds in elevenlabs schema)
      const wordsInSeconds: WordWithTiming[] = matchedWords.map(w => ({
        word: w.text || '',
        start: w.start || 0,
        end: w.end || 0,
      }));

      segments.push({
        text: lineText,
        start: wordsInSeconds[0].start,
        end: wordsInSeconds[wordsInSeconds.length - 1].end,
        words: wordsInSeconds,
      });
    }

    // Normalize timestamps to be relative to clip start (0-based)
    // TikTok clips are short excerpts from full songs, so we need to adjust timestamps
    if (segments.length > 0) {
      const minStart = Math.min(...segments.map(s => s.start));

      segments = segments.map(seg => ({
        ...seg,
        start: seg.start - minStart,
        end: seg.end - minStart,
        words: seg.words.map(w => ({
          ...w,
          start: w.start - minStart,
          end: w.end - minStart,
        })),
      }));

      console.log(`[FALookup] ✓ Normalized timestamps (offset: -${minStart.toFixed(3)}s)`);
    }

    console.log(`[FALookup] ✓ Extracted ${segments.length} segments with ${segments.reduce((acc, seg) => acc + seg.words.length, 0)} words`);

    return segments;
  }

  /**
   * Check if FA data exists for a track
   */
  async hasAlignmentData(spotifyTrackId: string): Promise<boolean> {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM elevenlabs_word_alignments
       WHERE spotify_track_id = $1`,
      [spotifyTrackId]
    );

    return rows[0].count > 0;
  }
}

/**
 * Factory function to create FA lookup service
 */
export function createFALookupService(): FALookupService {
  return new FALookupService();
}
