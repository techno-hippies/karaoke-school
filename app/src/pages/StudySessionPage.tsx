import { useNavigate, useParams } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { useQuizMetadata } from '@/hooks/useQuizMetadata'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useLitActionGrader, type GradingParams } from '@/hooks/useLitActionGrader'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
import { MultipleChoiceQuiz } from '@/components/exercises/MultipleChoiceQuiz'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'
import { ExerciseFooter } from '@/components/exercises/ExerciseFooter'
import { Spinner } from '@/components/ui/spinner'

export function StudySessionPage() {
  const navigate = useNavigate()
  const { workId } = useParams<{ workId: string }>()
  const { isPKPReady } = useAuth()

  // Session state
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number>()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message?: string }>()
  const [selectedAnswer, setSelectedAnswer] = useState<string | number>()

  // Data hooks
  const songId = workId
  const studyCardsQuery = useStudyCards(songId || undefined)
  const queryCards = studyCardsQuery.data?.cards || []
  const queryStats = studyCardsQuery.data?.stats
  const [hasLoadedCards, setHasLoadedCards] = useState(false)
  const [visibleCards, setVisibleCards] = useState<typeof queryCards>([])
  const [visibleStats, setVisibleStats] = useState<typeof queryStats>()
  const [showEmptyState, setShowEmptyState] = useState(false)

  useEffect(() => {
    setHasLoadedCards(false)
  }, [songId])

  useEffect(() => {
    if (studyCardsQuery.isSuccess) {
      setHasLoadedCards(true)
    }
  }, [studyCardsQuery.isSuccess])

  const isLoadingCards = studyCardsQuery.isLoading && !hasLoadedCards
  const isRefetchingCards = studyCardsQuery.isFetching && hasLoadedCards

  useEffect(() => {
    if (queryCards.length > 0) {
      setVisibleCards(queryCards)
      if (queryStats) {
        setVisibleStats(queryStats)
      }
      return
    }

    if (
      hasLoadedCards &&
      studyCardsQuery.isSuccess &&
      !studyCardsQuery.isFetching &&
      queryCards.length === 0
    ) {
      setVisibleCards([])
      setVisibleStats(queryStats)
    }
  }, [
    queryCards,
    queryStats,
    hasLoadedCards,
    studyCardsQuery.isFetching,
    studyCardsQuery.isSuccess,
  ])

  useEffect(() => {
    if (
      hasLoadedCards &&
      !isLoadingCards &&
      !studyCardsQuery.isFetching &&
      visibleCards.length === 0
    ) {
      const timer = setTimeout(() => setShowEmptyState(true), 350)
      return () => clearTimeout(timer)
    }

    setShowEmptyState(false)
  }, [
    hasLoadedCards,
    isLoadingCards,
    studyCardsQuery.isFetching,
    visibleCards.length,
  ])

  const dueCards = visibleCards
  const stats = visibleStats
  const currentCard = dueCards[currentCardIndex]
  const isSayItBack = currentCard?.exerciseType === 'SAY_IT_BACK'
  const showRefetchSpinner = isRefetchingCards && dueCards.length > 0
  const showInlineQuizSpinner = showRefetchSpinner && !isSayItBack

  useEffect(() => {
    console.log('[StudySession] Card query state:', {
      status: studyCardsQuery.status,
      isLoading: studyCardsQuery.isLoading,
      isFetching: studyCardsQuery.isFetching,
      hasLoadedCards,
      dueCount: dueCards.length,
    })
  }, [
    studyCardsQuery.status,
    studyCardsQuery.isLoading,
    studyCardsQuery.isFetching,
    hasLoadedCards,
    dueCards.length,
  ])

  console.log('[StudySession] Due cards loaded:', dueCards.length)
  if (dueCards.length > 0) {
    console.log('[StudySession] First card sample:', {
      id: dueCards[0].id,
      lineId: dueCards[0].lineId,
      segmentHash: dueCards[0].segmentHash,
      lineIndex: dueCards[0].lineIndex,
      exerciseType: dueCards[0].exerciseType
    })
  }

  // Conditional metadata fetching based on exercise type
  const { data: segmentMetadata, isLoading: isLoadingSegment } = useSegmentMetadata(
    isSayItBack ? currentCard?.metadataUri : undefined
  )

  const { data: quizMetadata, isLoading: isLoadingQuiz } = useQuizMetadata(
    !isSayItBack ? currentCard?.metadataUri : undefined
  )

  // Extract English lyrics from alignment file (SAY_IT_BACK only)
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
  })

  // Fetch first translation file to get line structure (SAY_IT_BACK only)
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
  })

  // Audio recorder and grader hooks (always called for consistent hook order)
  const audioRecorder = useAudioRecorder()
  const { grade } = useLitActionGrader()

  // Extract exercise text for SAY_IT_BACK
  let exerciseText = ''
  const isLoadingText = isLoadingAlignment || isLoadingTranslation

  if (isSayItBack) {
    const lineIndex = currentCard?.lineIndex ?? 0

    if (translationData?.lines?.[lineIndex]?.originalText) {
      exerciseText = translationData.lines[lineIndex].originalText
      console.log(`[StudySession] Using originalText from translation line ${lineIndex}:`, exerciseText)
    } else if (translationData?.lines?.[lineIndex]?.text) {
      exerciseText = translationData.lines[lineIndex].text
    } else if (alignmentData?.words && Array.isArray(alignmentData.words)) {
      const wordsPerLine = 6
      const startWord = lineIndex * wordsPerLine
      const endWord = startWord + wordsPerLine
      const lineWords = alignmentData.words.slice(startWord, endWord)
      exerciseText = lineWords.map((w: any) => w.text || w.word).join(' ')
    }
  }

  // SAY_IT_BACK handlers
  const handleStartRecording = useCallback(async () => {
    setIsRecording(true)
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
    console.log('[StudySession] Start recording...')

    try {
      await audioRecorder.startRecording()
    } catch (error) {
      console.error('[StudySession] Failed to start recording:', error)
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
    console.log('[StudySession] Stop recording...')
    console.log('[StudySession] Current card:', currentCard)
    console.log('[StudySession] Card has lineId?', !!currentCard?.lineId)
    console.log('[StudySession] Card has segmentHash?', !!currentCard?.segmentHash)

    try {
      if (!currentCard) throw new Error('No current card loaded')
      if (!segmentMetadata?.assets?.instrumental) throw new Error('No instrumental audio')
      if (!exerciseText) throw new Error('No exercise text')
      if (!currentCard.lineId || !currentCard.segmentHash) {
        console.error('[StudySession] Missing identifiers. Card:', {
          lineId: currentCard.lineId,
          segmentHash: currentCard.segmentHash,
          id: currentCard.id,
          lineIndex: currentCard.lineIndex
        })
        throw new Error('Missing line identifiers')
      }

      const recordingData = await audioRecorder.stopRecording()
      if (!recordingData) throw new Error('Failed to record audio')

      console.log('[StudySession] Recording complete - size:', recordingData.blob.size)

      const gradingParams: GradingParams = {
        exerciseType: 'SAY_IT_BACK',
        audioDataBase64: recordingData.base64,
        expectedText: exerciseText,
        lineId: currentCard.lineId,
        lineIndex: currentCard.lineIndex ?? 0,
        segmentHash: currentCard.segmentHash,
        metadataUri: recordingData.groveUri,
      }

      const gradingResult = await grade(gradingParams)

      if (!gradingResult) throw new Error('Grading failed - no result returned')

      console.log('[StudySession] Grading complete:', gradingResult)

      if (gradingResult.txHash) {
        console.log('[StudySession] ✅ Performance submitted to contract, tx:', gradingResult.txHash)
        // Optimistic update: remove current card immediately
        // Subgraph will eventually sync in background
        console.log('[StudySession] Using optimistic update - card removed locally')
      } else if (gradingResult.errorType) {
        console.error('[StudySession] ❌ Transaction failed:', gradingResult.errorType)
      }

      setTranscript(gradingResult.transcript)
      setScore(gradingResult.score)

      const ratingMessages: Record<string, string> = {
        Easy: 'Excellent!',
        Good: 'Great job!',
        Hard: 'Nice work!',
        Again: 'Try again!',
      }
      const isFeedbackPositive = gradingResult.rating !== 'Again'
      const feedbackMessage = ratingMessages[gradingResult.rating] ?? 'Nice work!'

      setFeedback({
        isCorrect: isFeedbackPositive,
        message: feedbackMessage,
      })

      console.log('[StudySession] ✓ Grading flow complete')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('[StudySession] Grading failed:', error)
      setFeedback({
        isCorrect: false,
        message: `Error: ${errorMessage}`,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [audioRecorder, grade, currentCard, segmentMetadata, exerciseText, studyCardsQuery])

  // Multiple choice handler
  const handleAnswerSubmit = useCallback(async (
    selectedId: string | number,
    isCorrectFromOption?: boolean
  ) => {
    if (!quizMetadata || !currentCard) return

    setIsProcessing(true)
    setSelectedAnswer(selectedId)

    try {
      // Determine if answer is correct using the isCorrect flag from the option
      const wasCorrect = isCorrectFromOption ?? false

      // For the Lit Action, pass the selected option's text and the correct answer's text
      // This allows the Lit Action to do the comparison and calculate the score
      const selectedOption = quizMetadata.options.find(opt => String(opt.id) === String(selectedId))
      const correctOption = quizMetadata.options.find(opt => String(opt.id) === String(quizMetadata.correctAnswer))

      if (!selectedOption || !correctOption) {
        throw new Error('Could not find selected or correct option')
      }

      // Map exercise type from subgraph format to Lit Action format
      const litActionExerciseType = currentCard.exerciseType === 'TRANSLATION_MULTIPLE_CHOICE'
        ? 'TRANSLATION_QUIZ'
        : currentCard.exerciseType === 'TRIVIA_MULTIPLE_CHOICE'
        ? 'TRIVIA_QUIZ'
        : currentCard.exerciseType

      // OPTIMISTIC UPDATE: Show feedback immediately
      // Frontend already knows if answer is correct - no need to wait for blockchain
      setTranscript(undefined)
      setScore(undefined)
      setFeedback({
        isCorrect: wasCorrect,
        message: wasCorrect ? 'Correct!' : 'Incorrect',
      })

      console.log('[StudySession] ✅ Instant feedback shown, submitting to blockchain in background...')

      // Submit to blockchain in background (non-blocking)
      // PKP will update FSRS state, but user can move to next card immediately
      const gradingParams: GradingParams = {
        exerciseType: litActionExerciseType as 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ',
        attemptId: Date.now(),
        questionId: currentCard.questionId || currentCard.id,
        userAnswer: selectedOption.text,
        correctAnswer: correctOption.text,
        metadataUri: currentCard.metadataUri,
      }

      grade(gradingParams)
        .then(result => {
          if (result?.txHash) {
            console.log('[StudySession] ✅ Background blockchain update complete:', result.txHash)
          } else {
            console.warn('[StudySession] ⚠️ Blockchain update returned no txHash')
          }
        })
        .catch(error => {
          console.error('[StudySession] ❌ Background blockchain update failed:', error)
          // FSRS state won't update, but user already got feedback
          // Card will reappear later with correct FSRS schedule
        })
    } catch (error) {
      console.error('[StudySession] Quiz grading error:', error)
      setFeedback({
        isCorrect: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [grade, currentCard, quizMetadata, studyCardsQuery])

  const handleNext = useCallback(() => {
    console.log('[StudySession] Moving to next card...')
    setCurrentCardIndex(prev => {
      const nextIndex = prev + 1
      console.log(`[StudySession] Card index: ${prev} → ${nextIndex} (of ${dueCards.length})`)

      if (nextIndex >= dueCards.length) {
        console.log('[StudySession] ✓ Study session complete!')
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

  // Auth check
  if (!isPKPReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Loading states
  console.log('[StudySession] Render loading check:', {
    hasLoadedCards,
    isLoadingCards,
    isRefetchingCards,
    dueCardsCount: dueCards.length,
  })
  if (!hasLoadedCards || isLoadingCards) {
    console.log('[StudySession] Rendering loading spinner (cards)')
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // No cards (only show after loading is complete)
  console.log('[StudySession] Render empty check:', {
    dueCardsCount: dueCards.length,
    isRefetchingCards,
    queryCardsCount: queryCards.length,
    showEmptyState,
  })
  if (showEmptyState) {
    console.log('[StudySession] Rendering empty state (no cards)')
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-2xl font-bold">No Cards to Study</h1>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go Back
        </button>
      </div>
    )
  }

  // Session complete
  if (currentCardIndex >= dueCards.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-2xl font-bold">✓ Study Session Complete!</h1>
        <p className="text-lg text-muted-foreground">
          You've completed {dueCards.length} cards
        </p>
        <button
          onClick={() => navigate('/study')}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Return to Study
        </button>
      </div>
    )
  }

  // Type-specific loading
  const isLoading = isSayItBack
    ? (isLoadingSegment || isLoadingText)
    : isLoadingQuiz

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Type-specific validation
  if (isSayItBack) {
    if (!segmentMetadata?.assets?.instrumental) {
      return (
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">No instrumental audio available</p>
            <button onClick={handleNext} className="mt-4 text-primary hover:underline">
              Skip Card
            </button>
          </div>
        </div>
      )
    }
    if (!exerciseText) {
      return (
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">No lyrics available</p>
            <button onClick={handleNext} className="mt-4 text-primary hover:underline">
              Skip Card
            </button>
          </div>
        </div>
      )
    }
  } else {
    if (!quizMetadata?.question || !quizMetadata?.options) {
      return (
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">Invalid quiz data</p>
            <button onClick={handleNext} className="mt-4 text-primary hover:underline">
              Skip Card
            </button>
          </div>
        </div>
      )
    }
  }

  // Progress calculation
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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-3">
          <ExerciseHeader progress={progress} onClose={handleClose} stats={headerStats} />
        </div>
      </div>

      {/* Main content - conditional rendering based on exercise type */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          {isSayItBack ? (
            <SayItBackExercise
              expectedText={exerciseText}
              transcript={transcript}
              score={score}
            />
          ) : (
            <div className="relative">
              {showInlineQuizSpinner && (
                <div className="absolute -top-4 right-0 flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" />
                  <span>Updating cards…</span>
                </div>
              )}
              <MultipleChoiceQuiz
                question={quizMetadata!.question}
                options={quizMetadata!.options.map(opt => ({
                  id: String(opt.id),
                  text: opt.text,
                  isCorrect: String(opt.id) === String(quizMetadata!.correctAnswer),
                }))}
                onAnswer={handleAnswerSubmit}
                isProcessing={isProcessing}
                hasAnswered={!!feedback}
                selectedAnswerId={selectedAnswer ? String(selectedAnswer) : null}
                explanation={quizMetadata!.explanation}
                exerciseType={quizMetadata!.type}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer - conditional controls based on exercise type and state */}
      <div className="border-t border-border bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-4">
          <ExerciseFooter
            feedback={feedback}
            controls={
              feedback
                ? {
                    type: 'navigation',
                    onNext: handleNext,
                    label: 'Next',
                    exerciseKey: currentCard?.id,
                  }
                : isSayItBack
                ? {
                    type: 'voice',
                    isRecording,
                    isProcessing,
                    onStartRecording: handleStartRecording,
                    onStopRecording: handleStopRecording,
                    label: 'Record',
                  }
                : {
                    type: 'hidden', // Quiz handles submission internally via onAnswer
                  }
            }
          />
        </div>
      </div>
    </div>
  )
}
