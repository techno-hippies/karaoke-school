import { useMemo } from 'react';

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

export interface ProcessedWord extends WordTimestamp {
  state: 'active' | 'past' | 'future';
  isActive: boolean;
  isPast: boolean;
  isFuture: boolean;
}

/**
 * Pure logic hook for processing karaoke word timing states
 * No display logic - just calculates timing state for each word
 */
export function useKaraokeWords(
  words: WordTimestamp[],
  currentTime: number
): ProcessedWord[] {
  return useMemo(() => {
    return words.map(word => {
      const isActive = currentTime >= word.start && currentTime <= word.end;
      const isPast = currentTime > word.end;
      const isFuture = currentTime < word.start;

      return {
        ...word,
        state: isActive ? 'active' : isPast ? 'past' : 'future',
        isActive,
        isPast,
        isFuture
      };
    });
  }, [words, currentTime]);
}

/**
 * Utility function to filter words within a time range
 * Used for segment selection precision
 */
export function filterWordsInRange(
  words: WordTimestamp[],
  start: number,
  end: number
): WordTimestamp[] {
  return words.filter(word =>
    word.start >= start && word.end <= end
  );
}

/**
 * Utility function to group words by lines based on line metadata
 * Useful for organizing words back into line structure
 */
export function groupWordsByLines(
  words: ProcessedWord[],
  lineTimestamps: Array<{ start: number; end: number; lineIndex: number }>
): Array<{ lineIndex: number; words: ProcessedWord[] }> {
  const lines: Array<{ lineIndex: number; words: ProcessedWord[] }> = [];

  lineTimestamps.forEach(line => {
    const lineWords = words.filter(word =>
      word.start >= line.start && word.end <= line.end
    );

    if (lineWords.length > 0) {
      lines.push({
        lineIndex: line.lineIndex,
        words: lineWords
      });
    }
  });

  return lines;
}