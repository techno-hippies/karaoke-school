import { useQuery } from '@tanstack/react-query'
import { useSegmentMetadata } from './useSegmentV2'
import { useQuizMetadata } from './useQuizMetadata'
import type { StudyCard } from './useStudyCards'

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

export type ExerciseData = SayItBackData | MultipleChoiceData | { type: 'LOADING' }

/**
 * Hook for fetching type-specific exercise data
 *
 * Handles:
 * - SAY_IT_BACK: segment metadata, alignment, translation, exercise text extraction
 * - MULTIPLE_CHOICE: quiz metadata, options formatting
 * - Proper loading states with keepPreviousData for smooth transitions
 */
export function useExerciseData(card?: StudyCard): ExerciseData {
  const isSayItBack = card?.exerciseType === 'SAY_IT_BACK'

  // SAY_IT_BACK data fetching
  const { data: segmentMetadata, isLoading: isLoadingSegment } = useSegmentMetadata(
    isSayItBack ? card?.metadataUri : undefined
  )

  const alignmentUri = segmentMetadata?.assets?.alignment
  const { data: alignmentData, isLoading: isLoadingAlignment } = useQuery({
    queryKey: ['alignment', alignmentUri],
    queryFn: async () => {
      if (!alignmentUri) throw new Error('Alignment URI required')
      const response = await fetch(alignmentUri)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
      return response.json()
    },
    enabled: !!alignmentUri && isSayItBack,
    staleTime: 300000,
    keepPreviousData: true,
  })

  const firstTranslation = segmentMetadata?.translations?.[0]
  const { data: translationData, isLoading: isLoadingTranslation } = useQuery({
    queryKey: ['translation-first', firstTranslation?.grove_url],
    queryFn: async () => {
      if (!firstTranslation?.grove_url) throw new Error('Translation URI required')
      const response = await fetch(firstTranslation.grove_url)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
      return response.json()
    },
    enabled: !!firstTranslation?.grove_url && isSayItBack,
    staleTime: 300000,
    keepPreviousData: true,
  })

  // MULTIPLE_CHOICE data fetching
  const { data: quizMetadata, isLoading: isLoadingQuiz } = useQuizMetadata(
    !isSayItBack ? card?.metadataUri : undefined
  )

  // Return loading state if no card
  if (!card) {
    return { type: 'LOADING' }
  }

  // SAY_IT_BACK exercise
  if (isSayItBack) {
    const isLoading = isLoadingSegment || isLoadingAlignment || isLoadingTranslation

    // Extract exercise text from translation or alignment
    let exerciseText = ''
    const lineIndex = card.lineIndex ?? 0

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
    }

    return {
      type: 'SAY_IT_BACK',
      exerciseText,
      instrumentalUri: segmentMetadata?.assets?.instrumental || '',
      segmentMetadata,
      alignmentData,
      translationData,
      isLoading,
    }
  }

  // MULTIPLE_CHOICE exercise
  const isLoading = isLoadingQuiz

  if (!quizMetadata?.question || !quizMetadata?.options) {
    return { type: 'LOADING' }
  }

  return {
    type: 'MULTIPLE_CHOICE',
    question: quizMetadata.question,
    options: quizMetadata.options.map(opt => ({
      id: String(opt.id),
      text: opt.text,
      isCorrect: String(opt.id) === String(quizMetadata.correctAnswer),
    })),
    explanation: quizMetadata.explanation,
    exerciseType: card.exerciseType as 'TRANSLATION_MULTIPLE_CHOICE' | 'TRIVIA_MULTIPLE_CHOICE',
    isLoading,
  }
}
