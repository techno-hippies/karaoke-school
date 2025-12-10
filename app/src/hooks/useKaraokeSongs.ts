import { createQuery } from '@tanstack/solid-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { buildManifest, fetchJson, getBestUrl } from '@/lib/storage'

/**
 * Karaoke song data structure for library/feed display
 */
export interface KaraokeSong {
  spotifyTrackId: string
  title: string
  title_zh?: string  // Chinese
  title_vi?: string  // Vietnamese
  title_id?: string  // Indonesian
  title_ja?: string  // Japanese
  title_ko?: string  // Korean
  title_es?: string  // Spanish
  title_pt?: string  // Portuguese
  title_ar?: string  // Arabic
  title_tr?: string  // Turkish
  title_ru?: string  // Russian
  title_hi?: string  // Hindi
  title_th?: string  // Thai
  artist: string
  artist_zh?: string  // Chinese
  artist_vi?: string  // Vietnamese
  artist_id?: string  // Indonesian
  artist_ja?: string  // Japanese
  artist_ko?: string  // Korean
  artist_es?: string  // Spanish
  artist_pt?: string  // Portuguese
  artist_ar?: string  // Arabic
  artist_tr?: string  // Turkish
  artist_ru?: string  // Russian
  artist_hi?: string  // Hindi
  artist_th?: string  // Thai
  artworkUrl?: string
  hasInstrumental: boolean
  hasAlignments: boolean
  translationCount: number
  performanceCount: number
  totalSegments: number
  firstSegmentAt: string
  lastUpdatedAt?: string
  metadataUri?: string
}

/**
 * Search/filter options
 */
export interface SearchOptions {
  hasInstrumental?: boolean
  first?: number
  skip?: number
}

/**
 * GraphQL query to get karaoke songs with clips
 */
const GET_KARAOKE_SONGS_QUERY = gql`
  query GetKaraokeSongs(
    $hasInstrumental: Boolean
    $first: Int
    $skip: Int
  ) {
    clips(
      where: {
        hasInstrumental: $hasInstrumental
      }
      orderBy: processedAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      clipHash
      spotifyTrackId
      hasInstrumental
      hasAlignments
      translationCount
      performanceCount
      instrumentalUri
      alignmentUri
      metadataUri
      registeredAt
      processedAt
      title
      artist
      coverUri
      thumbnailUri
    }
  }
`

/**
 * GraphQL query for search functionality
 */
const SEARCH_KARAOKE_SONGS_QUERY = gql`
  query SearchKaraokeSongs(
    $searchTerm: String!
    $hasInstrumental: Boolean
    $first: Int
    $skip: Int
  ) {
    clips(
      where: {
        hasInstrumental: $hasInstrumental
        processedAt_not: null
        or: [
          { title_contains_nocase: $searchTerm }
          { artist_contains_nocase: $searchTerm }
        ]
      }
      orderBy: processedAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      clipHash
      spotifyTrackId
      hasInstrumental
      hasAlignments
      translationCount
      performanceCount
      instrumentalUri
      alignmentUri
      metadataUri
      registeredAt
      processedAt
      title
      artist
      coverUri
      thumbnailUri
    }
  }
`

interface ClipResult {
  id: string
  clipHash: string
  spotifyTrackId: string
  hasInstrumental: boolean
  hasAlignments: boolean
  translationCount: number
  performanceCount: number
  instrumentalUri?: string
  alignmentUri?: string
  metadataUri?: string
  registeredAt: string
  processedAt?: string
  title?: string
  artist?: string
  coverUri?: string
  thumbnailUri?: string
}

/**
 * Get best URL for cover art using storage layer
 */
function getCoverUrl(coverUri: string | undefined): string | undefined {
  if (!coverUri) return undefined
  const manifest = buildManifest(coverUri)
  return getBestUrl(manifest) ?? undefined
}

/**
 * Group clips by Spotify track ID to create song entities
 */
function groupClipsBySpotifyTrack(clips: ClipResult[]): KaraokeSong[] {
  const grouped = clips.reduce((acc, clip) => {
    const trackId = clip.spotifyTrackId

    if (!acc[trackId]) {
      acc[trackId] = {
        spotifyTrackId: trackId,
        title: clip.title || `Track ${trackId.slice(0, 8)}`,
        artist: clip.artist || 'Unknown Artist',
        artworkUrl: getCoverUrl(clip.coverUri),
        hasInstrumental: false,
        hasAlignments: false,
        translationCount: 0,
        performanceCount: 0,
        totalSegments: 0,
        firstSegmentAt: clip.registeredAt,
        lastUpdatedAt: clip.processedAt,
        metadataUri: clip.metadataUri
      }
    }

    const song = acc[trackId]
    song.totalSegments += 1

    // Update availability flags
    if (clip.hasInstrumental) song.hasInstrumental = true
    if (clip.hasAlignments) song.hasAlignments = true

    // Aggregate counts
    song.translationCount = Math.max(song.translationCount, clip.translationCount)
    song.performanceCount += clip.performanceCount

    // Track latest update
    if (clip.processedAt && (!song.lastUpdatedAt || clip.processedAt > song.lastUpdatedAt)) {
      song.lastUpdatedAt = clip.processedAt
    }

    // Use best metadata available
    if (clip.title && song.title.startsWith('Track ')) {
      song.title = clip.title
    }
    if (clip.artist && song.artist === 'Unknown Artist') {
      song.artist = clip.artist
    }
    if (clip.coverUri && !song.artworkUrl) {
      song.artworkUrl = getCoverUrl(clip.coverUri)
    }

    return acc
  }, {} as Record<string, KaraokeSong>)

  return Object.values(grouped)
}

