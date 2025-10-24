/**
 * Segment Lyrics Helpers
 *
 * Functions for processing LRCLib lines and ElevenLabs words
 * into segment-relative timing structures
 */

import type { SegmentLyrics, SyncedLine, SyncedWord } from './schemas/segment-v2.js';

/**
 * Extract line TEXT from LRCLib synced lyrics (ignore timestamps completely)
 *
 * LRCLib format: "[MM:SS.xx]Line text here"
 * Example: "[02:24.17]The family gathers 'round and reads it"
 *
 * IMPORTANT: LRCLib timestamps are rough and unreliable - we only use the text
 */
export function extractLRCLibLineTexts(syncedLyrics: string): string[] {
  const lines = syncedLyrics.split('\n').filter((line) => line.trim());
  const lineTexts: string[] = [];

  for (const line of lines) {
    // Match format: [MM:SS.xx]text or [M:SS.xx]text
    const match = line.match(/\[(\d+):(\d+\.\d+)\](.+)/);
    if (match) {
      const text = match[3].trim();

      // Skip empty lines (instrumental breaks, etc.)
      if (text.length === 0) {
        continue;
      }

      lineTexts.push(text);
    }
  }

  return lineTexts;
}

/**
 * Round to 2 decimal places (centisecond precision)
 * Uses Number.EPSILON to avoid floating-point errors
 */
function roundTime(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Build complete SegmentLyrics from LRCLib and ElevenLabs data
 * Words are nested inside each line
 *
 * Strategy:
 * - LRCLib provides line TEXT only (timestamps completely ignored)
 * - Gemini provides word indices (startIdx, endIdx) for the segment
 * - Extract segment words from fullAlignment[startIdx:endIdx]
 * - Group words by newline markers
 * - Match word groups to LRCLib line texts
 * - Line timing comes from first/last word in each group
 *
 * @param lrcLibSyncedLyrics Full song synced lyrics from LRCLib (text only)
 * @param fullAlignment Full song word alignment from ElevenLabs (ALL words)
 * @param startIdx Start word index from Gemini match
 * @param endIdx End word index from Gemini match
 * @returns Complete SegmentLyrics with lines containing nested words
 */
export function buildSegmentLyrics(
  lrcLibSyncedLyrics: string,
  fullAlignment: Array<{ start: number; end: number; text: string }>,
  startIdx: number,
  endIdx: number
): SegmentLyrics {
  // Extract ALL line texts from LRCLib (full song, ignore timestamps)
  const allLineTexts = extractLRCLibLineTexts(lrcLibSyncedLyrics);

  // Extract segment words using Gemini's word indices
  const segmentWords = fullAlignment.slice(startIdx, endIdx + 1);

  if (segmentWords.length === 0) {
    throw new Error('No words found in segment range');
  }

  // Get segment start time from first word
  const segmentStartTime = segmentWords[0].start;

  // Convert all words to segment-relative timing (including newlines/spaces for grouping)
  const allRelativeWords = segmentWords.map((word) => ({
    start: roundTime(word.start - segmentStartTime),
    end: roundTime(word.end - segmentStartTime),
    text: word.text,
  }));

  // Group words by newline markers
  // Keep ALL words including spaces (they have timing info)
  const wordGroups: Array<typeof allRelativeWords> = [];
  let currentGroup: typeof allRelativeWords = [];

  for (const word of allRelativeWords) {
    if (word.text === '\n' || word.text.trim() === '\n') {
      // Newline marks end of line
      if (currentGroup.length > 0) {
        wordGroups.push(currentGroup);
        currentGroup = [];
      }
    } else {
      // Add ALL words including spaces (they have timing)
      currentGroup.push(word);
    }
  }

  // Add final group if exists
  if (currentGroup.length > 0) {
    wordGroups.push(currentGroup);
  }

  // Build lines with nested words
  const lines: SyncedLine[] = [];

  for (const wordGroup of wordGroups) {
    // Get line timing from first/last word
    const lineStart = wordGroup[0].start;
    const lineEnd = wordGroup[wordGroup.length - 1].end;

    // Reconstruct line text from words (add spaces between words)
    const lineText = wordGroup.map(w => w.text).join(' ');

    // Words keep segment-relative timing (same as line timing)
    // This makes it easier to sync with MP3 playback
    const lineWords = wordGroup.map((word) => ({
      start: roundTime(word.start),
      end: roundTime(word.end),
      text: word.text,
    }));

    lines.push({
      start: roundTime(lineStart),
      end: roundTime(lineEnd),
      text: lineText,
      words: lineWords,
    });
  }

  // Create plain text from lines
  const plain = lines.map(line => line.text).join('\n');

  return {
    plain,
    lines,
  };
}

/**
 * Translate segment lyrics (used by frontend/backend)
 *
 * Translates plain text and reconstructs timing from original
 * Words are nested inside each line
 *
 * @param sourceLyrics Original language lyrics (with timing)
 * @param translatedPlain Translated plain text (preserving line breaks)
 * @returns Translated lyrics with approximate timing
 */
export function buildTranslatedLyrics(
  sourceLyrics: SegmentLyrics,
  translatedPlain: string
): SegmentLyrics {
  // Split translated text by lines (assume translation preserves line structure)
  const translatedLineTexts = translatedPlain.split('\n');

  // Build lines with nested words
  const lines: SyncedLine[] = sourceLyrics.lines.map((sourceLine, lineIdx) => {
    const translatedText = translatedLineTexts[lineIdx] || sourceLine.text;

    // Split translated line into words (filter out spaces/empty)
    const translatedWords = translatedText.split(/\s+/).filter(w => w.length > 0);

    // Get line duration from source
    const sourceLineStart = sourceLine.start;
    const sourceLineEnd = sourceLine.end;
    const lineDuration = sourceLineEnd - sourceLineStart;

    // Distribute translated words evenly across line duration
    const wordDuration = lineDuration / translatedWords.length;

    const words: SyncedWord[] = translatedWords.map((text, wordIdx) => ({
      start: roundTime(sourceLineStart + wordIdx * wordDuration), // Segment-relative
      end: roundTime(sourceLineStart + (wordIdx + 1) * wordDuration), // Segment-relative
      text,
    }));

    return {
      start: sourceLine.start, // Keep original line timing (already rounded)
      end: sourceLine.end,
      text: translatedText,
      words,
    };
  });

  return {
    plain: translatedPlain,
    lines,
  };
}
