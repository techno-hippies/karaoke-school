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
 * Match and Segment Result
 */
export interface MatchSegmentResult {
  success: boolean
  genius?: {
    artist: string
    title: string
    album: string
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
  error?: string
  stack?: string
}

/**
 * Karaoke Generation Result
 */
export interface KaraokeGenerationResult {
  success: boolean
  geniusId: number
  section: {
    index: number
    type: string
    startTime: number
    endTime: number
    duration: number
  }
  audio: {
    audioUrl: string
    vocalsZipSize: number
    drumsZipSize: number
    _note: string
  }
  processing: {
    downloadTime: number
    trimTime: number
    separationTime: number
    modalProcessingTime: number
    totalTime: number
  }
  speedup: {
    sectionDuration: number
    processingTime: number
    ratio: string
  }
  error?: string
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
 * Execute Match and Segment Lit Action
 * Matches Genius song with LRCLib and extracts song sections
 */
export async function executeMatchAndSegment(
  geniusId: number,
  authContext: any
): Promise<MatchSegmentResult> {
  const litClient = await getLitClient()
  const keyParams = getKaraokeKeyParams()

  const result = await litClient.executeJs({
    ipfsId: import.meta.env.VITE_LIT_ACTION_MATCH_SEGMENT,
    authContext,
    jsParams: { geniusId, ...keyParams },
  })

  const response: MatchSegmentResult = JSON.parse(result.response)

  if (IS_DEV && response.success && response.isMatch) {
    console.log(`[Match] ${response.genius?.artist} - ${response.genius?.title}`,
      `(${response.confidence}, ${response.sections?.length || 0} sections)`)
  }

  return response
}

/**
 * Execute Audio Processor Lit Action
 * Generates karaoke stems (paid operation - requires credits)
 *
 * IMPORTANT: User must own the segment before calling this function.
 * Use checkSegmentOwnership() and unlockSegment() first if needed.
 *
 * @param geniusId - Genius song ID
 * @param sectionIndex - Selected section (1-based index)
 * @param sections - Array of all sections from match-and-segment
 * @param soundcloudPermalink - SoundCloud track permalink
 * @param userAddress - User's wallet address (for ownership verification)
 * @param walletClient - Wallet client for Lit session
 */
export async function executeKaraokeGeneration(
  geniusId: number,
  sectionIndex: number,
  sections: MatchSegmentResult['sections'],
  soundcloudPermalink: string,
  userAddress: string,
  walletClient: WalletClient
): Promise<KaraokeGenerationResult> {
  const litClient = await getLitClient()
  const authContext = await getAuthContext(walletClient)

  const result = await litClient.executeJs({
    ipfsId: import.meta.env.VITE_LIT_ACTION_AUDIO_PROCESSOR || '',
    authContext,
    jsParams: {
      geniusId,
      sectionIndex,
      sections,
      soundcloudPermalink,
      userAddress,
    },
  })

  return JSON.parse(result.response)
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
