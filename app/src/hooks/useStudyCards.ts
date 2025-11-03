import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'

// Import FSRS algorithm (from lit-actions)
// Since we can't import JS files directly in TypeScript, we'll copy the key functions here
// TODO: Eventually, extract to a shared package

/**
 * FSRS Card States
 */
const CardState = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
}

/**
 * FSRS Ratings
 */
const Rating = {
  Again: 0,
  Hard: 1,
  Good: 2,
  Easy: 3,
}

/**
 * Load FSRS study cards for a song (or all songs)
 *
 * Queries subgraph for:
 * 1. All segments for the work/song
 * 2. Performance events (grades) for those segments
 * 3. Calculate FSRS state from performance history
 * 4. Filter to due cards (due date <= today)
 *
 * @param songId Optional GRC-20 work ID to filter to one song
 * @returns { data: studyCards[], isLoading, error }
 */
export interface StudyCard {
  id: string // segmentHash
  segmentHash: string
  grc20WorkId: string
  spotifyTrackId: string

  // Content
  metadataUri: string
  instrumentalUri?: string
  alignmentUri?: string

  translations?: Array<{
    languageCode: string
    translationUri: string
  }>

  // Timing
  segmentStartMs: number
  segmentEndMs: number

  // FSRS state
  fsrs: {
    due: number // Unix timestamp (seconds)
    stability: number // Days
    difficulty: number // 1-10
    elapsedDays: number
    scheduledDays: number
    reps: number
    lapses: number
    state: 0 | 1 | 2 | 3 // CardState enum: New=0, Learning=1, Review=2, Relearning=3
    lastReview: number | null // Unix timestamp
  }
}

const GET_SEGMENTS_WITH_PERFORMANCES = gql`
  query GetSegmentsWithPerformances($grc20WorkId: String!, $performer: String!) {
    segments(where: { grc20WorkId: $grc20WorkId }) {
      id
      segmentHash
      grc20WorkId
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      segmentStartMs
      segmentEndMs

      translations {
        languageCode
        translationUri
      }

      performances(where: { performer: $performer }, orderBy: gradedAt, orderDirection: desc, first: 100) {
        id
        score
        gradedAt
      }
    }
  }
`

export function useStudyCards(songId?: string) {
  const { pkpAddress } = useAuth()

  return useQuery({
    queryKey: ['study-cards', songId, pkpAddress],
    queryFn: async (): Promise<StudyCard[]> => {
      if (!pkpAddress) {
        throw new Error('Not authenticated')
      }

      if (!songId) {
        // TODO: For now, require a song ID. Later could load all songs
        return []
      }

      try {
        // Query segments with performance history for this user
        const data = await graphClient.request(GET_SEGMENTS_WITH_PERFORMANCES, {
          grc20WorkId: songId,
          performer: pkpAddress.toLowerCase(),
        })

        if (!data?.segments) {
          return []
        }

        // Convert segments to study cards and calculate FSRS state
        const studyCards = data.segments.map((segment: any): StudyCard => {
          // Calculate FSRS state from performance history
          const fsrsState = calculateFSRSState(segment.performances || [])

          return {
            id: segment.segmentHash,
            segmentHash: segment.segmentHash,
            grc20WorkId: segment.grc20WorkId,
            spotifyTrackId: segment.spotifyTrackId,
            metadataUri: segment.metadataUri,
            instrumentalUri: segment.instrumentalUri,
            alignmentUri: segment.alignmentUri,
            segmentStartMs: segment.segmentStartMs,
            segmentEndMs: segment.segmentEndMs,
            translations: segment.translations || [],
            fsrs: fsrsState,
          }
        })

        // Filter to due cards (due <= now)
        const now = Math.floor(Date.now() / 1000)
        const dueCards = studyCards.filter(card => card.fsrs.due <= now)

        // Sort by priority: due > learning > new
        dueCards.sort((a, b) => {
          // Due date first (earlier = higher priority)
          if (a.fsrs.due !== b.fsrs.due) {
            return a.fsrs.due - b.fsrs.due
          }
          // Then by state: Review > Learning > Relearning > New
          const statePriority = { 2: 0, 1: 1, 3: 2, 0: 3 } as const
          const aPriority = statePriority[a.fsrs.state as keyof typeof statePriority]
          const bPriority = statePriority[b.fsrs.state as keyof typeof statePriority]
          return aPriority - bPriority
        })

        // Apply daily limit: 15 new + unlimited review/due
        let newCount = 0
        const dailyCards = dueCards.filter(card => {
          if (card.fsrs.state === 0) { // New
            if (newCount < 15) {
              newCount++
              return true
            }
            return false
          }
          // All review/relearning/learning cards
          return true
        })

        console.log('[useStudyCards] Loaded', dailyCards.length, 'due cards for song', songId)
        console.log('[useStudyCards] Card states:', dailyCards.map(c => ({
          id: c.id.slice(0, 8),
          state: ['New', 'Learning', 'Review', 'Relearning'][c.fsrs.state],
          due: new Date(c.fsrs.due * 1000),
        })))

        return dailyCards
      } catch (error) {
        console.error('[useStudyCards] Query error:', error)
        throw error
      }
    },
    enabled: !!pkpAddress && !!songId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Helper to calculate FSRS state from performance history
 *
 * Implements minimal FSRS calculation for current study state.
 * For production, should import full algorithm from lit-actions.
 */
function calculateFSRSState(performanceHistory: any[]) {
  // If no history, card is New and due immediately
  if (!performanceHistory || performanceHistory.length === 0) {
    return {
      due: Math.floor(Date.now() / 1000), // Due immediately
      stability: 0,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0 as const, // New
      lastReview: null,
    }
  }

  // For now, use simplified calculation (TODO: integrate full FSRS)
  // Last performance determines next review time
  const lastPerformance = performanceHistory[0]
  const lastReviewTime = parseInt(lastPerformance.gradedAt)
  const score = Math.round((lastPerformance.score || 0) / 25) // 0-100 → 0-4
  const rating = Math.min(3, Math.max(0, score))

  // Simple interval scheduling based on rating and reps
  let dayInterval = 1
  if (rating >= Rating.Good) {
    // Good or Easy ratings increase interval exponentially
    dayInterval = Math.min(
      36500, // Max interval
      Math.pow(2, performanceHistory.length) // Exponential backoff
    )
  }

  const nextDueTime = lastReviewTime + (dayInterval * 86400)

  return {
    due: nextDueTime,
    stability: dayInterval,
    difficulty: 5 + (3 - rating), // Adjust based on rating
    elapsedDays: Math.floor((Date.now() / 1000 - lastReviewTime) / 86400),
    scheduledDays: dayInterval,
    reps: performanceHistory.length,
    lapses: rating === Rating.Again ? 1 : 0,
    state: performanceHistory.length === 1 ? 1 : 2 as const, // Learning if 1 rep, Review otherwise
    lastReview: lastReviewTime,
  }
}
