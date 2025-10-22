import { useQuery, useQueries } from '@tanstack/react-query'
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

const SONGS_BY_ARTIST_QUERY = gql`
  query GetSongsByArtist($geniusArtistId: BigInt!) {
    songs(where: { geniusArtistId: $geniusArtistId }, orderBy: registeredAt, orderDirection: desc) {
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
 * Fetch songs for an artist from The Graph subgraph
 *
 * @param geniusArtistId - The Genius artist ID
 * @returns Songs with their segments
 */
export function useArtistSongsV2(geniusArtistId?: number) {
  return useQuery({
    queryKey: ['artist-songs-v2', geniusArtistId],
    queryFn: async () => {
      if (!geniusArtistId) {
        throw new Error('Genius artist ID is required')
      }

      const data = await graphClient.request<{ songs: SongV2[] }>(
        SONGS_BY_ARTIST_QUERY,
        { geniusArtistId: geniusArtistId.toString() }
      )

      return data.songs
    },
    enabled: !!geniusArtistId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Enriched song data with Grove metadata
 */
export interface EnrichedSong extends SongV2 {
  metadata?: SongMetadata
}

/**
 * Fetch songs with their Grove metadata enriched
 *
 * @param geniusArtistId - The Genius artist ID
 * @returns Songs enriched with metadata (title, artist, cover)
 */
export function useArtistSongsWithMetadata(geniusArtistId?: number) {
  // First, fetch songs from The Graph
  const { data: songs, isLoading: isLoadingSongs, error: songsError } = useArtistSongsV2(geniusArtistId)

  // Then, fetch metadata for each song
  const metadataQueries = useQueries({
    queries: (songs || []).map((song) => ({
      queryKey: ['song-metadata', song.metadataUri],
      queryFn: async () => {
        const httpUrl = convertGroveUri(song.metadataUri)
        const response = await fetch(httpUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }
        return response.json() as Promise<SongMetadata>
      },
      staleTime: 300000, // 5 minutes (immutable)
      enabled: !!song.metadataUri,
    })),
  })

  // Combine songs with their metadata
  const enrichedSongs: EnrichedSong[] = (songs || []).map((song, index) => ({
    ...song,
    metadata: metadataQueries[index]?.data,
  }))

  const isLoadingMetadata = metadataQueries.some(q => q.isLoading)

  return {
    data: enrichedSongs,
    isLoading: isLoadingSongs || isLoadingMetadata,
    error: songsError,
  }
}
