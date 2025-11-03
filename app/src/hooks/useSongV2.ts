import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'
import type { SongMetadata } from './useGroveSongMetadata'

/**
 * Segment from The Graph subgraph
 * Primary interface for karaoke data (references GRC-20 for music metadata)
 */
export interface Segment {
  id: string
  segmentHash: string
  grc20WorkId: string // References GRC-20 public music metadata layer
  spotifyTrackId: string
  metadataUri: string
  instrumentalUri?: string
  alignmentUri?: string
  segmentStartMs: number
  segmentEndMs: number
  translationCount: number
  performanceCount: number
  averageScore: number
  registeredAt: string
  processedAt?: string
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
 * Collection of segments for a GRC-20 work
 */
export interface GRC20WorkSegments {
  grc20WorkId: string
  spotifyTrackId: string // Primary identifier
  segments: Segment[]
}

/**
 * Enriched segment data with Grove metadata
 */
export interface EnrichedSegment extends Segment {
  metadata?: SongMetadata
}

/**
 * Query segments by GRC-20 work ID
 * This is the primary interface - no Song entity involved
 */
const GRC20_SEGMENTS_QUERY = gql`
  query GetSegmentsByGRC20Work($grc20WorkId: String!) {
    segments(
      where: { grc20WorkId: $grc20WorkId }
      orderBy: segmentStartMs
      orderDirection: asc
    ) {
      id
      segmentHash
      grc20WorkId
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      segmentStartMs
      segmentEndMs
      translationCount
      performanceCount
      averageScore
      registeredAt
      processedAt
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
 * Fetch segments for a GRC-20 work ID (primary approach)
 *
 * @param grc20WorkId - The GRC-20 work UUID
 * @returns Segments grouped by grc20WorkId
 */
export function useSegmentsByGRC20Work(grc20WorkId?: string) {
  return useQuery({
    queryKey: ['segments-grc20', grc20WorkId],
    queryFn: async () => {
      if (!grc20WorkId) {
        throw new Error('GRC-20 work ID is required')
      }

      const data = await graphClient.request<{ segments: Segment[] }>(
        GRC20_SEGMENTS_QUERY,
        { grc20WorkId }
      )

      if (!data.segments || data.segments.length === 0) {
        throw new Error('No segments found for this work')
      }

      // Return as GRC20WorkSegments structure
      const firstSegment = data.segments[0]
      return {
        grc20WorkId,
        spotifyTrackId: firstSegment.spotifyTrackId,
        segments: data.segments,
      } as GRC20WorkSegments
    },
    enabled: !!grc20WorkId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Fetch a single segment with its metadata enriched
 *
 * @param segmentHash - The segment hash
 * @returns Segment enriched with Grove metadata
 */
export function useSegmentWithMetadata(segmentHash?: string) {
  // Placeholder - would query single segment and fetch Grove metadata
  // Not fully implemented yet
  return {
    data: undefined,
    isLoading: false,
    error: null,
  }
}

/**
 * Fetch GRC-20 work segments with Grove metadata enriched
 *
 * @param grc20WorkId - The GRC-20 work UUID
 * @returns Segments enriched with metadata
 */
export function useGRC20WorkSegmentsWithMetadata(grc20WorkId?: string) {
  // First, fetch segments from The Graph
  const { data: workData, isLoading: isLoadingSegments, error: segmentsError } =
    useSegmentsByGRC20Work(grc20WorkId)

  // Then, fetch metadata from Grove for first segment (example)
  const firstSegment = workData?.segments[0]
  const { data: metadata, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ['segment-metadata', firstSegment?.metadataUri],
    queryFn: async () => {
      if (!firstSegment?.metadataUri) {
        throw new Error('Metadata URI is required')
      }

      const httpUrl = convertGroveUri(firstSegment.metadataUri)
      const response = await fetch(httpUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`)
      }
      return response.json() as Promise<SongMetadata>
    },
    enabled: !!firstSegment?.metadataUri,
    staleTime: 300000, // 5 minutes (immutable)
  })

  // Enhance first segment with metadata
  const enrichedSegments = workData?.segments.map((seg, idx) => ({
    ...seg,
    metadata: idx === 0 ? metadata : undefined,
  } as EnrichedSegment)) ?? []

  return {
    data: workData ? {
      ...workData,
      segments: enrichedSegments,
    } : undefined,
    isLoading: isLoadingSegments || isLoadingMetadata,
    error: segmentsError,
  }
}
