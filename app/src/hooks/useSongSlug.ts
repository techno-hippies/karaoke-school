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
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
    .substring(0, 50) // Limit length
}

/**
 * Match slug against text (handles common variations)
 */
export function matchesSlug(slug: string, text: string): boolean {
  const generatedSlug = generateSlug(text)
  return generatedSlug === slug || generatedSlug.startsWith(slug) || slug.startsWith(generatedSlug)
}

/**
 * Query to get all clips with metadata for slug resolution
 */
const ALL_CLIPS_QUERY = gql`
  query GetAllClipsForSlugResolution {
    clips(first: 100, orderBy: registeredAt, orderDirection: desc) {
      spotifyTrackId
      grc20WorkId
      metadataUri
    }
  }
`

interface ClipForSlug {
  spotifyTrackId: string
  grc20WorkId: string
  metadataUri: string
}

interface SongMetadata {
  title?: string
  artist?: string
}

/**
 * Resolve artist/song slugs to Spotify track ID
 *
 * This hook fetches all clips, resolves their metadata, and matches against slugs.
 * For a production system, this would be a database lookup.
 *
 * @param artistSlug - Artist slug (e.g., 'eminem')
 * @param songSlug - Song slug (e.g., 'lose-yourself')
 * @returns Spotify track ID if found
 */
export function useSongSlugResolution(artistSlug?: string, songSlug?: string) {
  return useQuery({
    queryKey: ['song-slug', artistSlug, songSlug],
    queryFn: async () => {
      if (!artistSlug || !songSlug) {
        throw new Error('Both artist and song slugs are required')
      }

      // Fetch all clips
      const data = await graphClient.request<{ clips: ClipForSlug[] }>(ALL_CLIPS_QUERY)

      if (!data.clips || data.clips.length === 0) {
        throw new Error('No clips found')
      }

      // Fetch metadata for each clip and find match
      for (const clip of data.clips) {
        try {
          const httpUrl = convertGroveUri(clip.metadataUri)
          const response = await fetch(httpUrl)
          if (!response.ok) continue

          const metadata: SongMetadata = await response.json()

          // Check if this clip matches the slugs
          const titleMatches = metadata.title && matchesSlug(songSlug, metadata.title)
          const artistMatches = metadata.artist && matchesSlug(artistSlug, metadata.artist)

          if (titleMatches && artistMatches) {
            return {
              spotifyTrackId: clip.spotifyTrackId,
              grc20WorkId: clip.grc20WorkId,
              metadata,
            }
          }
        } catch (e) {
          // Skip clips with invalid metadata
          continue
        }
      }

      throw new Error(`No song found for ${artistSlug}/${songSlug}`)
    },
    enabled: !!artistSlug && !!songSlug,
    staleTime: 300000, // 5 minutes
    retry: false,
  })
}

/**
 * Slug → Spotify Track ID mapping
 *
 * This is the source of truth for routing.
 * Generated from pipeline-new database: SELECT artist_slug, song_slug, spotify_track_id
 *
 * Format: 'artist-slug/song-slug' → 'spotifyTrackId'
 */
const SLUG_MAP: Record<string, { spotifyTrackId: string; iswc: string }> = {
  'eminem/lose-yourself': {
    spotifyTrackId: '5Z01UMMf7V1o0MzF86s6WJ',
    iswc: 'T0718898588'
  },
  // Add more songs as they're processed through the pipeline
}

/**
 * Resolve slug to song data
 */
export function resolveSlug(artistSlug: string, songSlug: string): { spotifyTrackId: string; iswc: string } | undefined {
  const key = `${artistSlug}/${songSlug}`
  return SLUG_MAP[key]
}

/**
 * Get all available slugs (for sitemap/discovery)
 */
export function getAllSlugs(): Array<{ artistSlug: string; songSlug: string; iswc: string }> {
  return Object.entries(SLUG_MAP).map(([key, value]) => {
    const [artistSlug, songSlug] = key.split('/')
    return { artistSlug, songSlug, iswc: value.iswc }
  })
}

/**
 * Primary hook for slug-based routing
 *
 * Uses static map (fast, no network). Falls back to dynamic resolution
 * only if the song isn't in the map (for newly added songs).
 */
export function useSongSlug(artistSlug?: string, songSlug?: string) {
  // Try static resolution first (instant)
  const staticResult = artistSlug && songSlug
    ? resolveSlug(artistSlug, songSlug)
    : undefined

  // Fall back to dynamic resolution if not in static map
  const dynamicQuery = useSongSlugResolution(
    staticResult ? undefined : artistSlug,
    staticResult ? undefined : songSlug
  )

  if (staticResult) {
    return {
      data: {
        spotifyTrackId: staticResult.spotifyTrackId,
        iswc: staticResult.iswc,
      },
      isLoading: false,
      error: null,
    }
  }

  return dynamicQuery
}
