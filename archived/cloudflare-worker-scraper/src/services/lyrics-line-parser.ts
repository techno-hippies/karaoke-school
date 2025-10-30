/**
 * Lyrics Line Parser Service
 * Parses ElevenLabs flat word array into line-level structures
 */

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
  loss?: number;
}

export interface LyricLine {
  lineIndex: number;
  originalText: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

/**
 * Parse ElevenLabs word array into line-level structure
 * Groups words by newline characters (\n) and section markers ([00:28.57])
 */
export function parseWordsIntoLines(words: WordTimestamp[]): LyricLine[] {
  const lines: LyricLine[] = [];
  let currentLineWords: WordTimestamp[] = [];
  let lineIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Skip timestamp markers like [00:28.57]
    if (word.text.match(/^\[\d{2}:\d{2}\.\d{2}\]$/)) {
      continue;
    }

    // Check if this is a newline character
    if (word.text === '\n') {
      // Flush current line if it has words
      if (currentLineWords.length > 0) {
        lines.push(createLine(lineIndex, currentLineWords));
        lineIndex++;
        currentLineWords = [];
      }
      continue;
    }

    // Add word to current line
    currentLineWords.push(word);
  }

  // Flush remaining words as final line
  if (currentLineWords.length > 0) {
    lines.push(createLine(lineIndex, currentLineWords));
  }

  return lines;
}

/**
 * Create a line object from words
 */
function createLine(lineIndex: number, words: WordTimestamp[]): LyricLine {
  // Calculate line start/end from first and last word
  const start = words[0].start;
  const end = words[words.length - 1].end;

  // Concatenate text (trim leading/trailing spaces)
  const originalText = words
    .map((w) => w.text)
    .join('')
    .trim();

  // Filter out space-only words for cleaner word timing array
  const cleanWords = words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({
      text: w.text.trim(),
      start: w.start,
      end: w.end,
    }));

  return {
    lineIndex,
    originalText,
    start,
    end,
    words: cleanWords,
  };
}

/**
 * Validate line structure (for debugging)
 */
export function validateLines(lines: LyricLine[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for empty lines
  const emptyLines = lines.filter((l) => !l.originalText.trim());
  if (emptyLines.length > 0) {
    issues.push(`Found ${emptyLines.length} empty lines`);
  }

  // Check for timing inconsistencies
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    if (current.end > next.start) {
      issues.push(
        `Line ${i} overlaps with line ${i + 1} (${current.end} > ${next.start})`
      );
    }

    if (current.start >= current.end) {
      issues.push(`Line ${i} has invalid timing (start >= end)`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
