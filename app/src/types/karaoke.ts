/**
 * Karaoke types for synchronized lyrics display
 */

// Word-level timestamp for karaoke highlighting
export interface WordTimestamp {
  text: string
  start: number
  end: number
}

// Line-level lyric with optional word-level timing and translations
export interface LyricLine {
  lineIndex: number
  originalText: string
  translations?: Record<string, string>
  start: number
  end: number
  sectionMarker?: boolean
  words?: WordTimestamp[]
}

// Processed word with timing state
export interface ProcessedWord extends WordTimestamp {
  state: 'active' | 'past' | 'future'
  isActive: boolean
  isPast: boolean
  isFuture: boolean
}
