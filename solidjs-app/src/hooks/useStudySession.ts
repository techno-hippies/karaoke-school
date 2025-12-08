import { createSignal, createEffect, createMemo, onCleanup } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useStudyCards } from './useStudyCards'
import { useExerciseData, type ExerciseData } from './useExerciseData'
import { usePrefetchExercise } from './usePrefetchExercise'
import { useExerciseSubmission } from './useExerciseSubmission'
import { createAudioRecorder } from './useAudioRecorder'
import type { GradingParams } from './useLitActionGrader'
import type { StudyCard } from '@/types/study'
import type { Accessor } from 'solid-js'

const EMPTY_CARDS: StudyCard[] = []

// Feedback sound effects
const CORRECT_SOUND_URL = '/audio/correct.mp3'
const INCORRECT_SOUND_URL = '/audio/incorrect.mp3'

function playFeedbackSound(isCorrect: boolean) {
  const audio = new Audio(isCorrect ? CORRECT_SOUND_URL : INCORRECT_SOUND_URL)
  audio.play().catch(err => {
    console.warn('[useStudySession] Failed to play feedback sound:', err)
  })
}

export interface StudySessionState {
  // Loading states
  isInitializing: Accessor<boolean>
  isLoadingExercise: Accessor<boolean>
  isProcessing: Accessor<boolean>

  // Card state
  currentCard: Accessor<StudyCard | undefined>
  currentCardIndex: Accessor<number>
  totalCards: Accessor<number>
  initialTotalCards: Accessor<number>
  progress: Accessor<number>

  // Exercise state
  exerciseData: Accessor<ExerciseData>
  isRecording: Accessor<boolean>
  transcript: Accessor<string | undefined>
  score: Accessor<number | undefined>
  feedback: Accessor<{ isCorrect: boolean; message: string } | undefined>
  selectedAnswer: Accessor<string | number | undefined>

  // Stats for header
  stats: Accessor<{
    currentCard: number
    totalCards: number
    newToday: number
    newRemaining: number
    reviewCount: number
    learningCount: number
  } | undefined>

