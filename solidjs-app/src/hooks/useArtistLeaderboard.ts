/**
 * useArtistLeaderboard - Aggregates leaderboard across all artist's songs
 * Lazy-loaded: Only fetches when refetch() is called
 */

import { createSignal, createMemo, createEffect, type Accessor } from 'solid-js'
import { gql } from 'graphql-request'
import { evmAddress } from '@lens-protocol/client'
import { fetchAccountsAvailable } from '@lens-protocol/client/actions'
import { graphClient } from '@/lib/graphql/client'
import { lensClient } from '@/lib/lens/client'

// Points: base score/100 + FSRS rating bonus, then streak multiplier
const RATING_BONUS = [0, 5, 15, 30] as const // [Again, Hard, Good, Easy]
const getStreakMultiplier = (days: number) => Math.min(2.0, 1 + days * 0.1)

function calculateStreak(timestamps: number[]): number {
  if (!timestamps.length) return 0
  const days = [...new Set(timestamps.map(t => Math.floor(t / 86400)))].sort((a, b) => b - a)
  const today = Math.floor(Date.now() / 1000 / 86400)
  if (days[0] < today - 1) return 0
  let streak = 1
  for (let i = 1; i < days.length && days[i - 1] - days[i] === 1; i++) streak++
  return streak
}

const GET_ARTIST_LEADERBOARD = gql`
  query GetArtistLeaderboard($spotifyTrackIds: [String!]!) {
    exerciseAttempts(
      where: { card_: { spotifyTrackId_in: $spotifyTrackIds } }
      first: 1000
      orderBy: gradedAt
      orderDirection: desc
    ) {
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
      performer
      aggregateScore
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
  currentStreak: number
}

interface PerformerData {
  scores: number[]
  ratings: number[]
  karaokeScores: number[]
  timestamps: number[]
}

async function fetchLensUsername(address: string): Promise<string | null> {
  try {
    const result = await fetchAccountsAvailable(lensClient, { managedBy: evmAddress(address) })
    if (result.isErr()) return null
    for (const item of result.value.items) {
      if ('account' in item && item.account?.metadata?.name) return item.account.metadata.name
    }
    return null
  } catch {
    return null
  }
}

function aggregatePerformers(data: any): Map<string, PerformerData> {
  const map = new Map<string, PerformerData>()
  const getOrCreate = (addr: string) => {
    if (!map.has(addr)) map.set(addr, { scores: [], ratings: [], karaokeScores: [], timestamps: [] })
    return map.get(addr)!
  }

  for (const a of data.exerciseAttempts || []) {
    const addr = a.performerAddress?.toLowerCase()
    if (!addr) continue
    const p = getOrCreate(addr)
    p.scores.push(+a.score || 0)
    p.ratings.push(+a.rating || 0)
    p.timestamps.push(+a.gradedAt || 0)
  }

  for (const s of data.karaokeSessions || []) {
    const addr = s.performer?.toLowerCase()
    if (!addr) continue
    const p = getOrCreate(addr)
    if (s.isCompleted && s.aggregateScore) p.karaokeScores.push(+s.aggregateScore || 0)
    const ts = +(s.endedAt || s.startedAt) || 0
    if (ts) p.timestamps.push(ts)
  }

  return map
}

function calculatePoints(p: PerformerData): number {
  const karaokePoints = p.karaokeScores.reduce((sum, s) => sum + Math.floor(s / 100), 0)
  const exercisePoints = p.scores.reduce((sum, s, i) => {
    return sum + Math.floor(s / 100) + (RATING_BONUS[p.ratings[i]] ?? 0)
  }, 0)
  return Math.floor((karaokePoints + exercisePoints) * getStreakMultiplier(calculateStreak(p.timestamps)))
}

export function useArtistLeaderboard(spotifyTrackIds: Accessor<string[]>) {
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [data, setData] = createSignal<any>(null)
  const [usernames, setUsernames] = createSignal<Map<string, string>>(new Map())
  const [hasLoaded, setHasLoaded] = createSignal(false)

  const refetch = async () => {
    const ids = spotifyTrackIds()
    if (!ids.length) return setData(null)

    setIsLoading(true)
    setError(null)
    try {
      const response = await graphClient.request(GET_ARTIST_LEADERBOARD, { spotifyTrackIds: ids })
      setData(response)
      setHasLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch leaderboard')
    } finally {
      setIsLoading(false)
    }
  }

  // Preliminary ranking to identify top 10 for username fetch
  const topAddresses = createMemo(() => {
    const d = data()
    if (!d) return []
    const performers = aggregatePerformers(d)
    return [...performers.entries()]
      .map(([addr, p]) => ({ addr, points: calculatePoints(p) }))
      .filter(e => e.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map(e => e.addr)
  })

  // Fetch usernames for top 10
  createEffect(() => {
    const addrs = topAddresses()
    if (!addrs.length) return
    Promise.all(addrs.map(async addr => {
      const name = await fetchLensUsername(addr)
      return [addr, name] as const
    })).then(results => {
      const map = new Map<string, string>()
      for (const [addr, name] of results) if (name) map.set(addr, name)
      if (map.size) setUsernames(map)
    })
  })

  const leaderboard = createMemo((): LeaderboardEntry[] => {
    const d = data()
    if (!d) return []
    const uMap = usernames()
    const performers = aggregatePerformers(d)

    return [...performers.entries()]
      .map(([addr, p]) => ({
        rank: 0,
        address: addr,
        username: uMap.get(addr) || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
        totalPoints: calculatePoints(p),
        currentStreak: calculateStreak(p.timestamps),
      }))
      .filter(e => e.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }))
  })

  return { leaderboard, isLoading, error, hasLoaded, refetch }
}
