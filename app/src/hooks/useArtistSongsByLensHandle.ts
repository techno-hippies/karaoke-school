import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'

export interface ArtistSong {
  grc20WorkId: string
  title: string
  artist: string
  coverUri?: string
  spotifyTrackId?: string
}

/**
 * Fetch songs for an artist by their Lens handle
 * Queries the subgraph for segments with matching artistLensHandle from metadata
 *
 * @param lensHandle - The artist's Lens handle (e.g., "billie-eilish")
 * @returns Array of songs with metadata
 */
export function useArtistSongsByLensHandle(lensHandle?: string) {
  return useQuery({
    queryKey: ['artist-songs-by-lens-handle', lensHandle],
    queryFn: async () => {
      if (!lensHandle) {
        throw new Error('Lens handle is required')
      }

      // Query subgraph for all segments
      // Then filter by fetching metadata and checking artistLensHandle
      const SUBGRAPH_ENDPOINT = 'http://localhost:8000/subgraphs/name/subgraph-0'

      const response = await fetch(SUBGRAPH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetAllSegments {
              segments(first: 1000, orderBy: registeredAt, orderDirection: desc) {
                id
                grc20WorkId
                spotifyTrackId
                metadataUri
              }
            }
          `
        })
      })

      const { data } = await response.json()

      if (!data?.segments) {
        return []
      }

      // Fetch metadata for each segment and filter by artistLensHandle
      const songsMap = new Map<string, ArtistSong>()

      await Promise.all(
        data.segments.map(async (segment: any) => {
          try {
            const metadataResponse = await fetch(segment.metadataUri)
            const metadata = await metadataResponse.json()

            // Check if this segment belongs to the artist
            if (metadata.artistLensHandle === lensHandle) {
              // Only add unique works (by grc20WorkId)
              if (!songsMap.has(segment.grc20WorkId)) {
                songsMap.set(segment.grc20WorkId, {
                  grc20WorkId: segment.grc20WorkId,
                  title: metadata.title || 'Untitled',
                  artist: metadata.artist || 'Unknown Artist',
                  coverUri: metadata.coverUri ? convertGroveUri(metadata.coverUri) : undefined,
                  spotifyTrackId: segment.spotifyTrackId
                })
              }
            }
          } catch (error) {
            console.error(`Failed to fetch metadata for segment ${segment.id}:`, error)
          }
        })
      )

      return Array.from(songsMap.values())
    },
    enabled: !!lensHandle,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  })
}
