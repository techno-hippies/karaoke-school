/**
 * useStudentLeaderboard Hook
 *
 * Fetches student leaderboard data for a song from Grove storage.
 * Leaderboard data is populated by a background indexer service that:
 * 1. Listens for SongUnlocked events from KaraokeCreditsV1
 * 2. Aggregates student scores per song
 * 3. Uploads to Grove
 * 4. Updates contract with Grove URI
 *
 * Usage:
 * ```ts
 * const { leaderboard, isLoading } = useStudentLeaderboard(geniusId)
 * ```
 */

import { useReadContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'
import { KARAOKE_CATALOG_ABI } from '@/config/abis/karaokeCatalog'

export interface StudentScore {
  address: string
  segmentsCompleted: number
  totalSegments: number
  unlockedAt: number
  completionPercentage: number
  // Optional: Lens profile data (populated by indexer)
  lensUsername?: string
  lensAvatar?: string
}

export interface SongLeaderboard {
  geniusId: number
  songTitle: string
  artist: string
  artworkUrl: string
  students: StudentScore[]
  totalStudents: number
  averageCompletion: number
  updatedAt: number
  version: number
}

/**
 * Helper: Convert lens:// URI to Grove HTTPS URL
 */
function lensToGroveUrl(uri: string): string {
  if (!uri) return ''
  const lower = uri.toLowerCase()
  if (!lower.startsWith('lens') && !lower.startsWith('glen')) return uri

  // Remove lens:// prefix and any trailing :number suffix
  const hash = uri
    .replace(/^(lens|glens?):\/\//i, '')
    .replace(/:\d+$/, '') // Strip trailing :1, :2, etc.

  return `https://api.grove.storage/${hash}`
}

/**
 * Hook to fetch student leaderboard for a song
 */
export function useStudentLeaderboard(geniusId: number | undefined) {
  // 1. Get leaderboard URI from contract
  const { data: leaderboardUri, isLoading: isLoadingUri, refetch: refetchUri } = useReadContract({
    address: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'getLeaderboardUri',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId && geniusId > 0,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  })

  // 2. Fetch leaderboard JSON from Grove
  const { data: leaderboard, isLoading: isLoadingData, error, refetch: refetchData } = useQuery({
    queryKey: ['leaderboard', geniusId, leaderboardUri],
    queryFn: async (): Promise<SongLeaderboard | null> => {
      if (!leaderboardUri || leaderboardUri === '') {
        return null
      }

      const groveUrl = lensToGroveUrl(leaderboardUri as string)
      console.log('[useStudentLeaderboard] Fetching from Grove:', groveUrl)

      const response = await fetch(groveUrl)

      if (!response.ok) {
        if (response.status === 404) {
          // Leaderboard not yet uploaded by indexer
          console.log('[useStudentLeaderboard] Leaderboard not found (404) - not yet indexed')
          return null
        }
        throw new Error(`Failed to fetch leaderboard: ${response.status}`)
      }

      const data = await response.json()
      console.log('[useStudentLeaderboard] Loaded leaderboard:', {
        geniusId: data.geniusId,
        totalStudents: data.totalStudents,
        updatedAt: new Date(data.updatedAt)
      })

      return data as SongLeaderboard
    },
    enabled: !!leaderboardUri && (leaderboardUri as string) !== '',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (leaderboard not created yet)
      if (error?.message?.includes('404')) return false
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
  })

  const refetch = async () => {
    await refetchUri()
    await refetchData()
  }

  return {
    leaderboard,
    isLoading: isLoadingUri || isLoadingData,
    error,
    refetch,
    // Computed helpers
    hasLeaderboard: !!leaderboardUri && (leaderboardUri as string) !== '',
    hasData: !!leaderboard,
    studentCount: leaderboard?.totalStudents || 0,
  }
}

/**
 * Hook to check if a user is on the leaderboard
 */
export function useUserRank(geniusId: number | undefined, userAddress: string | undefined) {
  const { leaderboard, isLoading } = useStudentLeaderboard(geniusId)

  const userRank = leaderboard && userAddress
    ? leaderboard.students.findIndex(
        s => s.address.toLowerCase() === userAddress.toLowerCase()
      ) + 1 // +1 because findIndex returns 0-based index
    : 0

  const userScore = leaderboard && userAddress
    ? leaderboard.students.find(
        s => s.address.toLowerCase() === userAddress.toLowerCase()
      )
    : undefined

  return {
    rank: userRank > 0 ? userRank : undefined,
    score: userScore,
    isOnLeaderboard: userRank > 0,
    isLoading,
  }
}
