import { createQuery } from '@tanstack/solid-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { buildManifest, fetchJson } from '@/lib/storage'
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
  title_zh?: string  // Chinese translation
  title_vi?: string  // Vietnamese translation
  title_id?: string  // Indonesian translation
  artist?: string
  artist_zh?: string  // Chinese translation/transliteration
  artist_vi?: string  // Vietnamese translation/transliteration
  artist_id?: string  // Indonesian translation/transliteration
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
export function useSongClips(spotifyTrackId: () => string | undefined) {
  const clipsQuery = createQuery(() => ({
    queryKey: ['song-clips', spotifyTrackId()],
    queryFn: async () => {
      const trackId = spotifyTrackId()
      if (!trackId) throw new Error('Spotify track ID required')

      const data = await graphClient.request<{ clips: Clip[] }>(CLIPS_QUERY, { spotifyTrackId: trackId })
      if (!data.clips?.length) throw new Error('No clips found')

      return { spotifyTrackId: trackId, clips: data.clips } as SongClips
    },
    enabled: !!spotifyTrackId(),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }))

  const firstClip = () => clipsQuery.data?.clips[0]

  const metadataQuery = createQuery(() => ({
    queryKey: ['song-metadata', firstClip()?.metadataUri],
    queryFn: async () => {
      const clip = firstClip()
      if (!clip?.metadataUri) throw new Error('No metadata URI')
      // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
      const manifest = buildManifest(clip.metadataUri)
      const metadata = await fetchJson<SongMetadata>(manifest)
      // Derive artistSlug from artist name if not present in metadata
      if (!metadata.artistSlug && metadata.artist) {
        metadata.artistSlug = generateSlug(metadata.artist)
      }
      return metadata
    },
    enabled: !!firstClip()?.metadataUri,
    staleTime: 300000,
  }))

  // Return a reactive accessor pattern for SolidJS
  return {
    get data() {
      const clips = clipsQuery.data
      if (!clips) return undefined

      const enrichedClips = clips.clips.map((clip, i) => ({
        ...clip,
        metadata: i === 0 ? metadataQuery.data : undefined,
      }))

      return { ...clips, clips: enrichedClips }
    },
    get isLoading() {
      return clipsQuery.isLoading || metadataQuery.isLoading
    },
    get error() {
      return clipsQuery.error
    },
  }
}
