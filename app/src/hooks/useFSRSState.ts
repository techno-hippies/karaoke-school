/**
 * Hook to fetch and manage FSRS state from The Graph subgraph
 *
 * This hook:
 * 1. Fetches user's performance history from subgraph
 * 2. Builds FSRS state map (which lines have been practiced)
 * 3. Filters and sorts cards based on FSRS algorithm
 */

import { useState, useEffect, useCallback } from 'react'
import { graphClient } from '../lib/graphql/client'
import { GET_USER_SEGMENT_PROGRESS } from '../lib/graphql/queries'
import type { GetUserSegmentProgressResponse, LinePerformance } from '../lib/graphql/queries'

export interface FSRSLineState {
  lineId: string
  lineIndex: number
  performances: LinePerformance[]
  lastScore: number | null
  timesStudied: number
  lastStudiedAt: string | null
}

export interface UseFSRSStateResult {
  fsrsState: Map<number, FSRSLineState>
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Fetch FSRS state for a user's segment performances
 *
 * @param userAddress - User's wallet address (0x...)
 * @param segmentHash - Segment hash (0x...)
 * @returns FSRS state map, loading, error, and refetch function
 */
export function useFSRSState(
  userAddress: string | undefined,
  segmentHash: string | undefined
): UseFSRSStateResult {
  const [fsrsState, setFsrsState] = useState<Map<number, FSRSLineState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchFSRSState = useCallback(async () => {
    if (!userAddress || !segmentHash) {
      setFsrsState(new Map())
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('[useFSRSState] Fetching performances for:', {
        userAddress,
        segmentHash,
      })

      const data = await graphClient.request<GetUserSegmentProgressResponse>(
        GET_USER_SEGMENT_PROGRESS,
        {
          userAddress,
          segmentHash,
        }
      )

      console.log(
        `[useFSRSState] Fetched ${data.linePerformances.length} performances`
      )

      // Build FSRS state map
      const stateMap = new Map<number, FSRSLineState>()

      for (const perf of data.linePerformances) {
        const lineIndex = perf.lineIndex

        if (!stateMap.has(lineIndex)) {
          stateMap.set(lineIndex, {
            lineId: perf.lineId,
            lineIndex,
            performances: [],
            lastScore: null,
            timesStudied: 0,
            lastStudiedAt: null,
          })
        }

        const state = stateMap.get(lineIndex)!
        state.performances.push(perf)
        state.timesStudied = state.performances.length
        state.lastScore = state.performances[0].score // First is most recent (desc order)
        state.lastStudiedAt = state.performances[0].gradedAt
      }

      console.log('[useFSRSState] Built state map with', stateMap.size, 'lines')
      setFsrsState(stateMap)
    } catch (err) {
      console.error('[useFSRSState] Error fetching FSRS state:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [segmentHash, userAddress])

  useEffect(() => {
    fetchFSRSState()
  }, [fetchFSRSState])

  return {
    fsrsState,
    loading,
    error,
    refetch: fetchFSRSState,
  }
}

/**
 * Filter and sort cards based on FSRS state
 *
 * Algorithm:
 * 1. Never studied → Show first (priority)
 * 2. Low scores → Review next
 * 3. Recent high scores → Skip or show last
 *
 * @param cards - All cards from Grove metadata
 * @param fsrsState - FSRS state map from subgraph
 * @returns Filtered and sorted cards
 */
export function filterCardsByFSRS<T extends { lineIndex: number }>(
  cards: T[],
  fsrsState: Map<number, FSRSLineState>
): T[] {
  return cards
    .map(card => ({
      card,
      state: fsrsState.get(card.lineIndex),
    }))
    .sort((a, b) => {
      // Priority 1: Never studied lines first
      const aStudied = a.state?.timesStudied || 0
      const bStudied = b.state?.timesStudied || 0

      if (aStudied === 0 && bStudied > 0) return -1
      if (bStudied === 0 && aStudied > 0) return 1

      // Priority 2: If both studied, sort by last score (lowest first for review)
      if (aStudied > 0 && bStudied > 0) {
        const aScore = a.state?.lastScore || 0
        const bScore = b.state?.lastScore || 0

        if (aScore !== bScore) {
          return aScore - bScore // Ascending (worst scores first)
        }
      }

      // Priority 3: Maintain original line order
      return a.card.lineIndex - b.card.lineIndex
    })
    .map(({ card }) => card)
}

/**
 * Get FSRS stats for a specific line
 */
export function getLineStats(
  lineIndex: number,
  fsrsState: Map<number, FSRSLineState>
): {
  timesStudied: number
  lastScore: number | null
  lastStudiedAt: string | null
  isNew: boolean
  needsReview: boolean
} {
  const state = fsrsState.get(lineIndex)

  if (!state) {
    return {
      timesStudied: 0,
      lastScore: null,
      lastStudiedAt: null,
      isNew: true,
      needsReview: false,
    }
  }

  return {
    timesStudied: state.timesStudied,
    lastScore: state.lastScore,
    lastStudiedAt: state.lastStudiedAt,
    isNew: false,
    needsReview: state.lastScore !== null && state.lastScore < 8000, // < 80%
  }
}
