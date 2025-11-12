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
 * Queries the subgraph for clips with matching artistLensHandle from metadata
 *
 * @param lensHandle - The artist's Lens handle (e.g., "pitbull-ks1")
 * @returns Array of songs with metadata
 */
export function useArtistSongsByLensHandle(lensHandle?: string) {
  return useQuery({
    queryKey: ['artist-songs-by-lens-handle', lensHandle],
    queryFn: async () => {
      if (!lensHandle) {
        throw new Error('Lens handle is required')
      }

      // Query subgraph for all clips
      // Then filter by fetching metadata and checking artistLensHandle
      const SUBGRAPH_ENDPOINT = 'http://localhost:8000/subgraphs/name/subgraph-0'

      const response = await fetch(SUBGRAPH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetAllClips {
              clips(first: 1000, orderBy: registeredAt, orderDirection: desc) {
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

      if (!data?.clips) {
        return []
      }

      // Fetch metadata for each clip and filter by artistLensHandle
      const songsMap = new Map<string, ArtistSong>()

      await Promise.all(
        data.clips.map(async (clip: any) => {
          try {
            const metadataResponse = await fetch(clip.metadataUri)
            const metadata = await metadataResponse.json()

            // Check if this clip belongs to the artist
            if (metadata.artistLensHandle === lensHandle) {
              // Only add unique works (by grc20WorkId)
              if (!songsMap.has(clip.grc20WorkId)) {
                songsMap.set(clip.grc20WorkId, {
                  grc20WorkId: clip.grc20WorkId,
                  title: metadata.title || 'Untitled',
                  artist: metadata.artist || 'Unknown Artist',
                  coverUri: metadata.coverUri ? convertGroveUri(metadata.coverUri) : undefined,
                  spotifyTrackId: clip.spotifyTrackId
                })
              }
            }
          } catch (error) {
            console.error(`Failed to fetch metadata for clip ${clip.id}:`, error)
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
