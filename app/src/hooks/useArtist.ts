import { createQuery } from '@tanstack/solid-query'
import { SUBGRAPH_URL } from '@/lib/graphql/client'
import { buildManifest, fetchJson } from '@/lib/storage'
import type { Accessor } from 'solid-js'

export interface ArtistSong {
  spotifyTrackId: string
  title: string
  // 12 language translations
  title_zh?: string
  title_vi?: string
  title_id?: string
  title_ja?: string
  title_ko?: string
  title_es?: string
  title_pt?: string
  title_ar?: string
  title_tr?: string
  title_ru?: string
  title_hi?: string
  title_th?: string
  artist: string
  // 12 language translations
  artist_zh?: string
  artist_vi?: string
  artist_id?: string
  artist_ja?: string
  artist_ko?: string
  artist_es?: string
  artist_pt?: string
  artist_ar?: string
  artist_tr?: string
  artist_ru?: string
  artist_hi?: string
  artist_th?: string
  artistSlug: string
  songSlug: string
  coverUri?: string
}

export interface ArtistData {
  name: string
  // 12 language translations
  name_zh?: string
  name_vi?: string
  name_id?: string
  name_ja?: string
  name_ko?: string
  name_es?: string
  name_pt?: string
  name_ar?: string
  name_tr?: string
  name_ru?: string
  name_hi?: string
  name_th?: string
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
      // 12 language translations
      let artistName_zh: string | undefined
      let artistName_vi: string | undefined
      let artistName_id: string | undefined
      let artistName_ja: string | undefined
      let artistName_ko: string | undefined
      let artistName_es: string | undefined
      let artistName_pt: string | undefined
      let artistName_ar: string | undefined
      let artistName_tr: string | undefined
      let artistName_ru: string | undefined
      let artistName_hi: string | undefined
      let artistName_th: string | undefined
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
                // 12 language translations
                artistName_zh = metadata.artist_zh
                artistName_vi = metadata.artist_vi
                artistName_id = metadata.artist_id
                artistName_ja = metadata.artist_ja
                artistName_ko = metadata.artist_ko
                artistName_es = metadata.artist_es
                artistName_pt = metadata.artist_pt
                artistName_ar = metadata.artist_ar
                artistName_tr = metadata.artist_tr
                artistName_ru = metadata.artist_ru
                artistName_hi = metadata.artist_hi
                artistName_th = metadata.artist_th
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
                  // 12 language translations
                  title_zh: metadata.title_zh,
                  title_vi: metadata.title_vi,
                  title_id: metadata.title_id,
                  title_ja: metadata.title_ja,
                  title_ko: metadata.title_ko,
                  title_es: metadata.title_es,
                  title_pt: metadata.title_pt,
                  title_ar: metadata.title_ar,
                  title_tr: metadata.title_tr,
                  title_ru: metadata.title_ru,
                  title_hi: metadata.title_hi,
                  title_th: metadata.title_th,
                  artist: metadata.artist || 'Unknown Artist',
                  // 12 language translations
                  artist_zh: metadata.artist_zh,
                  artist_vi: metadata.artist_vi,
                  artist_id: metadata.artist_id,
                  artist_ja: metadata.artist_ja,
                  artist_ko: metadata.artist_ko,
                  artist_es: metadata.artist_es,
                  artist_pt: metadata.artist_pt,
                  artist_ar: metadata.artist_ar,
                  artist_tr: metadata.artist_tr,
                  artist_ru: metadata.artist_ru,
                  artist_hi: metadata.artist_hi,
                  artist_th: metadata.artist_th,
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
        // 12 language translations
        name_zh: artistName_zh,
        name_vi: artistName_vi,
        name_id: artistName_id,
        name_ja: artistName_ja,
        name_ko: artistName_ko,
        name_es: artistName_es,
        name_pt: artistName_pt,
        name_ar: artistName_ar,
        name_tr: artistName_tr,
        name_ru: artistName_ru,
        name_hi: artistName_hi,
        name_th: artistName_th,
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
