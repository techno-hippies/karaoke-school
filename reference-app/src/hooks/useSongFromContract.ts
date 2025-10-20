/**
 * useSongFromContract Hook
 *
 * Reads song metadata directly from KaraokeCatalogV2 contract.
 * This replaces Genius API calls for song display, providing:
 * - Instant response (no API latency)
 * - No rate limiting
 * - Works even if Genius API is down
 * - Single source of truth (contract)
 *
 * Usage:
 * ```ts
 * const { song, isLoading, error } = useSongFromContract(geniusId)
 * ```
 */

import { useReadContract } from 'wagmi'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'

export interface SongFromContract {
  // Core metadata
  id: string
  geniusId: number
  geniusArtistId: number
  title: string
  artist: string
  duration: number
  soundcloudPath: string

  // Capabilities
  hasFullAudio: boolean
  requiresPayment: boolean

  // Media URIs (lens:// format)
  audioUri: string
  coverUri: string
  thumbnailUri: string
  musicVideoUri: string

  // Karaoke data URIs
  metadataUri: string // DEPRECATED: use sectionsUri + alignmentUri
  sectionsUri: string // Song structure (verses, chorus, etc.)
  alignmentUri: string // Word-level timing

  // State
  enabled: boolean
  addedAt: bigint

  // Derived (computed from URIs)
  coverUrl: string // HTTPS URL for display
  thumbnailUrl: string
}

/**
 * Helper: Convert lens:// URI to Grove HTTPS URL
 */
function lensToHttps(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('lens://')) {
    return `https://api.grove.storage/${uri.replace('lens://', '')}`
  }
  return uri
}

/**
 * Hook to fetch song from KaraokeCatalogV2 contract
 */
export function useSongFromContract(geniusId: number | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'getSongByGeniusId',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId && geniusId > 0,
      // Cache for 5 minutes (contract data rarely changes)
      staleTime: 5 * 60 * 1000,
      // Retry on failure
      retry: 3,
    }
  })

  // Transform contract data to frontend format
  const song: SongFromContract | null = data ? {
    id: data.id,
    geniusId: Number(data.geniusId),
    geniusArtistId: Number(data.geniusArtistId),
    title: data.title,
    artist: data.artist,
    duration: Number(data.duration),
    soundcloudPath: data.soundcloudPath,
    hasFullAudio: data.hasFullAudio,
    requiresPayment: data.requiresPayment,

    // URIs (lens:// format)
    audioUri: data.audioUri,
    coverUri: data.coverUri,
    thumbnailUri: data.thumbnailUri,
    musicVideoUri: data.musicVideoUri,
    metadataUri: data.metadataUri,
    sectionsUri: data.sectionsUri,
    alignmentUri: data.alignmentUri,

    // State
    enabled: data.enabled,
    addedAt: data.addedAt,

    // Derived (HTTPS URLs for display)
    coverUrl: lensToHttps(data.coverUri),
    thumbnailUrl: lensToHttps(data.thumbnailUri),
  } : null

  return {
    song,
    isLoading,
    error,
    refetch,
    // Computed helpers
    isCataloged: !!song,
    hasKaraokeData: !!song?.sectionsUri || !!song?.alignmentUri,
    hasSections: !!song?.sectionsUri,
    hasAlignment: !!song?.alignmentUri,
  }
}

/**
 * Hook to check if song exists in catalog (lightweight)
 */
export function useSongExists(geniusId: number | undefined) {
  const { data, isLoading, error } = useReadContract({
    address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'songExistsByGeniusId',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId && geniusId > 0,
      staleTime: 5 * 60 * 1000,
    }
  })

  return {
    exists: data as boolean | undefined,
    isLoading,
    error,
  }
}
