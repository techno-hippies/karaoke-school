import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { StudyCard } from './useStudyCards'
import { fetchQuizMetadata } from './useQuizMetadata'

/**
 * Hook for prefetching exercise data in the background
 *
 * Loads the next card's metadata while the user is working on the current card,
 * ensuring zero wait time when advancing to the next exercise.
 *
 * Strategy:
 * - SAY_IT_BACK: Prefetch segment metadata, alignment, and translation in parallel
 * - MULTIPLE_CHOICE: Prefetch quiz metadata
 */
export function usePrefetchExercise(card?: StudyCard) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!card) return

    if (card.exerciseType === 'SAY_IT_BACK') {
      // Prefetch segment metadata
      queryClient.prefetchQuery({
        queryKey: ['segment-metadata', card.metadataUri],
        queryFn: async () => {
          const response = await fetch(card.metadataUri)
          if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
          return response.json()
        },
        staleTime: 300000, // 5 minutes
      })

      // Prefetch alignment data (if available)
      if (card.alignmentUri) {
        queryClient.prefetchQuery({
          queryKey: ['alignment', card.alignmentUri],
          queryFn: async () => {
            const response = await fetch(card.alignmentUri)
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
            return response.json()
          },
          staleTime: 300000, // 5 minutes
        })
      }

      // Prefetch first translation (if available)
      if (card.translations && card.translations.length > 0) {
        const firstTranslation = card.translations[0]
        queryClient.prefetchQuery({
          queryKey: ['translation-first', firstTranslation.translationUri],
          queryFn: async () => {
            const response = await fetch(firstTranslation.translationUri)
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
            return response.json()
          },
          staleTime: 300000, // 5 minutes
        })
      }
    } else if (
      card.exerciseType === 'TRANSLATION_MULTIPLE_CHOICE' ||
      card.exerciseType === 'TRIVIA_MULTIPLE_CHOICE'
    ) {
      // Prefetch quiz metadata using the same transformer as the live query
      queryClient.prefetchQuery({
        queryKey: ['quiz-metadata', card.metadataUri],
        queryFn: async () => fetchQuizMetadata(card.metadataUri ?? ''),
        staleTime: 300000, // 5 minutes
      })
    }
  }, [card, queryClient])
}
