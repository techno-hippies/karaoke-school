/**
 * Core Types for Song Uploader V2
 * For uploading copyright-free songs to KaraokeCatalogV2 on Base Sepolia
 */

// ============ INPUT TYPES ============

/**
 * Song configuration from metadata.json
 */
export interface SongConfig {
  id: string                    // Slug: "heat-of-the-night-scarlett-x"
  title: string                 // Song title
  artist: string                // Artist name
  geniusId?: number             // Optional: Pre-existing Genius ID
  soundcloudUrl?: string        // Optional: SoundCloud URL for discovery
  youtubeUrl?: string           // Optional: YouTube URL
  spotifyUrl?: string           // Optional: Spotify URL
  segmentIds?: string[]         // Optional: Manual segment IDs override
}

/**
 * Song files loaded from disk
 */
export interface SongFiles {
  fullAudio: File               // Full song MP3/WAV for playback
  vocalsOnly?: File             // Isolated vocals for ElevenLabs (optional, improves accuracy)
  lyrics: File                  // lyrics.txt (required)
  thumbnail?: File              // thumbnail.jpg (optional)
  translations: Record<string, File>  // { "zh": File, "vi": File }
}

// ============ PROCESSING TYPES ============

/**
 * Word-level timestamp from ElevenLabs
 */
export interface WordTimestamp {
  text: string
  start: number
  end: number
}

/**
 * Line with word timestamps
 */
export interface LineWithWords {
  lineIndex: number
  text: string  // Changed from originalText to match frontend expectation
  translations?: Record<string, string>
  start: number
  end: number
  words: WordTimestamp[]
}

/**
 * Song section (verse, chorus, etc.)
 */
export interface SongSection {
  id: string                    // "verse-1", "chorus-1"
  type: string                  // "Verse 1", "Chorus"
  startTime: number             // Seconds
  endTime: number               // Seconds
  duration: number              // Seconds
  lyricsStart: number           // Line index in lyrics
  lyricsEnd: number             // Line index in lyrics
}

/**
 * Sections data for Grove upload
 */
export interface SectionsData {
  sections: Array<{
    id: string
    type: string
    startTime: number
    endTime: number
    duration: number
  }>
  generatedAt: string
}

/**
 * Alignment data for Grove upload (word-level karaoke)
 */
export interface AlignmentData {
  version: 2
  title: string
  artist: string
  duration: number
  format: "word-and-line-timestamps"
  lines: LineWithWords[]
  availableLanguages: string[]
  generatedAt: string
  elevenLabsProcessed: true
  wordCount: number
  lineCount: number
}

// ============ UPLOAD TYPES ============

/**
 * Grove upload result
 */
export interface GroveUploadResult {
  uri: string                   // grove://Qm...
  gatewayUrl: string            // https://api.grove.storage/Qm...
  storageKey: string            // Qm...
}

/**
 * Stem separation result
 */
export interface StemFiles {
  vocals: File
  drums: File
  bass: File
  other: File
}

/**
 * Segment with stems ready for upload
 */
export interface ProcessedSegment {
  section: SongSection
  vocalsUri: string             // grove://... (vocals stem)
  drumsUri: string              // grove://... (drums stem)
  audioSnippetUri: string       // grove://... (30s preview)
}

// ============ API RESPONSE TYPES ============

/**
 * Genius API song upload response
 */
export interface GeniusUploadResponse {
  success: boolean
  geniusId?: number
  url?: string
  error?: string
}

/**
 * ElevenLabs alignment API response
 */
export interface ElevenLabsAlignmentResponse {
  words: WordTimestamp[]
  audioHash: string
  lyricsHash: string
}

/**
 * OpenRouter section parsing response
 */
export interface SectionParseResponse {
  sections: Array<{
    type: string              // "Verse 1", "Chorus", "Bridge"
    startLine: number         // Line index (from OpenRouter)
    endLine: number           // Line index (from OpenRouter)
  }>
}

// ============ CONTRACT TYPES ============

/**
 * Parameters for KaraokeCatalogV2.addFullSong()
 */
export interface AddFullSongParams {
  id: string
  geniusId: number
  title: string
  artist: string
  duration: number
  soundcloudPath: string
  hasFullAudio: true
  requiresPayment: false
  audioUri: string
  metadataUri: string           // DEPRECATED (leave empty)
  coverUri: string
  thumbnailUri: string
  musicVideoUri: string
  sectionsUri: string           // grove://sections.json
  alignmentUri: string          // grove://alignment.json
}

/**
 * Parameters for KaraokeCatalogV2.processSegmentsBatch()
 */
export interface ProcessSegmentsBatchParams {
  geniusId: number
  songId: string
  segmentIds: string[]
  sectionTypes: string[]
  vocalsUris: string[]
  drumsUris: string[]
  audioSnippetUris: string[]
  startTimes: number[]
  endTimes: number[]
}

// ============ RESULT TYPES ============

/**
 * Final upload result
 */
export interface SongUploadResult {
  success: boolean
  songId: string
  geniusId: number
  txHash?: string
  error?: string
  groveUris: {
    audio: string
    sections: string
    alignment: string
    thumbnail?: string
    cover?: string
  }
  segmentCount: number
}
