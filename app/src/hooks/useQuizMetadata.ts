import { createQuery } from '@tanstack/solid-query'
import { buildManifest, fetchJson } from '@/lib/storage'
import type { Accessor } from 'solid-js'

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
 * Fetch quiz metadata from Grove/IPFS
 *
 * @param metadataUri Grove or HTTPS URI pointing directly to the quiz JSON
 * @returns Quiz metadata with question, options, and answer mapping
 */
export async function fetchQuizMetadata(metadataUri: string): Promise<QuizMetadata> {
  if (!metadataUri) {
    throw new Error('No metadata URI provided')
  }

  console.log('[useQuizMetadata] 🌐 Fetching quiz metadata', { metadataUri })

  // Use multi-gateway fallback: Cache → Grove → Arweave → Lighthouse
  const manifest = buildManifest(metadataUri)
  const data = await fetchJson<any>(manifest)

  console.log('[useQuizMetadata] ✅ Fetch success', { metadataUri })

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
      data,
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
    ...selectedDistractors,
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
      : 'TRIVIA_QUIZ',
  }

  console.log('[useQuizMetadata] Transformed quiz:', {
    original: { prompt: data.prompt, correctAnswer: data.correctAnswer },
    transformed: { question: transformed.question, correctAnswerIndex },
  })

  return transformed
}

/**
 * Fetch quiz question data from Grove with language preference support
 *
 * @param metadataUri Grove URI accessor pointing to quiz JSON
 * @returns Quiz metadata with question, options, correct answer, and explanation
 */
export function useQuizMetadata(metadataUri: Accessor<string | undefined>) {
  const query = createQuery(() => ({
    queryKey: ['quiz-metadata', metadataUri()],
    queryFn: async () => {
      const uri = metadataUri()
      if (!uri) {
        throw new Error('No metadata URI provided')
      }

      try {
        const data = await fetchQuizMetadata(uri)
        return data
      } catch (error) {
        console.error('[useQuizMetadata] ❌ Fetch failed', {
          metadataUri: uri,
          error,
        })
        throw error
      }
    },
    enabled: !!metadataUri(),
    staleTime: 300000, // 5 minutes
    retry: 2,
    placeholderData: (prev) => prev,
  }))

  return {
    get data() { return query.data },
    get isLoading() { return query.isLoading },
    get error() { return query.error },
  }
}
