/**
 * useArtistLeaderboard - Fetches leaderboard data for all songs by an artist
 *
 * Lazy-loaded: Only fetches when explicitly triggered via refetch()
 * Aggregates data across multiple spotify track IDs
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { gql } from 'graphql-request'
import { evmAddress } from '@lens-protocol/client'
import { fetchAccountsAvailable } from '@lens-protocol/client/actions'
import { graphClient } from '@/lib/graphql/client'
import { lensClient } from '@/lib/lens/client'

// Point system constants (same as useSongLeaderboard)
const RATING_BONUS = {
  0: 0,   // Again - no bonus
  1: 5,   // Hard - small bonus
  2: 15,  // Good - solid bonus
  3: 30,  // Easy - mastery bonus
} as const

function getStreakMultiplier(streakDays: number): number {
  return Math.min(2.0, 1 + (streakDays * 0.1))
}

function calculateStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0
  const sorted = [...timestamps].sort((a, b) => b - a)
  const uniqueDays = new Set(sorted.map(ts => Math.floor(ts / 86400)))
  const days = Array.from(uniqueDays).sort((a, b) => b - a)
  if (days.length === 0) return 0

  const today = Math.floor(Date.now() / 1000 / 86400)
  if (days[0] < today - 1) return 0

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

// Query for multiple spotify track IDs using _in filter
const GET_ARTIST_LEADERBOARD_DATA = gql`
  query GetArtistLeaderboardData($spotifyTrackIds: [String!]!) {
    exerciseAttempts(
      where: { card_: { spotifyTrackId_in: $spotifyTrackIds } }
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
      where: { clip_: { spotifyTrackId_in: $spotifyTrackIds } }
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

export interface ArtistLeaderboardEntry {
  rank: number
  address: string
  username: string
  totalPoints: number
  karaokeAvg: number
  exerciseCount: number
  currentStreak: number
  bestScore: number
}

export interface UseArtistLeaderboardResult {
  leaderboard: ArtistLeaderboardEntry[]
  isLoading: boolean
  error: string | null
  hasLoaded: boolean
  refetch: () => Promise<void>
}

async function fetchUsernameFromLens(pkpAddress: string): Promise<string | null> {
  try {
    const result = await fetchAccountsAvailable(lensClient, {
      managedBy: evmAddress(pkpAddress),
    })
    if (result.isErr()) return null
    for (const item of result.value.items) {
      if ('account' in item && item.account?.metadata?.name) {
        return item.account.metadata.name
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Hook to fetch artist leaderboard data (aggregated across all artist's songs)
 * Lazy-loaded: Only fetches when refetch() is called
 */
export function useArtistLeaderboard(spotifyTrackIds: string[]): UseArtistLeaderboardResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [usernameMap, setUsernameMap] = useState<Map<string, string>>(new Map())
  const [hasLoaded, setHasLoaded] = useState(false)

  const refetch = useCallback(async () => {
    if (spotifyTrackIds.length === 0) {
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await graphClient.request(GET_ARTIST_LEADERBOARD_DATA, {
        spotifyTrackIds,
      })
      setData(response)
      setHasLoaded(true)
    } catch (err) {
      console.error('[useArtistLeaderboard] Error fetching leaderboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard')
    } finally {
      setIsLoading(false)
    }
  }, [spotifyTrackIds])

  // Compute preliminary leaderboard to identify top performers
  const preliminaryLeaderboard = useMemo(() => {
    if (!data) return []

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
      .slice(0, 10)
  }, [data])

  // Fetch usernames for top 10 performers
  useEffect(() => {
    if (preliminaryLeaderboard.length === 0) return

    const addresses = preliminaryLeaderboard.map((e) => e.address)
    const fetchUsernames = async () => {
      const newMap = new Map<string, string>()
      await Promise.all(
        addresses.map(async (addr) => {
          const username = await fetchUsernameFromLens(addr)
          if (username) newMap.set(addr, username)
        })
      )
      if (newMap.size > 0) setUsernameMap(newMap)
    }
    fetchUsernames()
  }, [preliminaryLeaderboard])

  const leaderboard = useMemo(() => {
    if (!data) return []

    const getUsername = (address: string) => {
      return usernameMap.get(address) || `${address.slice(0, 6)}...${address.slice(-4)}`
    }

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
      const performer = performerMap.get(address)!
      performer.exerciseScores.push(parseInt(attempt.score) || 0)
      performer.exerciseRatings.push(parseInt(attempt.rating) || 0)
      performer.timestamps.push(parseInt(attempt.gradedAt) || 0)
    }

    for (const session of data.karaokeSessions || []) {
      const address = session.performer?.toLowerCase()
      if (!address) continue
      if (!performerMap.has(address)) {
        performerMap.set(address, { address, exerciseScores: [], exerciseRatings: [], karaokeScores: [], timestamps: [] })
      }
      const performer = performerMap.get(address)!
      if (session.isCompleted && session.aggregateScore) {
        performer.karaokeScores.push(parseInt(session.aggregateScore) || 0)
      }
      const ts = parseInt(session.endedAt || session.startedAt) || 0
      if (ts > 0) performer.timestamps.push(ts)
    }

    const entries: ArtistLeaderboardEntry[] = Array.from(performerMap.values())
      .map((performer) => {
        const currentStreak = calculateStreak(performer.timestamps)
        const karaokePoints = performer.karaokeScores.reduce((sum, score) => sum + Math.floor(score / 100), 0)
        const exercisePoints = performer.exerciseScores.reduce((sum, score, i) => {
          const rating = performer.exerciseRatings[i] || 0
          const base = Math.floor(score / 100)
          const bonus = RATING_BONUS[rating as keyof typeof RATING_BONUS] || 0
          return sum + base + bonus
        }, 0)
        const multiplier = getStreakMultiplier(currentStreak)
        const totalPoints = Math.floor((karaokePoints + exercisePoints) * multiplier)
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
      .slice(0, 10)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))

    return entries
  }, [data, usernameMap])

  return { leaderboard, isLoading, error, hasLoaded, refetch }
}