  // Song metadata for completion CTAs
  songTitle: Accessor<string | undefined>
  artistName: Accessor<string | undefined>
  spotifyTrackIds: Accessor<string[]>

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
export function useStudySession(
  songId?: Accessor<string | undefined>,
  options?: {
    exitPath?: string
  }
): StudySessionState {
  const navigate = useNavigate()
  const exitPath = options?.exitPath ?? '/study'
  const [currentCardIndex, setCurrentCardIndex] = createSignal(0)
  const [isRecording, setIsRecording] = createSignal(false)
  const [isProcessing, setIsProcessing] = createSignal(false)
  const [transcript, setTranscript] = createSignal<string>()
  const [score, setScore] = createSignal<number>()
  const [feedback, setFeedback] = createSignal<{ isCorrect: boolean; message: string }>()
  const [selectedAnswer, setSelectedAnswer] = createSignal<string | number>()
  const [initialTotalCards, setInitialTotalCards] = createSignal(0)

  // Pin active card to prevent reactive changes during exercise
  const [pinnedCard, setPinnedCard] = createSignal<StudyCard | undefined>()
  const [pinnedCardIndex, setPinnedCardIndex] = createSignal(0)

  // Data hooks
  const studyCardsQuery = useStudyCards(songId)
  const dueCards = createMemo(() => studyCardsQuery.data?.cards ?? EMPTY_CARDS)
  const stats = createMemo(() => studyCardsQuery.data?.stats)

  // Get live card at current index
  const liveCard = createMemo(() => dueCards()[currentCardIndex()])

  // Use pinned card if available, otherwise fall back to live card
  const currentCard = createMemo(() => pinnedCard() ?? liveCard())
  const nextCard = createMemo(() => dueCards()[currentCardIndex() + 1])
  const primaryCard = createMemo(() => currentCard() ?? dueCards()[0])
  const displayCard = createMemo(() => currentCard() ?? primaryCard())

  const spotifyTrackIds = createMemo(() => {
    const ids = new Set<string>()
    for (const card of dueCards()) {
      if (card.spotifyTrackId) {
        ids.add(card.spotifyTrackId)
      }
    }
    return Array.from(ids)
  })

  const songTitle = createMemo(() => displayCard()?.title)
  const artistName = createMemo(() => displayCard()?.artist)

  createEffect(() => {
    if (dueCards().length === 0) return
    setInitialTotalCards(prev => (prev === 0 ? dueCards().length : Math.max(prev, dueCards().length)))
  })

  // Pin the card when the active index changes (user navigates)
  // Ignore reactive changes to dueCards while the user is on the same index
  createEffect(() => {
    const nextCard = dueCards()[currentCardIndex()]

    if (!nextCard) {
      if (pinnedCard()) {
        console.warn('[useStudySession] ⚠️ No card found at index, keeping previous pin')
      }
      return
    }

    const indexChanged = currentCardIndex() !== pinnedCardIndex()
    const needsInitialPin = !pinnedCard()

    if (needsInitialPin || indexChanged) {
      console.log('[useStudySession] 📌 Pinning card:', nextCard.id, 'lineIndex:', nextCard.lineIndex)
      setPinnedCard(nextCard)
      setPinnedCardIndex(currentCardIndex())
    }
  })

  // Prefetch next card in background
  usePrefetchExercise(nextCard)

  // Fetch current exercise data
  const exerciseData = useExerciseData(currentCard)

  // Submission hooks
  const { submitSayItBack, submitMultipleChoice } = useExerciseSubmission()
  const audioRecorder = createAudioRecorder()

  // SAY_IT_BACK handlers
  const handleStartRecording = async () => {
    console.log('[useStudySession] handleStartRecording called!')
    console.log('[useStudySession] Current state - isRecording:', isRecording(), 'isProcessing:', isProcessing())
    setIsRecording(true)
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
    console.log('[useStudySession] State updated, isRecording now:', isRecording())

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
  }

  const handleStopRecording = async () => {
    setIsRecording(false)
    setIsProcessing(true)
    console.log('[useStudySession] Stop recording...')

    try {
      const card = currentCard()
      const exercise = exerciseData()

      if (!card) throw new Error('No current card loaded')
      if (exercise.type !== 'SAY_IT_BACK') throw new Error('Wrong exercise type')
      if (!exercise.instrumentalUri) throw new Error('No instrumental audio')
      if (!exercise.exerciseText) throw new Error('No exercise text')
      if (!card.lineId || !card.segmentHash) {
        throw new Error('Missing line identifiers')
      }

      const recordingData = await audioRecorder.stopRecording()
      if (!recordingData) throw new Error('Failed to record audio')

      console.log('[useStudySession] Recording complete - size:', recordingData.blob.size)

      const gradingParams: GradingParams = {
        exerciseType: 'SAY_IT_BACK',
        audioDataBase64: recordingData.base64,
        expectedText: exercise.exerciseText,
        lineId: card.lineId,
        lineIndex: card.lineIndex ?? 0,
        segmentHash: card.segmentHash,
        metadataUri: card.metadataUri,
      }

      const result = await submitSayItBack(gradingParams)

      setTranscript(result.transcript)
      setScore(result.score)
      setFeedback(result.feedback)
      playFeedbackSound(result.feedback.isCorrect)

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
  }

  // Multiple choice handler
  const handleAnswerSubmit = async (
    selectedId: string | number,
    isCorrectFromOption?: boolean
  ) => {
    const card = currentCard()
    const exercise = exerciseData()

    if (!card || exercise.type !== 'MULTIPLE_CHOICE') return

    setIsProcessing(true)
    setSelectedAnswer(selectedId)

    try {
      const wasCorrect = isCorrectFromOption ?? false
      const selectedOption = exercise.options.find(opt => String(opt.id) === String(selectedId))
      const correctOption = exercise.options.find(opt => opt.isCorrect)

      if (!selectedOption || !correctOption) {
        throw new Error('Could not find selected or correct option')
      }

      // Map exercise type from subgraph format to Lit Action format
      const litActionExerciseType = card.exerciseType === 'TRANSLATION_MULTIPLE_CHOICE'
        ? 'TRANSLATION_QUIZ'
        : card.exerciseType === 'TRIVIA_MULTIPLE_CHOICE'
        ? 'TRIVIA_QUIZ'
        : card.exerciseType

      const gradingParams: GradingParams = {
        exerciseType: litActionExerciseType as 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ',
        attemptId: Date.now(),
        questionId: card.questionId || card.id,
        userAnswer: selectedOption.text,
        correctAnswer: correctOption.text,
        metadataUri: card.metadataUri,
      }

      const result = await submitMultipleChoice(gradingParams, wasCorrect)

      setTranscript(undefined)
      setScore(undefined)
      setFeedback(result.feedback)
      playFeedbackSound(result.feedback.isCorrect)

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
  }

  const handleNext = () => {
    console.log('[useStudySession] Moving to next card...')
    setCurrentCardIndex(prev => {
      const nextIndex = prev + 1
      console.log(`[useStudySession] Card index: ${prev} → ${nextIndex} (of ${dueCards().length})`)

      return nextIndex
    })
    // Clear state for next card
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
    setSelectedAnswer(undefined)
  }

  const handleClose = () => {
    navigate(exitPath, { replace: true })
  }

  // Calculate progress
  const progress = createMemo(() =>
    dueCards().length > 0 ? Math.round((currentCardIndex() / dueCards().length) * 100) : 0
  )

  // Build stats for header
  const headerStats = createMemo(() => {
    const s = stats()
    if (!s) return undefined
    return {
      currentCard: currentCardIndex() + 1,
      totalCards: dueCards().length,
      initialTotalCards: initialTotalCards() || dueCards().length,
      newToday: s.newCardsIntroducedToday,
      newRemaining: s.newCardsRemaining,
      reviewCount: s.review + s.relearning,
      learningCount: s.learning,
    }
  })

  // Cleanup recorder on unmount
  onCleanup(() => {
    audioRecorder.cancelRecording()
  })

  return {
    isInitializing: createMemo(() => studyCardsQuery.isLoading && !studyCardsQuery.data),
    isLoadingExercise: createMemo(() => exerciseData().type === 'LOADING' || exerciseData().isLoading),
    isProcessing,
    currentCard,
    currentCardIndex,
    totalCards: createMemo(() => dueCards().length),
    initialTotalCards,
    progress,
    exerciseData,
    isRecording,
    transcript,
    score,
    feedback,
    selectedAnswer,
    stats: headerStats,
    songTitle,
    artistName,
    spotifyTrackIds,
    handleStartRecording,
    handleStopRecording,
    handleAnswerSubmit,
    handleNext,
    handleClose,
  }
}
