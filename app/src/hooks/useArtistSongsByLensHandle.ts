import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'
import { SUBGRAPH_URL } from '@/lib/graphql/client'

export interface ArtistSong {
  spotifyTrackId: string
  title: string
  artist: string
  coverUri?: string
}

/**
 * Fetch songs for an artist by their Lens handle
 */
export function useArtistSongsByLensHandle(lensHandle?: string) {
  return useQuery({
    queryKey: ['artist-songs-by-lens-handle', lensHandle],
    queryFn: async () => {
      if (!lensHandle) {
        throw new Error('Lens handle is required')
      }

      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetAllClips {
              clips(first: 1000, orderBy: registeredAt, orderDirection: desc) {
                id
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

      const songsMap = new Map<string, ArtistSong>()

      await Promise.all(
        data.clips.map(async (clip: any) => {
          try {
            const metadataResponse = await fetch(clip.metadataUri)
            const metadata = await metadataResponse.json()

            if (metadata.artistLensHandle === lensHandle) {
              if (!songsMap.has(clip.spotifyTrackId)) {
                songsMap.set(clip.spotifyTrackId, {
                  spotifyTrackId: clip.spotifyTrackId,
                  title: metadata.title || 'Untitled',
                  artist: metadata.artist || 'Unknown Artist',
                  coverUri: metadata.coverUri ? convertGroveUri(metadata.coverUri) : undefined,
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
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })
}
