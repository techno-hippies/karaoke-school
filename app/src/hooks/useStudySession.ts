import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudyCards, type StudyCard } from './useStudyCards'
import { useExerciseData } from './useExerciseData'
import { usePrefetchExercise } from './usePrefetchExercise'
import { useExerciseSubmission } from './useExerciseSubmission'
import { useAudioRecorder } from './useAudioRecorder'
import type { GradingParams } from './useLitActionGrader'

export interface StudySessionState {
  // Loading states
  isInitializing: boolean
  isLoadingExercise: boolean
  isProcessing: boolean

  // Card state
  currentCard?: StudyCard
  currentCardIndex: number
  totalCards: number
  progress: number

  // Exercise state
  exerciseData: ReturnType<typeof useExerciseData>
  isRecording: boolean
  transcript?: string
  score?: number
  feedback?: {
    isCorrect: boolean
    message: string
  }
  selectedAnswer?: string | number

  // Stats for header
  stats?: {
    currentCard: number
    totalCards: number
    newToday: number
    newRemaining: number
    reviewCount: number
    learningCount: number
  }

  // Handlers
  handleStartRecording: () => Promise<void>
  handleStopRecording: () => Promise<void>
  handleAnswerSubmit: (selectedId: string | number, isCorrect?: boolean) => Promise<void>
  handleNext: () => void
  handleClose: () => void
}

/**
 * Main orchestration hook for study sessions
 *
 * Responsibilities:
 * - Manage card progression
 * - Coordinate data fetching (current + prefetch next)
 * - Handle exercise submissions
 * - Manage recording state
 * - Calculate progress and stats
 */
