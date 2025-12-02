import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'
import { generateSlug } from './useSongSlug'

export interface Clip {
  id: string
  clipHash: string
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
  // Access control now read from clip metadata.encryption (SongAccess or Unlock)
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
  metadata?: SongMetadata
}

export interface SongMetadata {
  title?: string
  artist?: string
  artistSlug?: string
  coverUri?: string
  artistLensHandle?: string
  karaoke_lines?: Array<{
    line_index: number
    start_ms: number
    end_ms: number
    original_text?: string
  }>
}

export interface SongClips {
  spotifyTrackId: string
  clips: Clip[]
}

const CLIPS_QUERY = gql`
  query GetClips($spotifyTrackId: String!) {
    clips(
      where: { spotifyTrackId: $spotifyTrackId }
      orderBy: clipStartMs
      orderDirection: asc
    ) {
      id
      clipHash
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
 * Fetch clips for a song by Spotify track ID, with metadata enriched
 */
export function useSongClips(spotifyTrackId?: string) {
  const clipsQuery = useQuery({
    queryKey: ['song-clips', spotifyTrackId],
    queryFn: async () => {
      if (!spotifyTrackId) throw new Error('Spotify track ID required')

      const data = await graphClient.request<{ clips: Clip[] }>(CLIPS_QUERY, { spotifyTrackId })
      if (!data.clips?.length) throw new Error('No clips found')

      return { spotifyTrackId, clips: data.clips } as SongClips
    },
    enabled: !!spotifyTrackId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const firstClip = clipsQuery.data?.clips[0]

  const metadataQuery = useQuery({
    queryKey: ['song-metadata', firstClip?.metadataUri],
    queryFn: async () => {
      if (!firstClip?.metadataUri) throw new Error('No metadata URI')
      const url = convertGroveUri(firstClip.metadataUri)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Metadata fetch failed: ${response.status}`)
      const metadata = await response.json() as SongMetadata
      // Derive artistSlug from artist name if not present in metadata
      if (!metadata.artistSlug && metadata.artist) {
        metadata.artistSlug = generateSlug(metadata.artist)
      }
      return metadata
    },
    enabled: !!firstClip?.metadataUri,
    staleTime: 300000,
  })

  const enrichedClips = clipsQuery.data?.clips.map((clip, i) => ({
    ...clip,
    metadata: i === 0 ? metadataQuery.data : undefined,
  })) ?? []

  return {
    data: clipsQuery.data ? { ...clipsQuery.data, clips: enrichedClips } : undefined,
    isLoading: clipsQuery.isLoading || metadataQuery.isLoading,
    error: clipsQuery.error,
  }
}
