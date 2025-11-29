/**
 * useLeaderboard - Fetches and calculates leaderboard rankings from subgraph
 *
 * Point System:
 * - Base points: score / 100 (0-100 points per activity)
 * - FSRS rating bonus: +0 (Again), +5 (Hard), +15 (Good), +30 (Easy)
 * - Streak multiplier: 1.0 to 2.0x based on consecutive days
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { gql } from 'graphql-request'
import { evmAddress } from '@lens-protocol/client'
import { fetchAccountsAvailable } from '@lens-protocol/client/actions'
import { graphClient } from '@/lib/graphql/client'
import { lensClient } from '@/lib/lens/client'

// Point system constants
const RATING_BONUS = {
  0: 0,   // Again - no bonus
  1: 5,   // Hard - small bonus
  2: 15,  // Good - solid bonus
  3: 30,  // Easy - mastery bonus
} as const

// Get streak multiplier (1.0 to 2.0x)
function getStreakMultiplier(streakDays: number): number {
  return Math.min(2.0, 1 + (streakDays * 0.1))
}

// Calculate consecutive days streak from timestamps
function calculateStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0

  // Sort descending (most recent first)
  const sorted = [...timestamps].sort((a, b) => b - a)

  // Get unique days (convert to day boundaries)
  const uniqueDays = new Set(
    sorted.map(ts => Math.floor(ts / 86400)) // Convert to day number
  )

  const days = Array.from(uniqueDays).sort((a, b) => b - a)
  if (days.length === 0) return 0

  // Check if most recent activity was today or yesterday
  const today = Math.floor(Date.now() / 1000 / 86400)
  if (days[0] < today - 1) {
    return 0 // Streak broken (no activity yesterday or today)
  }

  // Count consecutive days
  let streak = 1
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// GraphQL query for song-specific leaderboard data (subgraph only - no accounts)
const GET_SONG_LEADERBOARD_DATA = gql`
  query GetSongLeaderboardData($spotifyTrackId: String!) {
    exerciseAttempts(
      where: { card_: { spotifyTrackId: $spotifyTrackId } }
      first: 1000
      orderBy: gradedAt
      orderDirection: desc
    ) {
      id
      performerAddress
      score
      rating
      gradedAt
    }
    karaokeSessions(
      where: { clip_: { spotifyTrackId: $spotifyTrackId } }
      first: 100
      orderBy: startedAt
      orderDirection: desc
    ) {
      id
      performer
      aggregateScore
      completedLineCount
      isCompleted
      startedAt
      endedAt
    }
  }
`

export interface LeaderboardEntry {
  rank: number
  address: string
  username: string
  totalPoints: number
  karaokeAvg: number
  exerciseCount: number
  currentStreak: number
  bestScore: number
}

export interface UseSongLeaderboardResult {
  leaderboard: LeaderboardEntry[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Fetch username from Lens by PKP address (owner)
async function fetchUsernameFromLens(pkpAddress: string): Promise<string | null> {
  try {
    const result = await fetchAccountsAvailable(lensClient, {
      managedBy: evmAddress(pkpAddress),
    })

    if (result.isErr()) {
      console.warn('[useLeaderboard] Lens query error:', result.error)
      return null
    }

    // Find first account with metadata.name
    for (const item of result.value.items) {
      if ('account' in item && item.account?.metadata?.name) {
        return item.account.metadata.name
      }
    }

    return null
  } catch (err) {
    console.warn('[useLeaderboard] Failed to fetch username from Lens:', err)
    return null
  }
}

/**
 * Hook to fetch song-specific leaderboard data
 * @param spotifyTrackId - Spotify track ID to filter leaderboard
 */
