import { createQuery } from '@tanstack/solid-query'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguagePreference } from '@/contexts/LanguagePreferenceContext'
import { graphClient } from '@/lib/graphql/client'
import {
  GET_CLIPS_WITH_PERFORMANCES,
  GET_ALL_CLIPS_WITH_PERFORMANCES,
  GET_EXERCISE_CARDS,
} from '@/lib/graphql/study-queries'
import { convertGroveUri } from '@/lib/lens/utils'
import {
  calculateFSRSState,
  getTodayStartTimestamp,
  generateLineId,
} from '@/lib/fsrs/calculate-state'
import type { StudyCard, StudyCardsResult } from '@/types/study'
import type { Accessor } from 'solid-js'

/**
 * Load FSRS study cards for a song (or all songs)
 *
 * Queries subgraph for:
 * 1. All clips for the song
 * 2. Performance events (grades) for those clips
 * 3. Calculate FSRS state from performance history
 * 4. Filter to due cards (due date <= today)
 *
 * @param songId Optional Spotify track ID accessor to filter to one song
 * @returns { data: StudyCardsResult, isLoading, error }
 */
export function useStudyCards(songId?: Accessor<string | undefined>) {
  const auth = useAuth()
  const { languageFallbackOrder } = useLanguagePreference()

  const query = createQuery(() => ({
    queryKey: ['study-cards', songId?.(), auth.pkpAddress(), languageFallbackOrder().join(',')],
    queryFn: async (): Promise<StudyCardsResult> => {
      const pkpAddress = auth.pkpAddress()
      if (!pkpAddress) {
        throw new Error('Not authenticated')
      }

      try {
        // Use different query based on whether we're filtering by songId
        let data
        const songIdValue = songId?.()
        if (songIdValue) {
          // Query specific song by spotifyTrackId
          data = await graphClient.request(GET_CLIPS_WITH_PERFORMANCES, {
            spotifyTrackId: songIdValue,
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
              .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          )
        )

        let exerciseCardResponse: { exerciseCards: any[] } = { exerciseCards: [] }

        if (spotifyTrackIds.length > 0) {
          let selectedExerciseLanguage: string | null = null
          let lastError: unknown = null
          let hadSuccessfulRequest = false

          for (const languageCode of languageFallbackOrder()) {
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
                break
              }

            } catch (error) {
              lastError = error
              console.warn('[useStudyCards] ⚠️ Failed to load exercise cards for language:', languageCode, error)
            }
          }

          if (!hadSuccessfulRequest && lastError) {
            throw lastError instanceof Error ? lastError : new Error(String(lastError))
          }

          if (!selectedExerciseLanguage) {
            console.warn('[useStudyCards] ⚠️ Exercise cards unavailable for preferred languages:', languageFallbackOrder())
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

            // Get title/artist/artwork from the metadata map
            const songMetadata = songMetadataBySpotifyId.get(clip.spotifyTrackId)

            studyCards.push({
              id: lineId, // Use lineId as primary identifier
              lineId, // Deterministic bytes32 from Grove data (no contract needed!)
              lineIndex,
              segmentHash: clip.clipHash,
              spotifyTrackId: clip.spotifyTrackId,
              title: songMetadata?.title,
              artist: songMetadata?.artist,
              artworkUrl: songMetadata?.artworkUrl,
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

        // Interleave new cards by exercise type (cold start onboarding)
        // Pedagogical order: translation (recognition) → trivia (knowledge) → say-it-back (production)
        const nonNewCards = dueCards.filter(c => c.fsrs.state !== 0)
        const newCards = dueCards.filter(c => c.fsrs.state === 0)

        if (newCards.length > 1) {
          // Group by exercise type
          const translations: StudyCard[] = []
          const trivia: StudyCard[] = []
          const sayItBack: StudyCard[] = []

          for (const card of newCards) {
            switch (card.exerciseType) {
              case 'TRANSLATION_MULTIPLE_CHOICE':
                translations.push(card)
                break
              case 'TRIVIA_MULTIPLE_CHOICE':
                trivia.push(card)
                break
              default:
                sayItBack.push(card)
            }
          }

          // Onboarding sequence: T, Tr, S, then weighted toward translation
          // Pattern after intro: T, T, Tr, T, T, S, repeat
          const interleaved: StudyCard[] = []

          // Intro: 1 translation, 1 trivia, 1 say-it-back
          if (translations.length > 0) interleaved.push(translations.shift()!)
          if (trivia.length > 0) interleaved.push(trivia.shift()!)
          if (sayItBack.length > 0) interleaved.push(sayItBack.shift()!)

          // Remaining: weighted pattern (T, T, Tr, T, T, S)
          while (translations.length > 0 || trivia.length > 0 || sayItBack.length > 0) {
            // 2 translations
            if (translations.length > 0) interleaved.push(translations.shift()!)
            if (translations.length > 0) interleaved.push(translations.shift()!)
            // 1 trivia
            if (trivia.length > 0) interleaved.push(trivia.shift()!)
            // 2 translations
            if (translations.length > 0) interleaved.push(translations.shift()!)
            if (translations.length > 0) interleaved.push(translations.shift()!)
            // 1 say-it-back
            if (sayItBack.length > 0) interleaved.push(sayItBack.shift()!)
          }

          // Replace dueCards with non-new + interleaved new
          dueCards.length = 0
          dueCards.push(...nonNewCards, ...interleaved)
        }

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
    enabled: !!auth.pkpAddress(),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  }))

  return {
    get data() { return query.data },
    get isLoading() { return query.isLoading },
    get error() { return query.error },
    refetch: query.refetch,
  }
}