/**
 * Filter out incomplete/placeholder songs
 */
function filterSongsByQuality(songs: KaraokeSong[], isSearch: boolean = false): KaraokeSong[] {
  if (!isSearch) {
    // For trending/default view: Show recent songs even with incomplete metadata
    return songs
  }

  // For search: Be more strict
  return songs.filter(song => {
    if (song.title.startsWith('Track ') || song.title.startsWith('Work ')) return false
    if (song.artist === 'Unknown Artist') return false
    return true
  })
}

/**
 * Fetch karaoke songs (trending/default view)
 */
async function getKaraokeSongs(options: SearchOptions = {}): Promise<KaraokeSong[]> {
  const { hasInstrumental = true, first = 50, skip = 0 } = options

  const data = await graphClient.request<{ clips: ClipResult[] }>(
    GET_KARAOKE_SONGS_QUERY,
    { hasInstrumental, first, skip }
  )

  const songs = groupClipsBySpotifyTrack(data.clips)
  return filterSongsByQuality(songs, false)
}

/**
 * Search karaoke songs by term
 */
async function searchKaraokeSongs(searchTerm: string, options: SearchOptions = {}): Promise<KaraokeSong[]> {
  const { hasInstrumental = true, first = 50, skip = 0 } = options

  const data = await graphClient.request<{ clips: ClipResult[] }>(
    SEARCH_KARAOKE_SONGS_QUERY,
    { searchTerm, hasInstrumental, first, skip }
  )

  const songs = groupClipsBySpotifyTrack(data.clips)
  return filterSongsByQuality(songs, true)
}

/**
 * Hook for fetching karaoke songs (library/trending view)
 */
export function useKaraokeSongs(options: () => SearchOptions = () => ({})) {
  return createQuery(() => ({
    queryKey: ['karaoke-songs', options()],
    queryFn: () => getKaraokeSongs(options()),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }))
}

/**
 * Hook for searching karaoke songs
 */
export function useKaraokeSongsSearch(searchTerm: () => string, options: () => SearchOptions = () => ({})) {
  return createQuery(() => ({
    queryKey: ['karaoke-songs-search', searchTerm(), options()],
    queryFn: async () => {
      const term = searchTerm()
      if (!term.trim()) {
        return getKaraokeSongs(options())
      }
      return searchKaraokeSongs(term, options())
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }))
}

/**
 * Hook for fetching metadata and enriching songs
 */
async function enrichSongWithMetadata(song: KaraokeSong): Promise<KaraokeSong> {
  if (!song.metadataUri) return song

  try {
    // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
    const manifest = buildManifest(song.metadataUri)
    const metadata = await fetchJson<any>(manifest)
    return {
      ...song,
      title: metadata.title || song.title,
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
      artist: metadata.artist || song.artist,
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
      artworkUrl: metadata.coverUri ? getCoverUrl(metadata.coverUri) : song.artworkUrl
    }
  } catch {
    return song
  }
}

/**
 * Hook that fetches songs and enriches with Grove metadata
 * Waits for enrichment to complete before returning data (no flash of English)
 */
export function useKaraokeSongsWithMetadata(options: () => SearchOptions = () => ({})) {
  const songsQuery = useKaraokeSongs(options)

  const enrichedQuery = createQuery(() => ({
    queryKey: ['karaoke-songs-metadata', songsQuery.data?.map(s => s.spotifyTrackId)],
    queryFn: async () => {
      if (!songsQuery.data) return []
      return Promise.all(songsQuery.data.map(enrichSongWithMetadata))
    },
    enabled: !!songsQuery.data && songsQuery.data.length > 0,
    staleTime: 300000,
  }))

  return {
    get data() {
      // Only return data after enrichment is complete (no flash)
      return enrichedQuery.data
    },
    get isLoading() {
      // Loading until enrichment is done
      return songsQuery.isLoading || (songsQuery.data && songsQuery.data.length > 0 && enrichedQuery.isLoading)
    },
    get error() {
      return songsQuery.error
    },
  }
}
