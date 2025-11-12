import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Song metadata from Grove
 */
export interface SongMetadata {
  version: string
  type: string
  geniusId: number
  title: string
  artist: string
  artistLensHandle?: string // Lens handle for artist (e.g., "pitbull-ks1")
  duration: number
  coverUri: string
  registeredBy: string
  spotifyId?: string
  geniusArtistId?: number
  artistAccount?: string
}

/**
 * Fetch song metadata from Grove storage
 *
 * @param metadataUri - Grove URI (lens://...)
 * @returns Song metadata including title, artist, cover
 */
export function useGroveSongMetadata(metadataUri?: string) {
  return useQuery({
    queryKey: ['grove-song-metadata', metadataUri],
    queryFn: async () => {
      if (!metadataUri) {
        throw new Error('Metadata URI is required')
      }

      const httpUrl = convertGroveUri(metadataUri)
      const response = await fetch(httpUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch song metadata: ${response.status}`)
      }

      const data = await response.json() as SongMetadata
      return data
    },
    enabled: !!metadataUri,
    staleTime: 300000, // 5 minutes (song metadata is immutable)
    refetchOnWindowFocus: false,
  })
}
