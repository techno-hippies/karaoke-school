/**
 * Song types from KaraokeCatalogV2 contract
 */

export interface Song {
  id: string // geniusId as string for consistency
  geniusId: number
  geniusArtistId?: number
  title: string
  artist: string
  artworkUrl?: string
  metadataUri?: string
  alignmentUri?: string
  sectionsUri?: string
  soundcloudPermalink?: string
  hasBaseAlignment?: boolean
  segments?: SongSegment[]
}

export interface SongSegment {
  id: string // e.g., "chorus-0"
  displayName: string // e.g., "Chorus"
  startTime: number
  endTime: number
  duration: number
}

/**
 * Segment metadata with aligned lyrics
 */
export interface SegmentMetadata {
  id: string
  type: string
  startTime: number
  endTime: number
  duration: number
  lines: LyricLine[]
}

export interface LyricLine {
  text: string
  startTime: number
  endTime: number
  duration: number
  words?: LyricWord[]
}

export interface LyricWord {
  word: string
  startTime: number
  endTime: number
}
