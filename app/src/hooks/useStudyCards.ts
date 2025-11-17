import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from 'graphql-request'
import { graphClient } from '@/lib/graphql/client'
import { convertGroveUri } from '@/lib/lens/utils'
import { useLanguagePreference } from '@/hooks/useLanguagePreference'

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

  // Song metadata
  title?: string
  artist?: string
  artworkUrl?: string

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

const GET_CLIPS_WITH_PERFORMANCES = gql`
  query GetClipsWithPerformances($grc20WorkId: String!, $performer: Bytes!) {
    clips(where: { grc20WorkId: $grc20WorkId }, first: 1000) {
      id
      clipHash
      grc20WorkId
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      clipStartMs
      clipEndMs

      translations {
        languageCode
        translationUri
      }

      # OLD: Clip-level performances (for leaderboards)
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
      clipHash
      score
      gradedAt
    }
  }
`

const GET_ALL_CLIPS_WITH_PERFORMANCES = gql`
  query GetAllClipsWithPerformances($performer: Bytes!) {
    clips(first: 1000) {
      id
      clipHash
      grc20WorkId
      spotifyTrackId
      metadataUri
      instrumentalUri
      alignmentUri
      clipStartMs
      clipEndMs

      translations {
        languageCode
        translationUri
      }

      # OLD: Clip-level performances (for leaderboards)
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
      clipHash
      score
      gradedAt
    }
  }
`

