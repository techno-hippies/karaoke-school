import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'

/**
 * Generate URL-safe slug from text
 * Normalizes accented characters (é → e, ñ → n, etc.)
 */
export function generateSlug(text: string): string {
  return text
    .normalize('NFD') // Decompose accents (é → e + combining accent)
    .replace(/[\u0300-\u036f]/g, '') // Remove combining accents
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

/**
 * Query to find clip by artist and song slug
 * Uses indexed fields in subgraph for O(1) lookup
 */
const CLIP_BY_SLUG_QUERY = gql`
  query GetClipBySlug($artistSlug: String!, $songSlug: String!) {
    clips(
      where: { artistSlug: $artistSlug, songSlug: $songSlug }
      first: 1
    ) {
      spotifyTrackId
      title
      artist
      artistSlug
      songSlug
      coverUri
      thumbnailUri
      metadataUri
    }
  }
`

interface ClipBySlugResult {
  spotifyTrackId: string
  title: string
  artist: string
  artistSlug: string
  songSlug: string
  coverUri: string
  thumbnailUri: string
  metadataUri: string
}

/**
 * Primary hook for slug-based routing
 * Queries subgraph directly by indexed slug fields - O(1) lookup
 */
export function useSongSlug(artistSlug?: string, songSlug?: string) {
  return useQuery({
    queryKey: ['song-slug', artistSlug, songSlug],
    queryFn: async () => {
      if (!artistSlug || !songSlug) {
        throw new Error('Both artist and song slugs are required')
      }

      const data = await graphClient.request<{ clips: ClipBySlugResult[] }>(
        CLIP_BY_SLUG_QUERY,
        { artistSlug, songSlug }
      )

      if (!data.clips || data.clips.length === 0) {
        throw new Error(`No song found for ${artistSlug}/${songSlug}`)
      }

      return { spotifyTrackId: data.clips[0].spotifyTrackId }
    },
    enabled: !!artistSlug && !!songSlug,
    staleTime: 300000, // 5 minutes
    retry: false,
  })
}

/**
 * Get all available slugs from subgraph
 */
const ALL_SLUGS_QUERY = gql`
  query GetAllSlugs {
    clips(first: 100, orderBy: registeredAt, orderDirection: desc) {
      artistSlug
      songSlug
    }
  }
`

export function useAllSlugs() {
  return useQuery({
    queryKey: ['all-slugs'],
    queryFn: async () => {
      const data = await graphClient.request<{ clips: { artistSlug: string; songSlug: string }[] }>(
        ALL_SLUGS_QUERY
      )
      return data.clips || []
    },
    staleTime: 300000,
  })
}
