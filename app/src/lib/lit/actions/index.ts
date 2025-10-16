/**
 * Lit Actions
 * High-level functions for executing Lit Actions with automatic auth handling
 */

// Re-export all types
export type {
  SearchResult,
  SearchResponse,
  SongMetadataResult,
  ArtistMetadataResult,
  MatchSegmentResult,
  AudioProcessorResult,
  BaseAlignmentResult,
  TranslateResult,
} from './types'

// Re-export all action executors
export { executeSearch } from './search'
export { executeSongMetadata } from './song-metadata'
export { executeArtistMetadata } from './artist-metadata'
export { executeMatchAndSegment } from './match-and-segment'
export { executeAudioProcessor } from './audio-processor'
export { executeBaseAlignment } from './base-alignment'
export { executeTranslate } from './translate'

// Re-export utilities
export { formatSection, generateSegmentId } from './utils'
