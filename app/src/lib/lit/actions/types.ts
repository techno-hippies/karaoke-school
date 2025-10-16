/**
 * Type definitions for Lit Actions
 */

/**
 * Search Result
 */
export interface SearchResult {
  genius_id: number
  title: string
  title_with_featured: string
  artist: string
  artist_id?: number
  genius_slug: string | null
  url: string
  artwork_thumbnail: string | null
  lyrics_state: string
  _score: number
  soundcloud_permalink?: string
}

export interface SearchResponse {
  success: boolean
  results?: SearchResult[]
  count?: number
  error?: string
}

/**
 * Song Metadata Result (from Genius API)
 */
export interface SongMetadataResult {
  success: boolean
  song?: {
    id: number
    title: string
    title_with_featured: string
    artist: string
    artist_id?: number
    path: string
    url: string
    song_art_image_url?: string
    song_art_image_thumbnail_url?: string
    header_image_url?: string
    header_image_thumbnail_url?: string
    release_date_for_display?: string
    description?: string
    youtube_url?: string
    soundcloud_url?: string
    spotify_uuid?: string
    apple_music_id?: string
    apple_music_player_url?: string
    media?: Array<{ provider: string; url: string; type: string }>
    featured_artists?: Array<{ id: number; name: string; url: string }>
    producer_artists?: Array<{ id: number; name: string; url: string }>
    writer_artists?: Array<{ id: number; name: string; url: string }>
  }
  error?: string
}

/**
 * Match and Segment Result
 * V7 includes soundcloudPath and hasFullAudio checks
 * V6 returns sections WITHOUT alignment (fast ~5-10s)
 * V5 returned sections WITH alignment (slow ~30-60s) - deprecated
 */
export interface MatchSegmentResult {
  success: boolean
  genius?: {
    artist: string
    title: string
    album: string
    soundcloudPermalink: string
    soundcloudPath: string
  }
  hasFullAudio?: boolean
  soundcloudPermalink?: string
  songDuration?: number
  lrclib?: {
    artist: string
    title: string
    album: string
    lyricsLines: number
    matchScore: number
  }
  isMatch?: boolean
  confidence?: 'high' | 'medium' | 'low'
  sections?: Array<{
    type: string
    startTime: number
    endTime: number
    duration: number
  }>
  alignment?: {
    storageKey: string
    uri: string
    gatewayUrl: string
    lineCount: number
    wordCount: number
  } // V5 only - not returned by V6
  txHash?: string
  contractError?: string
  error?: string
  stack?: string
}

/**
 * Audio Processor Result (v4 - Song-Based Demucs)
 */
export interface AudioProcessorResult {
  success: boolean
  geniusId: number
  jobId: string
  status: 'processing'
  selectedSegment: {
    index: number
    id: string
    type: string
    startTime: number
    endTime: number
    duration: number
  }
  allSegments: string[]
  segmentCount: number
  songDuration: number
  pollUrl: string
  webhookUrl: string
  estimatedTime: string
  processing: {
    demucs_trigger: number
    total: number
  }
  optimization: {
    method: string
    model: string
    cost: string
    savings: string
  }
  error?: string
  stack?: string
}

/**
 * Base Alignment Result (v1 - Word Timing Only)
 */
export interface BaseAlignmentResult {
  success: boolean
  geniusId?: number
  metadataUri?: string
  gatewayUrl?: string
  lineCount?: number
  wordCount?: number
  txHash?: string
  contractError?: string
  error?: string
  stack?: string
}

/**
 * Translate Lyrics Result (v1 - Per-Language Translation)
 */
export interface TranslateResult {
  success: boolean
  geniusId?: number
  language?: string
  translationUri?: string
  gatewayUrl?: string
  lineCount?: number
  txHash?: string
  contractError?: string
  error?: string
  stack?: string
}

/**
 * Artist Metadata Result (from Genius API)
 */
export interface ArtistMetadataResult {
  success: boolean
  artist?: {
    id: number
    name: string
    url: string
    image_url?: string
    header_image_url?: string
    description?: string
    instagram_name?: string
    twitter_name?: string
    facebook_name?: string
    followers_count?: number
    is_verified?: boolean
    alternate_names?: string[]
  }
  topSongs?: Array<{
    id: number
    title: string
    title_with_featured: string
    artist_names: string
    url: string
    song_art_image_thumbnail_url?: string
    path?: string
  }>
  error?: string
}
