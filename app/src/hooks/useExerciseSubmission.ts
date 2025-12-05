import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useLitActionGrader, type GradingParams } from './useLitActionGrader'

export interface SubmissionResult {
  transcript?: string
  score?: number
  feedback: {
    isCorrect: boolean
    message: string
  }
  canAdvance: boolean
}

/**
 * Hook for handling exercise submissions with optimistic UI updates
 *
 * Strategy:
 * 1. Calculate feedback immediately (no waiting)
 * 2. Allow user to advance immediately
 * 3. Submit to blockchain in background
 * 4. Handle errors gracefully with toast notifications
 */
export function useExerciseSubmission() {
  const { grade } = useLitActionGrader()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const submitSayItBack = useCallback(async (
    params: GradingParams
  ): Promise<SubmissionResult> => {
    console.log('[useExerciseSubmission] SAY_IT_BACK submission starting...')

    // Background: Submit to blockchain and get actual grading
    const resultPromise = grade(params)
      .then(result => {
        if (result?.txHash) {
          console.log('[useExerciseSubmission] ✅ Blockchain submission successful:', result.txHash)
          // Invalidate study cards to reflect new FSRS state
          // Note: currentCard is pinned in useStudySession, so UI won't jump
          // even if query refetches before subgraph indexes
          queryClient.invalidateQueries({ queryKey: ['study-cards'] })
        } else {
          console.warn('[useExerciseSubmission] ⚠️ No transaction hash returned')
        }
        return result
      })
      .catch(error => {
        console.error('[useExerciseSubmission] ❌ Blockchain submission failed:', error)
        toast.error('Failed to save progress to blockchain')
        throw error
      })

    // Wait for actual grading result
    const gradingResult = await resultPromise

    if (!gradingResult) {
      throw new Error('Grading failed - no result returned')
    }

    // Map rating to feedback
    const ratingMessages: Record<string, string> = {
      Easy: t('study.feedbackExcellent'),
      Good: t('study.feedbackGreat'),
      Hard: t('study.feedbackNice'),
      Again: t('study.feedbackTryAgain'),
    }
    const isCorrect = gradingResult.rating !== 'Again'
    const message = ratingMessages[gradingResult.rating] ?? t('study.feedbackNice')

    return {
      transcript: gradingResult.transcript,
      score: gradingResult.score,
      feedback: { isCorrect, message },
      canAdvance: true,
    }
  }, [grade, queryClient, t])

  const submitMultipleChoice = useCallback(async (
    params: GradingParams,
    isCorrectAnswer: boolean
  ): Promise<SubmissionResult> => {
    console.log('[useExerciseSubmission] MULTIPLE_CHOICE submission starting...')

    // Optimistic: Show immediate feedback (frontend already knows if correct)
    const optimisticFeedback = {
      isCorrect: isCorrectAnswer,
      message: isCorrectAnswer ? t('study.feedbackCorrect') : t('study.feedbackIncorrect'),
    }

    console.log('[useExerciseSubmission] ✅ Instant feedback shown, submitting to blockchain in background...')

    // Background: Submit to blockchain (non-blocking)
    grade(params)
      .then(result => {
        if (result?.txHash) {
          console.log('[useExerciseSubmission] ✅ Background blockchain update complete:', result.txHash)
          // Invalidate study cards to reflect new FSRS state
          // Note: currentCard is pinned in useStudySession, so UI won't jump
          queryClient.invalidateQueries({ queryKey: ['study-cards'] })
        } else {
          console.warn('[useExerciseSubmission] ⚠️ Blockchain update returned no txHash')
        }
      })
      .catch(error => {
        console.error('[useExerciseSubmission] ❌ Background blockchain update failed:', error)
        // FSRS state won't update, but user already got feedback
        // Card will reappear later with correct FSRS schedule
        toast.error('Failed to save progress to blockchain')
      })

    // Return immediately - don't wait for blockchain
    return {
      feedback: optimisticFeedback,
      canAdvance: true,
    }
  }, [grade, queryClient, t])

  return {
    submitSayItBack,
    submitMultipleChoice,
  }
}