const GET_EXERCISE_CARDS = gql`
  query GetExerciseCards($spotifyTrackIds: [String!]!, $performer: Bytes!, $languageCode: String) {
    exerciseCards(where: {
      spotifyTrackId_in: $spotifyTrackIds
      enabled: true
      languageCode: $languageCode
    }) {
      id
      questionId
      exerciseType
      spotifyTrackId
      languageCode
      metadataUri
      distractorPoolSize
      lineId
      lineIndex
      clipHash
      clip {
        clipHash
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
    dueToday: number
  }
}

export function useStudyCards(songId?: string) {
  const { pkpAddress } = useAuth()
  const { languageFallbackOrder } = useLanguagePreference()

  return useQuery({
    queryKey: ['study-cards', songId, pkpAddress, languageFallbackOrder.join(',')],
    queryFn: async (): Promise<StudyCardsResult> => {
      if (!pkpAddress) {
        throw new Error('Not authenticated')
      }

      try {

        // Use different query based on whether we're filtering by songId
        let data
        if (songId) {
          // Query specific work
          data = await graphClient.request(GET_CLIPS_WITH_PERFORMANCES, {
            grc20WorkId: songId,
            performer: pkpAddress.toLowerCase(),
          })
        } else {
          // Query ALL clips for dashboard view
          data = await graphClient.request(GET_ALL_CLIPS_WITH_PERFORMANCES, {
            performer: pkpAddress.toLowerCase(),
          })
        }

        if (!data?.clips) {
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
              dueToday: 0,
            }
          }
        }

        const spotifyTrackIds = Array.from(
          new Set(
            (data.clips || [])
              .map((clip: any) => clip.spotifyTrackId)
              .filter((id): id is string => typeof id === 'string' && id.length > 0)
          )
        )

        let exerciseCardResponse: { exerciseCards: any[] } = { exerciseCards: [] }

        if (spotifyTrackIds.length > 0) {
          let selectedExerciseLanguage: string | null = null
          let lastError: unknown = null
          let hadSuccessfulRequest = false

          for (const languageCode of languageFallbackOrder) {
            try {
              const response = await graphClient.request(GET_EXERCISE_CARDS, {
                spotifyTrackIds,
                performer: pkpAddress.toLowerCase(),
                languageCode,
              })

              hadSuccessfulRequest = true
              exerciseCardResponse = response

              if (response.exerciseCards?.length) {
                selectedExerciseLanguage = languageCode
                console.log('[useStudyCards] ✅ Loaded exercise cards for language:', languageCode)
                break
              }

              console.log('[useStudyCards] ⚠️ No exercise cards for language, trying next fallback:', languageCode)
            } catch (error) {
              lastError = error
              console.warn('[useStudyCards] ⚠️ Failed to load exercise cards for language:', languageCode, error)
            }
          }

          if (!hadSuccessfulRequest && lastError) {
            throw lastError instanceof Error ? lastError : new Error(String(lastError))
          }

          if (!selectedExerciseLanguage) {
            console.warn('[useStudyCards] ⚠️ Exercise cards unavailable for preferred languages:', languageFallbackOrder)
          }
        }

        const onChainExerciseCards = exerciseCardResponse.exerciseCards || []

        // Expand segments into line-level cards by fetching translation data
        const studyCards: StudyCard[] = []
        const seenCardIds = new Set<string>()
        const exerciseCardAttemptsById = new Map<string, any[]>()

        // Build title/artist/artwork map from clips
        const songMetadataBySpotifyId = new Map<string, { title: string; artist: string; artworkUrl?: string }>()

        // STEP 1: Fetch clip metadata first to populate title/artist map
        const clipMetadataCache = new Map<string, any>()
        const metadataFailures: Array<{ metadataUri: string; error: string }> = []

        for (const clip of data.clips) {
          if (!clip.metadataUri) continue

          try {
            const metadataResponse = await fetch(clip.metadataUri)
            if (!metadataResponse.ok) {
              console.warn('[useStudyCards] ⚠️ Failed to fetch clip metadata', {
                metadataUri: clip.metadataUri,
                status: metadataResponse.status,
              })
              metadataFailures.push({
                metadataUri: clip.metadataUri,
                error: `HTTP ${metadataResponse.status}`,
              })
              continue
            }

            const clipMetadata = await metadataResponse.json()
            clipMetadataCache.set(clip.metadataUri, clipMetadata)

            // Store title/artist/artwork for this track
            if (clipMetadata.title && clipMetadata.artist && clip.spotifyTrackId) {
              songMetadataBySpotifyId.set(clip.spotifyTrackId, {
                title: clipMetadata.title,
                artist: clipMetadata.artist,
                artworkUrl: clipMetadata.coverUri ? convertGroveUri(clipMetadata.coverUri) : undefined
              })
            }
          } catch (error) {
            console.warn('[useStudyCards] ⚠️ Error fetching clip metadata', {
              metadataUri: clip.metadataUri,
              error,
            })
            metadataFailures.push({
              metadataUri: clip.metadataUri,
              error: error instanceof Error ? error.message : String(error),
            })
            continue
          }
        }

        // STEP 2: Process exercise cards with title/artist now available
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

          // Get title/artist/artwork from the map we populated from clip metadata
          const songMetadata = songMetadataBySpotifyId.get(card.spotifyTrackId)
          const title = songMetadata?.title
          const artist = songMetadata?.artist
          const artworkUrl = songMetadata?.artworkUrl

          studyCards.push({
            id: card.id,
            questionId: card.questionId ?? card.id,
            lineId: card.lineId ?? undefined,
            lineIndex: Number.isNaN(lineIndexValue) ? undefined : lineIndexValue,
            segmentHash: card.clipHash ?? card.clip?.clipHash ?? undefined,
            grc20WorkId: card.clip?.grc20WorkId ?? undefined,
            spotifyTrackId: card.spotifyTrackId ?? undefined,
            title,
            artist,
            artworkUrl,
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

        for (const clip of data.clips) {
          const clipMetadata = clipMetadataCache.get(clip.metadataUri)
          if (!clipMetadata) {
            console.warn('[useStudyCards] ⚠️ Missing cached metadata for clip', {
              metadataUri: clip.metadataUri,
              spotifyTrackId: clip.spotifyTrackId,
            })
            metadataFailures.push({
              metadataUri: clip.metadataUri,
              error: 'Metadata missing from cache',
            })

            continue
          }

          // Skip clips with old/malformed metadata (missing karaoke_lines)
          if (!clipMetadata.karaoke_lines || !Array.isArray(clipMetadata.karaoke_lines)) {
            continue
          }

          // Create one card per line using karaoke_lines from Grove
          for (const karaokeLineData of clipMetadata.karaoke_lines) {
            const lineIndex = karaokeLineData.line_index

            // Skip blank/empty lines
            if (!karaokeLineData.original_text || karaokeLineData.original_text.trim().length === 0) {
              continue
            }

            // Generate deterministic lineId from spotifyTrackId + lineIndex
            // This matches what Lit Action expects: stable identifier for FSRS tracking
            const lineId = await generateLineId(clip.spotifyTrackId, lineIndex)

            // Filter performances for this specific line by lineId (stable identifier)
            const linePerformances = allLinePerformances.filter((p: any) =>
              p.clipHash === clip.clipHash && p.lineId === lineId
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
              segmentHash: clip.clipHash,
              grc20WorkId: clip.grc20WorkId,
              spotifyTrackId: clip.spotifyTrackId,
              metadataUri: clip.metadataUri,
              instrumentalUri: clip.instrumentalUri,
              alignmentUri: clip.alignmentUri,
              segmentStartMs: clip.clipStartMs,
              segmentEndMs: clip.clipEndMs,
              translations: clip.translations || [],
              exerciseType: 'SAY_IT_BACK',
              fsrs: fsrsState,
            })
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

        // Count how many cards had their first attempt today
        let newCardsIntroducedToday = 0
        firstAttemptByCard.forEach(firstTime => {
          if (firstTime >= todayStart) {
            newCardsIntroducedToday++
          }
        })

        const newCardsRemaining = Math.max(0, 15 - newCardsIntroducedToday)

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

        // Calculate stats for UI (Anki-style)
        // Stats should show ALL cards (before daily limit), not just today's filtered cards
        const stats = {
          total: studyCards.length, // Total cards (all states, before daily limit)
          new: studyCards.filter(c => c.fsrs.state === 0).length, // All untouched cards
          learning: studyCards.filter(c => c.fsrs.state === 1).length, // All learning cards
          review: dueCards.filter(c => c.fsrs.state === 2).length, // Review cards that are due
          relearning: studyCards.filter(c => c.fsrs.state === 3).length, // All relearning cards
          newCardsIntroducedToday, // How many new cards studied today (for daily limit tracking)
          newCardsRemaining, // How many more new cards can be introduced today
          dueToday: dailyCards.length, // Cards to study today (after daily limit applied)
        }

        console.log('[useStudyCards] ✓ Loaded', dailyCards.length, 'cards for study session')
        if (metadataFailures.length > 0) {
          console.warn('[useStudyCards] ⚠️ Metadata fetch issues:', metadataFailures)
        }

        return { cards: dailyCards, stats }
      } catch (error) {
        console.error('[useStudyCards] ❌ Query error:', error)
        throw error
      }
    },
    // Enable query when PKP is ready (songId is now optional)
    enabled: !!pkpAddress,
    placeholderData: (prev) => prev,
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
