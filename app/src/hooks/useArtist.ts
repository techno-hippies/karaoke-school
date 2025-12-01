import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'
import { SUBGRAPH_URL } from '@/lib/graphql/client'

export interface ArtistSong {
  spotifyTrackId: string
  title: string
  artist: string
  artistSlug: string
  songSlug: string
  coverUri?: string
}

export interface ArtistData {
  name: string
  slug: string
  imageUrl?: string
  songs: ArtistSong[]
}

/**
 * Generate URL-safe slug from text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

/**
 * Fetch artist data by slug
 * Queries subgraph for clips, fetches metadata, and groups by artist
 */
export function useArtist(artistSlug?: string) {
  return useQuery({
    queryKey: ['artist-by-slug', artistSlug],
    queryFn: async (): Promise<ArtistData | null> => {
      if (!artistSlug) {
        return null
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
        return null
      }

      const artistSongs: ArtistSong[] = []
      let artistName = ''
      let artistImageUrl: string | undefined

      // Fetch metadata for each clip and filter by artistSlug
      const seenTracks = new Set<string>()

      await Promise.all(
        data.clips.map(async (clip: any) => {
          try {
            const metadataUrl = clip.metadataUri.startsWith('lens://')
              ? convertGroveUri(clip.metadataUri)
              : clip.metadataUri

            const metadataResponse = await fetch(metadataUrl)
            const metadata = await metadataResponse.json()

            // Check if this clip belongs to the artist we're looking for
            const clipArtistSlug = metadata.artistSlug || generateSlug(metadata.artist || '')

            if (clipArtistSlug === artistSlug) {
              // Set artist name and image from first matching clip
              if (!artistName && metadata.artist) {
                artistName = metadata.artist
              }

              // Get artist image from metadata (uploaded to Grove from Spotify)
              if (!artistImageUrl && metadata.artistImageUri) {
                artistImageUrl = metadata.artistImageUri
              }

              // Track unique songs by Spotify ID
              if (!seenTracks.has(clip.spotifyTrackId)) {
                seenTracks.add(clip.spotifyTrackId)

                const songSlug = generateSlug(metadata.title || '')

                artistSongs.push({
                  spotifyTrackId: clip.spotifyTrackId,
                  title: metadata.title || 'Untitled',
                  artist: metadata.artist || 'Unknown Artist',
                  artistSlug: clipArtistSlug,
                  songSlug,
                  coverUri: metadata.coverUri || metadata.thumbnailUri,
                })
              }
            }
          } catch (error) {
            console.error(`Failed to fetch metadata for clip ${clip.id}:`, error)
          }
        })
      )

      if (artistSongs.length === 0) {
        return null
      }

      return {
        name: artistName,
        slug: artistSlug,
        imageUrl: artistImageUrl,
        songs: artistSongs,
      }
    },
    enabled: !!artistSlug,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  })
}

