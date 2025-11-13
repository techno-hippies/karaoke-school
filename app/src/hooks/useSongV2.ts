import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'
import type { SongMetadata } from './useGroveSongMetadata'

/**
 * Clip from The Graph subgraph
 * Primary interface for karaoke data (references GRC-20 for music metadata)
 */
export interface Clip {
  id: string
  clipHash: string
  grc20WorkId: string // References GRC-20 public music metadata layer
  spotifyTrackId: string
  metadataUri: string
  instrumentalUri?: string
  alignmentUri?: string
  clipStartMs: number
  clipEndMs: number
  translationCount: number
  performanceCount: number
  averageScore: number
  registeredAt: string
  processedAt?: string
  encryptedFullUri?: string
  unlockLockAddress?: string
  unlockChainId?: number
  performances: Array<{
    id: string
    score: number
    performer: {
      username: string
      lensAccountAddress: string
    }
  }>
  translations: Array<{
    languageCode: string
    translationUri: string
    confidenceScore: number
  }>
}

/**
 * Collection of clips for a GRC-20 work
 */
export interface GRC20WorkClips {
  grc20WorkId: string
  spotifyTrackId: string // Primary identifier
  clips: Clip[]
}

/**
 * Enriched clip data with Grove metadata
 */
export interface EnrichedClip extends Clip {
  metadata?: SongMetadata
}

/**
 * Query clips by GRC-20 work ID
 * This is the primary interface - no Song entity involved
 */
const GRC20_CLIPS_QUERY = gql`
  query GetClipsByGRC20Work($grc20WorkId: String!) {
    clips(
      where: { grc20WorkId: $grc20WorkId }
      orderBy: clipStartMs
      orderDirection: asc
    ) {
      id
      clipHash
      grc20WorkId
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      clipStartMs
      clipEndMs
      translationCount
      performanceCount
      averageScore
      registeredAt
      processedAt
      encryptedFullUri
      unlockLockAddress
      unlockChainId
      performances(first: 5, orderBy: gradedAt, orderDirection: desc) {
        id
        score
        performer {
          username
          lensAccountAddress
        }
      }
      translations(first: 10, orderBy: confidenceScore, orderDirection: desc) {
        languageCode
        translationUri
        confidenceScore
      }
    }
  }
`

/**
 * Fetch clips for a GRC-20 work ID (primary approach)
 *
 * @param grc20WorkId - The GRC-20 work UUID
 * @returns Clips grouped by grc20WorkId
 */
export function useClipsByGRC20Work(grc20WorkId?: string) {
  return useQuery({
    queryKey: ['clips-grc20', grc20WorkId],
    queryFn: async () => {
      if (!grc20WorkId) {
        throw new Error('GRC-20 work ID is required')
      }

      const data = await graphClient.request<{ clips: Clip[] }>(
        GRC20_CLIPS_QUERY,
        { grc20WorkId }
      )

      if (!data.clips || data.clips.length === 0) {
        throw new Error('No clips found for this work')
      }

      // Return as GRC20WorkClips structure
      const firstClip = data.clips[0]
      return {
        grc20WorkId,
        spotifyTrackId: firstClip.spotifyTrackId,
        clips: data.clips,
      } as GRC20WorkClips
    },
    enabled: !!grc20WorkId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Fetch a single clip with its metadata enriched
 *
 * @param clipHash - The clip hash
 * @returns Clip enriched with Grove metadata
 */
export function useClipWithMetadata() {
  // Placeholder - would query single clip and fetch Grove metadata
  // Not fully implemented yet
  return {
    data: undefined,
    isLoading: false,
    error: null,
  }
}

/**
 * Fetch GRC-20 work clips with Grove metadata enriched
 *
 * @param grc20WorkId - The GRC-20 work UUID
 * @returns Clips enriched with metadata
 */
export function useGRC20WorkClipsWithMetadata(grc20WorkId?: string) {
  // First, fetch clips from The Graph
  const { data: workData, isLoading: isLoadingClips, error: clipsError } =
    useClipsByGRC20Work(grc20WorkId)

  // Then, fetch metadata from Grove for first clip (example)
  const firstClip = workData?.clips[0]
  const { data: metadata, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ['clip-metadata', firstClip?.metadataUri],
    queryFn: async () => {
      if (!firstClip?.metadataUri) {
        throw new Error('Metadata URI is required')
      }

      const httpUrl = convertGroveUri(firstClip.metadataUri)
      console.log('[useSongV2] Fetching Grove metadata from:', httpUrl)
      const response = await fetch(httpUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`)
      }
      const rawData = await response.json()
      console.log('[useSongV2] 🚨 Raw Grove data:', rawData)
      console.log('[useSongV2] 🚨 Keys in Grove data:', Object.keys(rawData))
      console.log('[useSongV2] 🚨 Has coverUri?', rawData.coverUri ? 'YES' : 'NO')
      console.log('[useSongV2] 🚨 coverUri value:', rawData.coverUri)
      return rawData as Promise<SongMetadata>
    },
    enabled: !!firstClip?.metadataUri,
    staleTime: 300000, // 5 minutes (immutable)
  })

  // Enhance first clip with metadata
  const enrichedClips = workData?.clips.map((clip, idx) => ({
    ...clip,
    metadata: idx === 0 ? metadata : undefined,
  } as EnrichedClip)) ?? []

  return {
    data: workData ? {
      ...workData,
      clips: enrichedClips,
    } : undefined,
    isLoading: isLoadingClips || isLoadingMetadata,
    error: clipsError,
  }
}
