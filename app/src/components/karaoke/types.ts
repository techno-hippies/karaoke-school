/**
 * Karaoke Types
 */

export interface KaraokeWord {
  text: string
  start: number
  end: number
}

export interface LyricLine {
  lineIndex?: number
  originalText: string
  translations?: Record<string, string>
  start: number
  end: number
  words?: KaraokeWord[]
  sectionMarker?: boolean
}
