import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Karaoke song data structure for search results
 */
export interface KaraokeSong {
  grc20WorkId: string
  spotifyTrackId: string
  title: string
  artist: string
  artworkUrl?: string
  
  // Segment availability
  hasInstrumental: boolean
  hasAlignments: boolean
  translationCount: number
  performanceCount: number
  totalSegments: number
  
  // Metadata
  firstSegmentAt: string
  lastUpdatedAt?: string
}

/**
 * Search options
 */
export interface SearchOptions {
  hasInstrumental?: boolean
  first?: number
  skip?: number
}

/**
 * GraphQL query to get karaoke songs with clips
 * This queries clips and groups them by grc20WorkId (local schema)
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
        processedAt_not: null
      }
      orderBy: registeredAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      clipHash
      grc20WorkId
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
    }
  }
`

/**
 * GraphQL query for search functionality (local schema)
 * Search by spotifyTrackId for now
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
        spotifyTrackId_contains: $searchTerm
      }
      orderBy: registeredAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      clipHash
      grc20WorkId
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
    }
  }
`

/**
 * Fetch karaoke songs with segments (trending/default view)
 */
async function getKaraokeSongs(options: SearchOptions = {}): Promise<KaraokeSong[]> {
  const {
    hasInstrumental = true,
    first = 20,
    skip = 0
  } = options

  const data = await graphClient.request<{ clips: any[] }>(
    GET_KARAOKE_SONGS_QUERY,
    { hasInstrumental, first, skip }
  )

  const songs = groupClipsByWork(data.clips)

  // For trending/default view: Show recent songs even with incomplete metadata
  return filterSongsByQuality(songs, false)
}

/**
 * Search karaoke songs by term
 */
async function searchKaraokeSongs(
  searchTerm: string,
  options: SearchOptions = {}
): Promise<KaraokeSong[]> {
  const {
    hasInstrumental = true,
    first = 20,
    skip = 0
  } = options

  const data = await graphClient.request<{ clips: any[] }>(
    SEARCH_KARAOKE_SONGS_QUERY,
    { searchTerm, hasInstrumental, first, skip }
  )

  const songs = groupClipsByWork(data.clips)

  // For search: Be more strict to filter out poor quality results
  return filterSongsByQuality(songs, true)
}

/**
 * Filter function with different levels of strictness
 * For trending/default view, show recent songs even with incomplete metadata
 * For search, be more strict to avoid poor results
 */
function filterSongsByQuality(songs: KaraokeSong[], isSearch: boolean = false): KaraokeSong[] {
  if (!isSearch) {
    // For trending/default view: Show recent songs even with incomplete metadata
    // This helps users see what's available while metadata improves over time
    return songs
  }
  
  // For search: Be more strict to avoid poor quality results
  return songs.filter(song => {
    // Filter out songs with generic "Work [UUID]" titles
    if (song.title.startsWith('Work ') || song.title.startsWith('work ')) {
      return false
    }
    
    // Filter out songs with unknown artist
    if (song.artist === 'Unknown Artist' || song.artist === 'unknown artist') {
      return false
    }
    
    // Filter out songs without Grove metadata (still using fallback titles)
    if (!song.metadataUri) {
      return false
    }
    
    return true
  })
}

/**
 * Group clips by GRC-20 work ID to create song entities (local schema)
 * This is the key transformation from clips to songs
 */
function groupClipsByWork(clips: any[]): KaraokeSong[] {
  const grouped = clips.reduce((acc, clip) => {
    const workId = clip.grc20WorkId

    if (!acc[workId]) {
      acc[workId] = {
        grc20WorkId: workId,
        spotifyTrackId: clip.spotifyTrackId,
        clips: [],
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

    const song = acc[workId]
    song.clips.push(clip)
    song.totalSegments += 1

    // Update availability flags
    if (clip.hasInstrumental) song.hasInstrumental = true
    if (clip.hasAlignments) song.hasAlignments = true

    // Aggregate counts
    song.translationCount = Math.max(song.translationCount, clip.translationCount)
    song.performanceCount += clip.performanceCount

    // Track latest update
    if (clip.processedAt && clip.processedAt > song.lastUpdatedAt) {
      song.lastUpdatedAt = clip.processedAt
    }

    return acc
  }, {} as Record<string, any>)

  // Convert to array and fetch metadata
  return Object.values(grouped).map((song: any) => ({
    ...song,
    title: `Work ${song.grc20WorkId}`, // Will be enriched with metadata
    artist: 'Unknown Artist' // Will be enriched with metadata
  }))
}

/**
 * Fetch Grove metadata for a song (same pattern as useSongV2.ts)
 */
async function enrichSongWithMetadata(song: KaraokeSong): Promise<KaraokeSong> {
      // @ts-expect-error - metadataUri temporarily removed from type
  if (!song.metadataUri) {
    return song
  }

          // @ts-expect-error - metadataUri temporarily removed from type
  try {
    const httpUrl = convertGroveUri(song.metadataUri)
    console.log('[useKaraokeSongsSearch] Fetching Grove metadata from:', httpUrl)

    const response = await fetch(httpUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }

    const metadata = await response.json()
    console.log('[useKaraokeSongsSearch] Grove metadata:', metadata)

    return {
      ...song,
      title: metadata.title || song.title,
      artist: metadata.artist || song.artist,
      artworkUrl: metadata.coverUri ? convertGroveUri(metadata.coverUri) : undefined
    }
  } catch (error) {
    console.error('[useKaraokeSongsSearch] Failed to fetch metadata:', error)
    return song // Return original song if metadata fetch fails
  }
}

/**
 * React hook for searching karaoke songs with segments
 * 
 * @param searchTerm - Search term (empty string for trending songs)
 * @param options - Search options (filtering, pagination)
 * @returns Query result with karaoke songs data
 */
export function useKaraokeSongsSearch(
  searchTerm: string = '',
  options: SearchOptions = {}
) {
  const queryKey = ['karaoke-songs-search', searchTerm, options]

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!searchTerm.trim()) {
        // Trending/default songs
        return getKaraokeSongs(options)
      } else {
        // Search with term
        return searchKaraokeSongs(searchTerm, options)
      }
    },
    enabled: true, // Enable even for empty search (shows trending)
    staleTime: 30000, // 30 seconds
    gcTime: 300000,   // 5 minutes cache
    retry: 2,         // Retry failed queries
  })
}

/**
 * Enhanced hook that also fetches Grove metadata
 * Use this if you want to show artwork, titles, artists in search results
 */
export function useKaraokeSongsSearchWithMetadata(
  searchTerm: string = '',
  options: SearchOptions = {}
) {
  const { data: songs, isLoading, error, ...rest } = useKaraokeSongsSearch(searchTerm, options)

  const { data: enrichedSongs, isLoading: isEnriching } = useQuery({
    queryKey: ['karaoke-songs-metadata', songs?.map(s => s.grc20WorkId)],
    queryFn: async () => {
      if (!songs) return []
      return Promise.all(songs.map(song => enrichSongWithMetadata(song)))
    },
    enabled: !!songs && songs.length > 0,
    staleTime: 300000, // 5 minutes (metadata is immutable)
  })

  return {
    data: enrichedSongs || songs,
    isLoading: isLoading || isEnriching,
    error,
    ...rest
  }
}
