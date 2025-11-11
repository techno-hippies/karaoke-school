import { useQuery } from '@tanstack/react-query'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Quiz metadata structure from Grove
 * Used for TRANSLATION_QUIZ and TRIVIA_QUIZ exercise types
 */
export interface QuizMetadata {
  question: string
  options: Array<{
    id: string | number
    text: string
  }>
  correctAnswer: string | number
  explanation?: string
  type: 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ'
}

/**
 * Fetch quiz question data from Grove
 *
 * @param metadataUri Grove URI pointing to quiz JSON
 * @returns Quiz metadata with question, options, and correct answer
 */
export function useQuizMetadata(metadataUri?: string) {
  return useQuery({
    queryKey: ['quiz-metadata', metadataUri],
    queryFn: async (): Promise<QuizMetadata> => {
      if (!metadataUri) {
        throw new Error('No metadata URI provided')
      }

      const url = convertGroveUri(metadataUri)

      if (!url) {
        throw new Error('Invalid quiz metadata URI')
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch quiz metadata: ${response.status}`)
      }

      const data = await response.json()

      // Transform Grove metadata structure to expected format
      // Grove uses: { prompt, correctAnswer, distractorPool, explanation }
      // UI expects: { question, options: [{id, text}], correctAnswer: id }

      const hasPrompt = data.prompt && typeof data.prompt === 'string'
      const hasCorrectAnswer = data.correctAnswer && typeof data.correctAnswer === 'string'
      const hasDistractors = data.distractorPool && Array.isArray(data.distractorPool)

      if (!hasPrompt || !hasCorrectAnswer || !hasDistractors) {
        console.error('[useQuizMetadata] Invalid Grove structure:', {
          hasPrompt,
          hasCorrectAnswer,
          hasDistractors,
          data
        })
        throw new Error('Invalid quiz metadata: missing prompt, correctAnswer, or distractorPool')
      }

      // Build options array with correct answer + distractors
      // Limit to 5 total options (1 correct + 4 random distractors) like Duolingo
      const MAX_OPTIONS = 5
      const MAX_DISTRACTORS = MAX_OPTIONS - 1

      // Randomly select distractors if we have more than needed
      let selectedDistractors = data.distractorPool
      if (data.distractorPool.length > MAX_DISTRACTORS) {
        // Shuffle and take first N distractors
        selectedDistractors = [...data.distractorPool]
          .sort(() => Math.random() - 0.5)
          .slice(0, MAX_DISTRACTORS)
      }

      const allOptions = [
        data.correctAnswer,
        ...selectedDistractors
      ]

      // Shuffle options so correct answer isn't always first
      const shuffled = allOptions
        .map((text, index) => ({ id: index, text, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ id, text }, newIndex) => ({ id: newIndex, text, originalId: id }))

      // Find the new position of the correct answer
      const correctAnswerIndex = shuffled.findIndex(opt => opt.text === data.correctAnswer)

      const transformed: QuizMetadata = {
        question: data.prompt,
        options: shuffled.map(opt => ({ id: opt.id, text: opt.text })),
        correctAnswer: correctAnswerIndex,
        explanation: data.explanation,
        type: data.exerciseType === 'translation_multiple_choice'
          ? 'TRANSLATION_QUIZ'
          : 'TRIVIA_QUIZ'
      }

      console.log('[useQuizMetadata] Transformed quiz:', {
        original: { prompt: data.prompt, correctAnswer: data.correctAnswer },
        transformed: { question: transformed.question, correctAnswerIndex }
      })

      return transformed
    },
    enabled: !!metadataUri,
    staleTime: 300000, // 5 minutes
    retry: 2,
  })
}
