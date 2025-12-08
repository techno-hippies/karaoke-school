import { createQuery } from '@tanstack/solid-query'
import { SUBGRAPH_URL } from '@/lib/graphql/client'
import { buildManifest, fetchJson } from '@/lib/storage'
import type { Accessor } from 'solid-js'

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
 * Fetch artist data by slug (SolidJS)
 * Queries subgraph for clips, fetches metadata, and groups by artist
 */
export function useArtist(artistSlug: Accessor<string | undefined>) {
  const query = createQuery(() => ({
    queryKey: ['artist-by-slug', artistSlug()],
    queryFn: async (): Promise<ArtistData | null> => {
      const slug = artistSlug()
      if (!slug) {
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
            // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
            const manifest = buildManifest(clip.metadataUri)
            const metadata = await fetchJson<any>(manifest)

            // Check if this clip belongs to the artist we're looking for
            const clipArtistSlug = metadata.artistSlug || generateSlug(metadata.artist || '')

            if (clipArtistSlug === slug) {
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
        slug,
        imageUrl: artistImageUrl,
        songs: artistSongs,
      }
    },
    enabled: !!artistSlug(),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  }))

  return {
    get data() { return query.data },
    get isLoading() { return query.isLoading },
    get error() { return query.error },
  }
}
