import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Generate URL-safe slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

/**
 * Match slug against text
 */
export function matchesSlug(slug: string, text: string): boolean {
  const generatedSlug = generateSlug(text)
  return generatedSlug === slug || generatedSlug.startsWith(slug) || slug.startsWith(generatedSlug)
}

/**
 * Query to get all clips for slug resolution
 */
const ALL_CLIPS_QUERY = gql`
  query GetAllClipsForSlugResolution {
    clips(first: 100, orderBy: registeredAt, orderDirection: desc) {
      spotifyTrackId
      metadataUri
    }
  }
`

interface ClipForSlug {
  spotifyTrackId: string
  metadataUri: string
}

interface SongMetadata {
  title?: string
  artist?: string
}

/**
 * Dynamic slug resolution (fallback)
 */
export function useSongSlugResolution(artistSlug?: string, songSlug?: string) {
  return useQuery({
    queryKey: ['song-slug', artistSlug, songSlug],
    queryFn: async () => {
      if (!artistSlug || !songSlug) {
        throw new Error('Both artist and song slugs are required')
      }

      const data = await graphClient.request<{ clips: ClipForSlug[] }>(ALL_CLIPS_QUERY)

      if (!data.clips || data.clips.length === 0) {
        throw new Error('No clips found')
      }

      for (const clip of data.clips) {
        try {
          const httpUrl = convertGroveUri(clip.metadataUri)
          const response = await fetch(httpUrl)
          if (!response.ok) continue

          const metadata: SongMetadata = await response.json()

          const titleMatches = metadata.title && matchesSlug(songSlug, metadata.title)
          const artistMatches = metadata.artist && matchesSlug(artistSlug, metadata.artist)

          if (titleMatches && artistMatches) {
            return { spotifyTrackId: clip.spotifyTrackId }
          }
        } catch {
          continue
        }
      }

      throw new Error(`No song found for ${artistSlug}/${songSlug}`)
    },
    enabled: !!artistSlug && !!songSlug,
    staleTime: 300000,
    retry: false,
  })
}

/**
 * Static slug → Spotify Track ID map
 */
const SLUG_MAP: Record<string, string> = {
  'eminem/lose-yourself': '5Z01UMMf7V1o0MzF86s6WJ',
  'britney-spears/toxic': '717TY4sfgKQm4kFbYQIzgo',
}

/**
 * Resolve slug to Spotify track ID
 */
export function resolveSlug(artistSlug: string, songSlug: string): string | undefined {
  return SLUG_MAP[`${artistSlug}/${songSlug}`]
}

/**
 * Get all available slugs
 */
export function getAllSlugs(): Array<{ artistSlug: string; songSlug: string }> {
  return Object.keys(SLUG_MAP).map(key => {
    const [artistSlug, songSlug] = key.split('/')
    return { artistSlug, songSlug }
  })
}

/**
 * Primary hook for slug-based routing
 */
export function useSongSlug(artistSlug?: string, songSlug?: string) {
  const staticResult = artistSlug && songSlug ? resolveSlug(artistSlug, songSlug) : undefined

  const dynamicQuery = useSongSlugResolution(
    staticResult ? undefined : artistSlug,
    staticResult ? undefined : songSlug
  )

  if (staticResult) {
    return {
      data: { spotifyTrackId: staticResult },
      isLoading: false,
      error: null,
    }
  }

  return dynamicQuery
}
