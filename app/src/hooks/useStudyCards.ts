import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'

// Helper: Get today's start timestamp (midnight local time)
function getTodayStartTimestamp(): number {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor(todayStart.getTime() / 1000) // Unix timestamp
}

// Helper: Generate deterministic lineId using Web Crypto API
async function generateLineId(spotifyTrackId: string, lineIndex: number): Promise<string> {
  const input = `${spotifyTrackId}-${lineIndex}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return '0x' + hashHex
}

// Import FSRS algorithm (from lit-actions)
// Since we can't import JS files directly in TypeScript, we'll copy the key functions here
// TODO: Eventually, extract to a shared package

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
  id: string // lineId (UUID) or segmentHash (fallback)
  questionId?: string // Exercise question identifier (bytes32 hex)
  lineId?: string // UUID from karaoke_lines table
  lineIndex?: number // Position within segment (0-based)
  segmentHash?: string
  grc20WorkId?: string
  spotifyTrackId?: string
  exerciseType?: 'SAY_IT_BACK' | 'TRANSLATION_MULTIPLE_CHOICE' | 'TRIVIA_MULTIPLE_CHOICE'

  // Content
  metadataUri: string
  instrumentalUri?: string
  alignmentUri?: string
  languageCode?: string
  distractorPoolSize?: number

  translations?: Array<{
    languageCode: string
    translationUri: string
  }>

  // Timing
  segmentStartMs?: number
  segmentEndMs?: number

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
  query GetSegmentsWithPerformances($grc20WorkId: String!, $performer: Bytes!) {
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

      # OLD: Segment-level performances (for leaderboards)
      performances(where: { performerAddress: $performer }, orderBy: gradedAt, orderDirection: desc, first: 100) {
        id
        score
        gradedAt
      }
    }

    # NEW: Line-level performances (for FSRS tracking) - fetch separately and join in frontend
    linePerformances(where: {
      performerAddress: $performer
    }, orderBy: gradedAt, orderDirection: desc, first: 1000) {
      id
      lineId
      lineIndex
      segmentHash
      score
      gradedAt
    }
  }
`

const GET_EXERCISE_CARDS = gql`
  query GetExerciseCards($spotifyTrackIds: [String!]!, $performer: Bytes!) {
    exerciseCards(where: { spotifyTrackId_in: $spotifyTrackIds, enabled: true }) {
      id
      questionId
      exerciseType
      spotifyTrackId
      languageCode
      metadataUri
      distractorPoolSize
      lineId
      lineIndex
      segmentHash
      segment {
        segmentHash
        grc20WorkId
      }
      attempts(
        where: { performerAddress: $performer }
        orderBy: gradedAt
        orderDirection: desc
        first: 100
      ) {
        id
        score
        gradedAt
      }
    }
  }
`

export interface StudyCardsResult {
  cards: StudyCard[]
  stats: {
    total: number
    new: number
    learning: number
    review: number
    relearning: number
    newCardsIntroducedToday: number
    newCardsRemaining: number
  }
}

export function useStudyCards(songId?: string) {
  const { pkpAddress } = useAuth()

  return useQuery({
    queryKey: ['study-cards', songId, pkpAddress],
    queryFn: async (): Promise<StudyCardsResult> => {
      if (!pkpAddress) {
        throw new Error('Not authenticated')
      }

      if (!songId) {
        // TODO: For now, require a song ID. Later could load all songs
        return {
          cards: [],
          stats: {
            total: 0,
            new: 0,
            learning: 0,
            review: 0,
            relearning: 0,
            newCardsIntroducedToday: 0,
            newCardsRemaining: 15,
          }
        }
      }

      try {
        // Query segments with performance history for this user
        const data = await graphClient.request(GET_SEGMENTS_WITH_PERFORMANCES, {
          grc20WorkId: songId,
          performer: pkpAddress.toLowerCase(),
        })

        if (!data?.segments) {
          return {
            cards: [],
            stats: {
              total: 0,
              new: 0,
              learning: 0,
              review: 0,
              relearning: 0,
              newCardsIntroducedToday: 0,
              newCardsRemaining: 15,
            }
          }
        }

        const spotifyTrackIds = Array.from(
          new Set(
            (data.segments || [])
              .map((segment: any) => segment.spotifyTrackId)
              .filter((id): id is string => typeof id === 'string' && id.length > 0)
          )
        )

        let exerciseCardResponse: { exerciseCards: any[] } = { exerciseCards: [] }

        if (spotifyTrackIds.length > 0) {
          exerciseCardResponse = await graphClient.request(GET_EXERCISE_CARDS, {
            spotifyTrackIds,
            performer: pkpAddress.toLowerCase(),
          })
        }

        const onChainExerciseCards = exerciseCardResponse.exerciseCards || []
        console.log(`[useStudyCards] Fetched ${onChainExerciseCards.length} exercise cards for user`)

        // Expand segments into line-level cards by fetching translation data
        const studyCards: StudyCard[] = []
        const seenCardIds = new Set<string>()
        const exerciseCardAttemptsById = new Map<string, any[]>()

        for (const card of onChainExerciseCards) {
          const attempts = card.attempts || []
          exerciseCardAttemptsById.set(card.id.toLowerCase(), attempts)

          const fsrsState = calculateFSRSState(attempts)
          const lineIndexValue = card.lineIndex === null || card.lineIndex === undefined
            ? undefined
            : Number(card.lineIndex)

          if (seenCardIds.has(card.id)) {
            continue
          }
          seenCardIds.add(card.id)

          studyCards.push({
            id: card.id,
            questionId: card.questionId ?? card.id,
            lineId: card.lineId ?? undefined,
            lineIndex: Number.isNaN(lineIndexValue) ? undefined : lineIndexValue,
            segmentHash: card.segmentHash ?? card.segment?.segmentHash ?? undefined,
            grc20WorkId: card.segment?.grc20WorkId ?? undefined,
            spotifyTrackId: card.spotifyTrackId ?? undefined,
            metadataUri: card.metadataUri,
            languageCode: card.languageCode ?? undefined,
            distractorPoolSize: card.distractorPoolSize ?? undefined,
            exerciseType: card.exerciseType as StudyCard['exerciseType'],
            fsrs: fsrsState,
            translations: [],
          })
        }

        // Get all line performances for this user (from GraphQL query)
        const allLinePerformances = data.linePerformances || []
        console.log(`[useStudyCards] Fetched ${allLinePerformances.length} line performances for user`)

        for (const segment of data.segments) {
          // Fetch first translation to get line structure
          const firstTranslation = segment.translations?.[0]
          
          if (!firstTranslation?.translationUri) {
            // Fallback: segment-level card if no translations
            const fsrsState = calculateFSRSState(segment.performances || [])

            if (seenCardIds.has(segment.segmentHash)) {
              continue
            }
            seenCardIds.add(segment.segmentHash)

            studyCards.push({
              id: segment.segmentHash,
              lineId: undefined,
              lineIndex: 0,
              segmentHash: segment.segmentHash,
              grc20WorkId: segment.grc20WorkId,
              spotifyTrackId: segment.spotifyTrackId,
              metadataUri: segment.metadataUri,
              instrumentalUri: segment.instrumentalUri,
              alignmentUri: segment.alignmentUri,
              segmentStartMs: segment.segmentStartMs,
              segmentEndMs: segment.segmentEndMs,
              translations: segment.translations || [],
              exerciseType: 'SAY_IT_BACK',
              fsrs: fsrsState,
            })
            continue
          }

          try {
            // Fetch translation file to get line structure
            const translationResponse = await fetch(firstTranslation.translationUri)
            if (!translationResponse.ok) {
              throw new Error(`Failed to fetch translation: ${translationResponse.status}`)
            }
            const translationData = await translationResponse.json()
            
            if (!translationData.lines || !Array.isArray(translationData.lines)) {
              throw new Error('Translation has no lines array')
            }

            // Create one card per line
            for (let lineIndex = 0; lineIndex < translationData.lines.length; lineIndex++) {
              const line = translationData.lines[lineIndex]

              // Skip blank/empty lines - can't practice text that doesn't exist!
              if (!line?.originalText || line.originalText.trim().length === 0) {
                console.log(`[useStudyCards] Skipping blank line at index ${lineIndex}`)
                continue
              }

              // Generate deterministic lineId from spotifyTrackId + lineIndex
              // This matches what Lit Action expects: stable identifier for FSRS tracking
              // Using SHA-256 hash via Web Crypto API - same result as keccak256 for our purposes
              const lineId = await generateLineId(segment.spotifyTrackId, lineIndex)

              // Filter performances for this specific line by lineId (stable identifier)
              const linePerformances = allLinePerformances.filter((p: any) =>
                p.segmentHash === segment.segmentHash && p.lineId === lineId
              )

              // Calculate FSRS state for this line
              const fsrsState = calculateFSRSState(linePerformances)

              if (seenCardIds.has(lineId)) {
                continue
              }
              seenCardIds.add(lineId)

              studyCards.push({
                id: lineId, // Use lineId as primary identifier
                lineId, // Deterministic bytes32 from Grove data (no contract needed!)
                lineIndex,
                segmentHash: segment.segmentHash,
                grc20WorkId: segment.grc20WorkId,
                spotifyTrackId: segment.spotifyTrackId,
                metadataUri: segment.metadataUri,
                instrumentalUri: segment.instrumentalUri,
                alignmentUri: segment.alignmentUri,
                segmentStartMs: segment.segmentStartMs,
                segmentEndMs: segment.segmentEndMs,
                translations: segment.translations || [],
                exerciseType: 'SAY_IT_BACK',
                fsrs: fsrsState,
              })
            }
          } catch (error) {
            console.error('[useStudyCards] Failed to fetch translation, falling back to segment-level:', error)
            // Fallback: segment-level card
            const fsrsState = calculateFSRSState(segment.performances || [])
            if (!seenCardIds.has(segment.segmentHash)) {
              seenCardIds.add(segment.segmentHash)
              studyCards.push({
                id: segment.segmentHash,
                lineId: undefined,
                lineIndex: 0,
                segmentHash: segment.segmentHash,
                grc20WorkId: segment.grc20WorkId,
                spotifyTrackId: segment.spotifyTrackId,
                metadataUri: segment.metadataUri,
                instrumentalUri: segment.instrumentalUri,
                alignmentUri: segment.alignmentUri,
                segmentStartMs: segment.segmentStartMs,
                segmentEndMs: segment.segmentEndMs,
                translations: segment.translations || [],
                exerciseType: 'SAY_IT_BACK',
                fsrs: fsrsState,
              })
            }
          }
        }

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

        // Calculate daily new card limit (FSRS/Anki style)
        const todayStart = getTodayStartTimestamp()

        const recordFirstAttempt = (cardId: string | undefined, gradedAt: any, store: Map<string, number>) => {
          if (!cardId) {
            return
          }
          const parsed = Number(gradedAt)
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return
          }
          const key = cardId.toLowerCase()
          const existing = store.get(key)
          if (existing === undefined || parsed < existing) {
            store.set(key, parsed)
          }
        }

        const firstAttemptByCard = new Map<string, number>()

        allLinePerformances.forEach((perf: any) => {
          recordFirstAttempt(perf.lineId, perf.gradedAt, firstAttemptByCard)
        })

        exerciseCardAttemptsById.forEach((attempts, cardId) => {
          attempts.forEach((attempt: any) => {
            recordFirstAttempt(cardId, attempt.gradedAt, firstAttemptByCard)
          })
        })

        console.log(`[useStudyCards] Tracking ${firstAttemptByCard.size} cards with attempt history`)

        // Count how many cards had their first attempt today
        let newCardsIntroducedToday = 0
        firstAttemptByCard.forEach(firstTime => {
          if (firstTime >= todayStart) {
            newCardsIntroducedToday++
          }
        })

        const newCardsRemaining = Math.max(0, 15 - newCardsIntroducedToday)

        console.log(`[useStudyCards] New cards introduced today: ${newCardsIntroducedToday}/15`)
        console.log(`[useStudyCards] New cards remaining: ${newCardsRemaining}`)

        // Apply daily limit: remaining new + unlimited review/learning
        let newCount = 0
        const dailyCards = dueCards.filter(card => {
          // All non-new cards pass through (review, learning, relearning)
          if (card.fsrs.state !== 0) {
            return true
          }

          // New cards: respect daily limit
          if (newCount < newCardsRemaining) {
            newCount++
            return true
          }

          return false
        })

        // Calculate stats for UI
        const stats = {
          total: dailyCards.length,
          new: dailyCards.filter(c => c.fsrs.state === 0).length,
          learning: dailyCards.filter(c => c.fsrs.state === 1).length,
          review: dailyCards.filter(c => c.fsrs.state === 2).length,
          relearning: dailyCards.filter(c => c.fsrs.state === 3).length,
          newCardsIntroducedToday,
          newCardsRemaining,
        }

        console.log('[useStudyCards] Loaded', dailyCards.length, 'due cards for song', songId)
        console.log('[useStudyCards] Card states:', dailyCards.map(c => ({
          id: c.id.slice(0, 8),
          state: ['New', 'Learning', 'Review', 'Relearning'][c.fsrs.state],
          due: new Date(c.fsrs.due * 1000),
        })))
        console.log('[useStudyCards] Daily stats:', stats)

        return { cards: dailyCards, stats }
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
    state: (performanceHistory.length === 1 ? 1 : 2) as 0 | 1 | 2 | 3, // Learning if 1 rep, Review otherwise
    lastReview: lastReviewTime,
  }
}
