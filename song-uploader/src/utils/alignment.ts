/**
 * Alignment utilities
 * Convert word timestamps to line-based structure
 */

import type { WordTimestamp, LineWithWords } from '../types.js'

/**
 * Build lines with word-level timestamps
 * Groups flat word array into lines based on lyrics structure
 */
export function buildLinesWithWords(
  words: WordTimestamp[],
  lyricsLines: string[],
  translations: Record<string, string[]> = {}
): LineWithWords[] {
  const lines: LineWithWords[] = []

  let wordIndex = 0

  for (let lineIndex = 0; lineIndex < lyricsLines.length; lineIndex++) {
    const lineText = lyricsLines[lineIndex]
    const lineWords: WordTimestamp[] = []

    // Match words to this line
    const lineWordCount = lineText.split(/\s+/).filter(w => w.trim()).length

    for (let i = 0; i < lineWordCount && wordIndex < words.length; i++) {
      lineWords.push(words[wordIndex])
      wordIndex++
    }

    if (lineWords.length === 0) {
      continue // Skip lines with no words
    }

    const lineStart = lineWords[0].start
    const lineEnd = lineWords[lineWords.length - 1].end

    // Build translations object for this line
    const lineTranslations: Record<string, string> = {}
    for (const [langCode, translationLines] of Object.entries(translations)) {
      if (translationLines[lineIndex]) {
        lineTranslations[langCode] = translationLines[lineIndex]
      }
    }

    lines.push({
      lineIndex,
      text: lineText,  // Changed from originalText to match hook expectation
      translations: Object.keys(lineTranslations).length > 0 ? lineTranslations : undefined,
      start: lineStart,
      end: lineEnd,
      words: lineWords,
    })
  }

  return lines
}
