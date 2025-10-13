/**
 * Karaoke Lit Actions
 * High-level functions for executing Lit Actions with automatic auth handling
 */

import { getLitClient, getCachedEoaAuthContext, initializeLitSessionWithWallet } from './client'
import { getKaraokeKeyParams } from './encrypted-keys'
import type { WalletClient } from 'viem'

const IS_DEV = import.meta.env.DEV

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
  }
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
 * Get or initialize auth context
 * Initializes Lit on first use if wallet client is provided
 */
async function getAuthContext(walletClient?: WalletClient) {
  let authContext = getCachedEoaAuthContext()

  if (!authContext) {
    if (!walletClient) {
      throw new Error('Wallet client required for first-time Lit initialization')
    }
    const litSession = await initializeLitSessionWithWallet(walletClient)
    authContext = litSession.authContext
  }

  return authContext
}

/**
 * Execute Search Lit Action
 * Searches for songs on Genius using free tier
 */
export async function executeSearch(
  query: string,
  limit: number = 10,
  authContext: any
): Promise<SearchResponse> {
  try {
    const litClient = await getLitClient()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_SEARCH,
      authContext,
      jsParams: { query, limit },
    })

    const response: SearchResponse = JSON.parse(result.response)

    if (IS_DEV && response.success && response.results) {
      console.log(`[Search] Found ${response.count} results:`,
        response.results.slice(0, 3).map(r => `${r.artist} - ${r.title}`))
    }

    return response
  } catch (err) {
    console.error('[Search] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Search failed',
    }
  }
}

/**
 * Execute Song Metadata Lit Action
 * Fetches full song metadata from Genius API (free, no auth required)
 */
export async function executeSongMetadata(
  songId: number,
  authContext: any
): Promise<SongMetadataResult> {
  try {
    const litClient = await getLitClient()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_SONG,
      authContext,
      jsParams: { songId },
    })

    const response: SongMetadataResult = JSON.parse(result.response)

    if (IS_DEV && response.success && response.song) {
      console.log(`[Song] ${response.song.artist} - ${response.song.title}`)
    }

    return response
  } catch (err) {
    console.error('[Song] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Song metadata fetch failed',
    }
  }
}

/**
 * Execute Match and Segment Lit Action (v7 - Hardcoded System PKP)
 * Matches Genius song with LRCLib and extracts song sections
 *
 * Flow:
 * 1. Fetch song metadata from Genius
 * 2. Get synced lyrics from LRClib
 * 3. Match + segment with AI (NO alignment, NO translations)
 * 4. Write to blockchain using SYSTEM PKP (hardcoded in Lit Action)
 *
 * Expected time: ~5-10s (was ~30-60s with v5 alignment)
 * Expected cost: ~$0.01 (was ~$0.05 with v5)
 *
 * Security:
 * - System PKP credentials hardcoded in IPFS code (immutable, can't be spoofed)
 * - User's PKP only for authentication, system PKP signs transactions
 * - Contract only allows system PKP as trustedProcessor
 *
 * Note: Alignment and translations are done separately via base-alignment-v1 and translate-lyrics-v1
 *
 * @param geniusId - Genius song ID
 * @param authContext - PKP auth context (user's PKP for authentication)
 */
export async function executeMatchAndSegment(
  geniusId: number,
  authContext: any
): Promise<MatchSegmentResult> {
  const litClient = await getLitClient()
  const keyParams = getKaraokeKeyParams()

  const jsParams: any = {
    geniusId,
    ...keyParams,
    contractAddress: import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT,
    writeToBlockchain: true
  }

  if (IS_DEV) {
    console.log('[Match] jsParams:', {
      geniusId,
      hasGeniusACC: !!jsParams.geniusKeyAccessControlConditions,
      hasOpenRouterACC: !!jsParams.openrouterKeyAccessControlConditions,
      hasElevenlabsACC: !!jsParams.elevenlabsKeyAccessControlConditions,
      contractAddress: jsParams.contractAddress,
      ipfsId: import.meta.env.VITE_LIT_ACTION_MATCH_SEGMENT
    })
  }

  const result = await litClient.executeJs({
    ipfsId: import.meta.env.VITE_LIT_ACTION_MATCH_SEGMENT,
    authContext,
    jsParams,
  })

  const response: MatchSegmentResult = JSON.parse(result.response)

  if (IS_DEV && response.success && response.isMatch) {
    console.log(`[Match] ${response.genius?.artist} - ${response.genius?.title}`,
      `(${response.confidence}, ${response.sections?.length || 0} sections)`)
  }

  return response
}