export function useStudySession(songId?: string): StudySessionState {
  const navigate = useNavigate()
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number>()
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string }>()
  const [selectedAnswer, setSelectedAnswer] = useState<string | number>()

  // Data hooks
  const studyCardsQuery = useStudyCards(songId)
  const dueCards = studyCardsQuery.data?.cards || []
  const stats = studyCardsQuery.data?.stats
  const currentCard = dueCards[currentCardIndex]
  const nextCard = dueCards[currentCardIndex + 1]

  // Prefetch next card in background
  usePrefetchExercise(nextCard)

  // Fetch current exercise data
  const exerciseData = useExerciseData(currentCard)

  // Submission hooks
  const { submitSayItBack, submitMultipleChoice } = useExerciseSubmission()
  const audioRecorder = useAudioRecorder()

  // SAY_IT_BACK handlers
  const handleStartRecording = useCallback(async () => {
    setIsRecording(true)
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
    console.log('[useStudySession] Start recording...')

    try {
      await audioRecorder.startRecording()
    } catch (error) {
      console.error('[useStudySession] Failed to start recording:', error)
      setIsRecording(false)
      setFeedback({
        isCorrect: false,
        message: 'Microphone access denied. Please enable microphone permissions.',
      })
    }
  }, [audioRecorder])

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false)
    setIsProcessing(true)
    console.log('[useStudySession] Stop recording...')

    try {
      if (!currentCard) throw new Error('No current card loaded')
      if (exerciseData.type !== 'SAY_IT_BACK') throw new Error('Wrong exercise type')
      if (!exerciseData.instrumentalUri) throw new Error('No instrumental audio')
      if (!exerciseData.exerciseText) throw new Error('No exercise text')
      if (!currentCard.lineId || !currentCard.segmentHash) {
        throw new Error('Missing line identifiers')
      }

      const recordingData = await audioRecorder.stopRecording()
      if (!recordingData) throw new Error('Failed to record audio')

      console.log('[useStudySession] Recording complete - size:', recordingData.blob.size)

      const gradingParams: GradingParams = {
        exerciseType: 'SAY_IT_BACK',
        audioDataBase64: recordingData.base64,
        expectedText: exerciseData.exerciseText,
        lineId: currentCard.lineId,
        lineIndex: currentCard.lineIndex ?? 0,
        segmentHash: currentCard.segmentHash,
        metadataUri: recordingData.groveUri,
      }

      const result = await submitSayItBack(gradingParams, exerciseData.exerciseText)

      setTranscript(result.transcript)
      setScore(result.score)
      setFeedback(result.feedback)

      console.log('[useStudySession] ✓ Grading flow complete')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('[useStudySession] Grading failed:', error)
      setFeedback({
        isCorrect: false,
        message: `Error: ${errorMessage}`,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [audioRecorder, submitSayItBack, currentCard, exerciseData])

  // Multiple choice handler
  const handleAnswerSubmit = useCallback(async (
    selectedId: string | number,
    isCorrectFromOption?: boolean
  ) => {
    if (!currentCard || exerciseData.type !== 'MULTIPLE_CHOICE') return

    setIsProcessing(true)
    setSelectedAnswer(selectedId)

    try {
      const wasCorrect = isCorrectFromOption ?? false
      const selectedOption = exerciseData.options.find(opt => String(opt.id) === String(selectedId))
      const correctOption = exerciseData.options.find(opt => opt.isCorrect)

      if (!selectedOption || !correctOption) {
        throw new Error('Could not find selected or correct option')
      }

      // Map exercise type from subgraph format to Lit Action format
      const litActionExerciseType = currentCard.exerciseType === 'TRANSLATION_MULTIPLE_CHOICE'
        ? 'TRANSLATION_QUIZ'
        : currentCard.exerciseType === 'TRIVIA_MULTIPLE_CHOICE'
        ? 'TRIVIA_QUIZ'
        : currentCard.exerciseType

      const gradingParams: GradingParams = {
        exerciseType: litActionExerciseType as 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ',
        attemptId: Date.now(),
        questionId: currentCard.questionId || currentCard.id,
        userAnswer: selectedOption.text,
        correctAnswer: correctOption.text,
        metadataUri: currentCard.metadataUri,
      }

      const result = await submitMultipleChoice(gradingParams, wasCorrect)

      setTranscript(undefined)
      setScore(undefined)
      setFeedback(result.feedback)

      console.log('[useStudySession] ✅ Quiz grading complete')
    } catch (error) {
      console.error('[useStudySession] Quiz grading error:', error)
      setFeedback({
        isCorrect: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [submitMultipleChoice, currentCard, exerciseData])

  const handleNext = useCallback(() => {
    console.log('[useStudySession] Moving to next card...')
    setCurrentCardIndex(prev => {
      const nextIndex = prev + 1
      console.log(`[useStudySession] Card index: ${prev} → ${nextIndex} (of ${dueCards.length})`)

      if (nextIndex >= dueCards.length) {
        console.log('[useStudySession] ✓ Study session complete!')
        setTimeout(() => {
          if (confirm('Study session complete! Return to study page?')) {
            navigate('/study')
          }
        }, 500)
      }

      return nextIndex
    })
    // Clear state for next card
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
    setSelectedAnswer(undefined)
  }, [dueCards.length, navigate])

  const handleClose = useCallback(() => {
    if (confirm('Exit study session? Progress will be saved.')) {
      navigate('/study')
    }
  }, [navigate])

  // Calculate progress
  const progress = dueCards.length > 0 ? Math.round((currentCardIndex / dueCards.length) * 100) : 0

  // Build stats for header
  const headerStats = stats ? {
    currentCard: currentCardIndex + 1,
    totalCards: dueCards.length,
    newToday: stats.newCardsIntroducedToday,
    newRemaining: stats.newCardsRemaining,
    reviewCount: stats.review + stats.relearning,
    learningCount: stats.learning,
  } : undefined

  return {
    isInitializing: studyCardsQuery.isLoading && !studyCardsQuery.data,
    isLoadingExercise: exerciseData.type === 'LOADING' || exerciseData.isLoading,
    isProcessing,
    currentCard,
    currentCardIndex,
    totalCards: dueCards.length,
    progress,
    exerciseData,
    isRecording,
    transcript,
    score,
    feedback,
    selectedAnswer,
    stats: headerStats,
    handleStartRecording,
    handleStopRecording,
    handleAnswerSubmit,
    handleNext,
    handleClose,
  }
}