export function useSongLeaderboard(spotifyTrackId?: string): UseSongLeaderboardResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [usernameMap, setUsernameMap] = useState<Map<string, string>>(new Map())

  const refetch = useCallback(async () => {
    if (!spotifyTrackId) {
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await graphClient.request(GET_SONG_LEADERBOARD_DATA, {
        spotifyTrackId,
      })
      setData(response)
    } catch (err) {
      console.error('[useSongLeaderboard] Error fetching leaderboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard')
    } finally {
      setIsLoading(false)
    }
  }, [spotifyTrackId])

  // Fetch when spotifyTrackId changes
  useEffect(() => {
    if (spotifyTrackId) {
      refetch()
    }
  }, [spotifyTrackId, refetch])

  // Compute preliminary leaderboard to identify top performers
  const preliminaryLeaderboard = useMemo(() => {
    if (!data) return []

    // Aggregate data by performer address
    const performerMap = new Map<string, {
      address: string
      exerciseScores: number[]
      exerciseRatings: number[]
      karaokeScores: number[]
      timestamps: number[]
    }>()

    for (const attempt of data.exerciseAttempts || []) {
      const address = attempt.performerAddress?.toLowerCase()
      if (!address) continue
      if (!performerMap.has(address)) {
        performerMap.set(address, { address, exerciseScores: [], exerciseRatings: [], karaokeScores: [], timestamps: [] })
      }
      const p = performerMap.get(address)!
      p.exerciseScores.push(parseInt(attempt.score) || 0)
      p.exerciseRatings.push(parseInt(attempt.rating) || 0)
      p.timestamps.push(parseInt(attempt.gradedAt) || 0)
    }

    for (const session of data.karaokeSessions || []) {
      const address = session.performer?.toLowerCase()
      if (!address) continue
      if (!performerMap.has(address)) {
        performerMap.set(address, { address, exerciseScores: [], exerciseRatings: [], karaokeScores: [], timestamps: [] })
      }
      const p = performerMap.get(address)!
      if (session.isCompleted && session.aggregateScore) {
        p.karaokeScores.push(parseInt(session.aggregateScore) || 0)
      }
      const ts = parseInt(session.endedAt || session.startedAt) || 0
      if (ts > 0) p.timestamps.push(ts)
    }

    // Calculate points and sort
    return Array.from(performerMap.values())
      .map((p) => {
        const streak = calculateStreak(p.timestamps)
        const karaokePoints = p.karaokeScores.reduce((sum, s) => sum + Math.floor(s / 100), 0)
        const exercisePoints = p.exerciseScores.reduce((sum, s, i) => {
          const rating = p.exerciseRatings[i] || 0
          return sum + Math.floor(s / 100) + (RATING_BONUS[rating as keyof typeof RATING_BONUS] || 0)
        }, 0)
        const totalPoints = Math.floor((karaokePoints + exercisePoints) * getStreakMultiplier(streak))
        return { address: p.address, totalPoints }
      })
      .filter((e) => e.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10) // Top 10 only
  }, [data])

  // Fetch usernames from Lens only for top 10 performers
  useEffect(() => {
    if (preliminaryLeaderboard.length === 0) return

    const addresses = preliminaryLeaderboard.map((e) => e.address)

    const fetchUsernames = async () => {
      const newMap = new Map<string, string>()

      await Promise.all(
        addresses.map(async (addr) => {
          const username = await fetchUsernameFromLens(addr)
          if (username) {
            newMap.set(addr, username)
          }
        })
      )

      if (newMap.size > 0) {
        console.log('[useLeaderboard] Fetched usernames from Lens (top 10):', Object.fromEntries(newMap))
        setUsernameMap(newMap)
      }
    }

    fetchUsernames()
  }, [preliminaryLeaderboard])

  const leaderboard = useMemo(() => {
    if (!data) return []

    // Helper to get username (prefer Lens username, fallback to truncated address)
    const getUsername = (address: string) => {
      return usernameMap.get(address) || `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    // Aggregate data by performer address
    const performerMap = new Map<string, {
      address: string
      exerciseScores: number[]
      exerciseRatings: number[]
      karaokeScores: number[]
      timestamps: number[]
    }>()

    // Process exercise attempts
    for (const attempt of data.exerciseAttempts || []) {
      const address = attempt.performerAddress?.toLowerCase()
      if (!address) continue

      if (!performerMap.has(address)) {
        performerMap.set(address, {
          address,
          exerciseScores: [],
          exerciseRatings: [],
          karaokeScores: [],
          timestamps: [],
        })
      }

      const performer = performerMap.get(address)!
      performer.exerciseScores.push(parseInt(attempt.score) || 0)
      performer.exerciseRatings.push(parseInt(attempt.rating) || 0)
      performer.timestamps.push(parseInt(attempt.gradedAt) || 0)
    }

    // Process karaoke sessions
    for (const session of data.karaokeSessions || []) {
      const address = session.performer?.toLowerCase()
      if (!address) continue

      if (!performerMap.has(address)) {
        performerMap.set(address, {
          address,
          exerciseScores: [],
          exerciseRatings: [],
          karaokeScores: [],
          timestamps: [],
        })
      }

      const performer = performerMap.get(address)!
      if (session.isCompleted && session.aggregateScore) {
        performer.karaokeScores.push(parseInt(session.aggregateScore) || 0)
      }
      const ts = parseInt(session.endedAt || session.startedAt) || 0
      if (ts > 0) {
        performer.timestamps.push(ts)
      }
    }

    // Calculate points for each performer
    const entries: LeaderboardEntry[] = Array.from(performerMap.values())
      .map((performer) => {
        const currentStreak = calculateStreak(performer.timestamps)

        // Calculate points from karaoke
        const karaokePoints = performer.karaokeScores.reduce((sum, score) => {
          return sum + Math.floor(score / 100)
        }, 0)

        // Calculate points from exercises (with rating bonus)
        const exercisePoints = performer.exerciseScores.reduce((sum, score, i) => {
          const rating = performer.exerciseRatings[i] || 0
          const base = Math.floor(score / 100)
          const bonus = RATING_BONUS[rating as keyof typeof RATING_BONUS] || 0
          return sum + base + bonus
        }, 0)

        // Apply streak multiplier
        const multiplier = getStreakMultiplier(currentStreak)
        const totalPoints = Math.floor((karaokePoints + exercisePoints) * multiplier)

        // Calculate averages
        const karaokeAvg = performer.karaokeScores.length > 0
          ? performer.karaokeScores.reduce((a, b) => a + b, 0) / performer.karaokeScores.length
          : 0

        const bestScore = Math.max(0, ...performer.karaokeScores, ...performer.exerciseScores)

        return {
          rank: 0,
          address: performer.address,
          username: getUsername(performer.address),
          totalPoints,
          karaokeAvg,
          exerciseCount: performer.exerciseScores.length,
          currentStreak,
          bestScore,
        }
      })
      .filter((entry) => entry.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10) // Top 10 only
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))

    return entries
  }, [data, usernameMap])

  return { leaderboard, isLoading, error, refetch }
}