/**
 * Execute Audio Processor Lit Action (v4 - Song-Based Demucs)
 * Triggers song-based karaoke generation (paid operation - requires credits)
 *
 * IMPORTANT: User must own the segment before calling this function.
 * Use checkSegmentOwnership() and unlockSegment() first if needed.
 *
 * Flow:
 * 1. Verifies segment ownership in KaraokeCreditsV1 contract
 * 2. Triggers Demucs /process-song-async (processes ALL segments)
 * 3. Returns jobId for frontend to poll
 * 4. Demucs processes in background → webhook → updates contract
 *
 * @param geniusId - Genius song ID
 * @param sectionIndex - Selected section (1-based index)
 * @param sections - Array of all sections from match-and-segment
 * @param soundcloudPermalink - SoundCloud track permalink
 * @param userAddress - User's wallet address (for ownership verification)
 * @param songDuration - Full song duration in seconds (from max section endTime)
 * @param authContext - PKP auth context
 */
export async function executeAudioProcessor(
  geniusId: number,
  sectionIndex: number,
  sections: MatchSegmentResult['sections'],
  soundcloudPermalink: string,
  userAddress: string,
  songDuration: number,
  authContext: any
): Promise<AudioProcessorResult> {
  const litClient = await getLitClient()

  const result = await litClient.executeJs({
    ipfsId: import.meta.env.VITE_LIT_ACTION_AUDIO_PROCESSOR,
    authContext,
    jsParams: {
      geniusId,
      sectionIndex,
      sections,
      soundcloudPermalink,
      userAddress,
      songDuration,
    },
  })

  return JSON.parse(result.response)
}

/**
 * Execute Base Alignment Lit Action (v1 - Word Timing Only)
 * Generates word-level timing for karaoke WITHOUT translations
 *
 * Flow:
 * 1. Downloads audio from SoundCloud
 * 2. ElevenLabs forced alignment → word-level timing
 * 3. Uploads to Grove → song-{geniusId}-base.json
 * 4. Updates contract metadataUri
 *
 * Expected time: ~15-30s
 * Expected cost: ~$0.03 (ElevenLabs only)
 *
 * @param geniusId - Genius song ID
 * @param soundcloudPermalink - SoundCloud track permalink
 * @param plainLyrics - Plain text lyrics (no timestamps)
 * @param authContext - PKP auth context
 */
export async function executeBaseAlignment(
  geniusId: number,
  soundcloudPermalink: string,
  plainLyrics: string,
  authContext: any
): Promise<BaseAlignmentResult> {
  try {
    const litClient = await getLitClient()
    const keyParams = getKaraokeKeyParams()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_BASE_ALIGNMENT,
      authContext,
      jsParams: {
        geniusId,
        soundcloudPermalink,
        plainLyrics,
        ...keyParams,
        updateContract: true,
      },
    })

    const response: BaseAlignmentResult = JSON.parse(result.response)

    if (IS_DEV && response.success) {
      console.log(`[BaseAlignment] Generated word timing for song ${geniusId}`,
        `(${response.lineCount} lines, ${response.wordCount} words)`)
    }

    return response
  } catch (err) {
    console.error('[BaseAlignment] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Base alignment failed',
    }
  }
}

/**
 * Execute Translate Lyrics Lit Action (v1 - Per-Language Translation)
 * Generates per-language translation WITHOUT timing (uses base alignment timing)
 *
 * Flow:
 * 1. Loads base alignment from contract metadataUri
 * 2. OpenRouter translation to target language
 * 3. Uploads to Grove → song-{geniusId}-{lang}.json
 * 4. Updates contract via setTranslation(geniusId, languageCode, uri)
 *
 * Expected time: ~5-15s
 * Expected cost: ~$0.02 (OpenRouter only)
 *
 * @param geniusId - Genius song ID
 * @param targetLanguage - Target language code (e.g. 'zh', 'vi', 'tr')
 * @param authContext - PKP auth context
 */
export async function executeTranslate(
  geniusId: number,
  targetLanguage: string,
  authContext: any
): Promise<TranslateResult> {
  try {
    const litClient = await getLitClient()
    const keyParams = getKaraokeKeyParams()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_TRANSLATE,
      authContext,
      jsParams: {
        geniusId,
        targetLanguage,
        ...keyParams,
        updateContract: true,
      },
    })

    const response: TranslateResult = JSON.parse(result.response)

    if (IS_DEV && response.success) {
      console.log(`[Translate] Generated translation for song ${geniusId}`,
        `(language: ${targetLanguage}, ${response.lineCount} lines)`)
    }

    return response
  } catch (err) {
    console.error('[Translate] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Translation failed',
    }
  }
}

/**
 * Format section for display
 */
export function formatSection(section: MatchSegmentResult['sections'][0]): string {
  const minutes = Math.floor(section.startTime / 60)
  const seconds = Math.floor(section.startTime % 60)
  return `${section.type} (${minutes}:${seconds.toString().padStart(2, '0')} - ${section.duration}s)`
}

/**
 * Generate segment ID from section (matches contract format)
 * Example: "Chorus 1" -> "chorus-1"
 */
export function generateSegmentId(section: MatchSegmentResult['sections'][0]): string {
  return section.type.toLowerCase().replace(/\s+/g, '-')
}
