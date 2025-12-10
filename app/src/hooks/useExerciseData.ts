import { createQuery } from '@tanstack/solid-query'
import { createMemo } from 'solid-js'
import { useSegmentMetadata } from './useSegmentMetadata'
import { useQuizMetadata } from './useQuizMetadata'
import { buildManifest, fetchJson } from '@/lib/storage'
import type { StudyCard } from '@/types/study'
import type { Accessor } from 'solid-js'

/** Alignment data structure from Grove storage */
interface AlignmentData {
  words?: Array<{ text?: string; word?: string; start?: number; end?: number }>
}

/** Translation data structure from Grove storage */
interface TranslationData {
  lines?: Array<{
    originalText?: string
    text?: string
    translatedText?: string
  }>
}

export interface SayItBackData {
  type: 'SAY_IT_BACK'
  exerciseText: string
  instrumentalUri: string
  segmentMetadata: any
  alignmentData?: any
  translationData?: any
  isLoading: boolean
}

export interface MultipleChoiceData {
  type: 'MULTIPLE_CHOICE'
  question: string
  options: Array<{
    id: string
    text: string
    isCorrect: boolean
  }>
  explanation?: string
  exerciseType: 'TRANSLATION_MULTIPLE_CHOICE' | 'TRIVIA_MULTIPLE_CHOICE'
  isLoading: boolean
}

export interface LoadingExerciseData {
  type: 'LOADING'
  isLoading: true
}

export interface ErrorExerciseData {
  type: 'ERROR'
  message: string
  isLoading: false
}

export type ExerciseData = SayItBackData | MultipleChoiceData | LoadingExerciseData | ErrorExerciseData

/**
 * Hook for fetching type-specific exercise data
 *
 * Handles:
 * - SAY_IT_BACK: segment metadata, alignment, translation, exercise text extraction
 * - MULTIPLE_CHOICE: quiz metadata, options formatting
 * - Proper loading states for smooth transitions
 */
export function useExerciseData(card: Accessor<StudyCard | undefined>): Accessor<ExerciseData> {
  const isSayItBack = createMemo(() => card()?.exerciseType === 'SAY_IT_BACK')

  // Debug: log card details to diagnose blank exercise issue
  createMemo(() => {
    const c = card()
    if (c) {
      console.log('[useExerciseData] Card details:', {
        id: c.id?.substring(0, 20),
        exerciseType: c.exerciseType,
        lineIndex: c.lineIndex,
        metadataUri: c.metadataUri?.substring(0, 60),
        isSayItBack: isSayItBack(),
      })
    }
  })

  // SAY_IT_BACK data fetching
  const segmentMetadata = useSegmentMetadata(
    () => isSayItBack() ? card()?.metadataUri : undefined
  )

  const alignmentUri = createMemo(() => segmentMetadata.data?.assets?.alignment)

  const alignmentQuery = createQuery(() => ({
    queryKey: ['alignment', alignmentUri()],
    queryFn: async () => {
      const uri = alignmentUri()
      if (!uri) throw new Error('Alignment URI required')
      // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
      const manifest = buildManifest(uri)
      return fetchJson<AlignmentData>(manifest)
    },
    enabled: !!alignmentUri() && isSayItBack(),
    staleTime: 300000,
    placeholderData: (prev) => prev,
  }))

  const firstTranslation = createMemo(() => segmentMetadata.data?.translations?.[0])

  const translationQuery = createQuery(() => ({
    queryKey: ['translation-first', firstTranslation()?.grove_url],
    queryFn: async () => {
      const url = firstTranslation()?.grove_url
      if (!url) throw new Error('Translation URI required')
      // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
      const manifest = buildManifest(url)
      return fetchJson<TranslationData>(manifest)
    },
    enabled: !!firstTranslation()?.grove_url && isSayItBack(),
    staleTime: 300000,
    placeholderData: (prev) => prev,
  }))

  // MULTIPLE_CHOICE data fetching
  const quizMetadata = useQuizMetadata(
    () => !isSayItBack() ? card()?.metadataUri : undefined
  )

  // Build exercise data from reactive sources
  return createMemo((): ExerciseData => {
    const currentCard = card()

    // Return loading state if no card
    if (!currentCard) {
      return { type: 'LOADING', isLoading: true }
    }

    // SAY_IT_BACK exercise
    if (isSayItBack()) {
      const isLoading = segmentMetadata.isLoading || alignmentQuery.isLoading || translationQuery.isLoading

      // Extract exercise text from translation, alignment, or karaoke_lines
      let exerciseText = ''
      const lineIndex = currentCard.lineIndex ?? 0

      const translationData = translationQuery.data
      const alignmentData = alignmentQuery.data
      const metadata = segmentMetadata.data

      if (translationData?.lines?.[lineIndex]?.originalText) {
        exerciseText = translationData.lines[lineIndex].originalText
      } else if (translationData?.lines?.[lineIndex]?.text) {
        exerciseText = translationData.lines[lineIndex].text
      } else if (alignmentData?.words && Array.isArray(alignmentData.words)) {
        const wordsPerLine = 6
        const startWord = lineIndex * wordsPerLine
        const endWord = startWord + wordsPerLine
        const lineWords = alignmentData.words.slice(startWord, endWord)
        exerciseText = lineWords.map((w: any) => w.text || w.word).join(' ')
      } else if (metadata?.karaoke_lines?.[lineIndex]) {
        // Fallback: extract from karaoke_lines embedded in clip metadata
        const line = metadata.karaoke_lines[lineIndex]
        exerciseText = line.original_text || line.text || ''
      }

      // Debug: log segment metadata to diagnose instrumental issue
      console.log('[useExerciseData] SAY_IT_BACK data:', {
        hasSegmentMetadata: !!metadata,
        assets: metadata?.assets,
        instrumentalFromCard: currentCard.instrumentalUri,
      })

      // Use instrumentalUri from card (populated from subgraph) as fallback
      const instrumentalUri = metadata?.assets?.instrumental || currentCard.instrumentalUri || ''

      return {
        type: 'SAY_IT_BACK',
        exerciseText,
        instrumentalUri,
        segmentMetadata: metadata,
        alignmentData,
        translationData,
        isLoading,
      }
    }

    // MULTIPLE_CHOICE exercise
    const isLoading = quizMetadata.isLoading
    const quizData = quizMetadata.data
    const quizError = quizMetadata.error

    if (!quizData?.question || !quizData?.options) {
      if (quizError instanceof Error) {
        return { type: 'ERROR', message: quizError.message, isLoading: false }
      }
      return { type: 'LOADING', isLoading: true }
    }

    return {
      type: 'MULTIPLE_CHOICE',
      question: quizData.question,
      options: quizData.options.map(opt => ({
        id: String(opt.id),
        text: opt.text,
        isCorrect: String(opt.id) === String(quizData.correctAnswer),
      })),
      explanation: quizData.explanation,
      exerciseType: currentCard.exerciseType as 'TRANSLATION_MULTIPLE_CHOICE' | 'TRIVIA_MULTIPLE_CHOICE',
      isLoading,
    }
  })
}
