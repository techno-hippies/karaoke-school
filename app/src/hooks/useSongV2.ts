import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'
import type { SongMetadata } from './useGroveSongMetadata'

/**
 * Song data from The Graph subgraph
 */
export interface SongV2 {
  id: string // geniusId as string
  geniusId: string
  metadataUri: string
  registeredBy: string
  geniusArtistId: string
  registeredAt: string
  segmentCount: number
  performanceCount: number
  segments: Array<{
    id: string
    segmentHash: string
    tiktokSegmentId: string
    metadataUri: string
    instrumentalUri?: string
    alignmentUri?: string
  }>
}

/**
 * Enriched song data with Grove metadata
 */
export interface EnrichedSongV2 extends SongV2 {
  metadata?: SongMetadata
}

const SONG_QUERY = gql`
  query GetSong($geniusId: BigInt!) {
    songs(where: { geniusId: $geniusId }) {
      id
      geniusId
      metadataUri
      registeredBy
      geniusArtistId
      registeredAt
      segmentCount
      performanceCount
      segments {
        id
        segmentHash
        tiktokSegmentId
        metadataUri
        instrumentalUri
        alignmentUri
      }
    }
  }
`

/**
 * Fetch a single song from The Graph subgraph
 *
 * @param geniusId - The Genius song ID
 * @returns Song with its segments
 */
export function useSongV2(geniusId?: number) {
  return useQuery({
    queryKey: ['song-v2', geniusId],
    queryFn: async () => {
      if (!geniusId) {
        throw new Error('Genius ID is required')
      }

      const data = await graphClient.request<{ songs: SongV2[] }>(
        SONG_QUERY,
        { geniusId: geniusId.toString() }
      )

      if (!data.songs || data.songs.length === 0) {
        throw new Error('Song not found')
      }

      return data.songs[0]
    },
    enabled: !!geniusId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Fetch a song with its Grove metadata enriched
 *
 * @param geniusId - The Genius song ID
 * @returns Song enriched with metadata (title, artist, cover)
 */
export function useSongWithMetadata(geniusId?: number) {
  // First, fetch song from The Graph
  const { data: song, isLoading: isLoadingSong, error: songError } = useSongV2(geniusId)

  // Then, fetch metadata from Grove
  const { data: metadata, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ['song-metadata', song?.metadataUri],
    queryFn: async () => {
      if (!song?.metadataUri) {
        throw new Error('Metadata URI is required')
      }

      const httpUrl = convertGroveUri(song.metadataUri)
      const response = await fetch(httpUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`)
      }
      return response.json() as Promise<SongMetadata>
    },
    enabled: !!song?.metadataUri,
    staleTime: 300000, // 5 minutes (immutable)
  })

  // Combine song with metadata
  const enrichedSong: EnrichedSongV2 | undefined = song ? {
    ...song,
    metadata,
  } : undefined

  return {
    data: enrichedSong,
    isLoading: isLoadingSong || isLoadingMetadata,
    error: songError,
  }
}
