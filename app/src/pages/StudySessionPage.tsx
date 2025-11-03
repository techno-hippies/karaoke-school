import { useNavigate, useParams } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useLitActionGrader, emitPerformanceGraded } from '@/hooks/useLitActionGrader'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
import { ExerciseHeader } from '@/components/exercises/ExerciseHeader'
import { ExerciseFooter } from '@/components/exercises/ExerciseFooter'
import { Spinner } from '@/components/ui/spinner'
import { PERFORMANCE_GRADER_ADDRESS } from '@/lib/contracts/addresses'

export function StudySessionPage() {
  const navigate = useNavigate()
  const { workId } = useParams<{ workId: string }>()
  const { isPKPReady, pkpWalletClient, pkpAddress } = useAuth()

  // Session state
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number>()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message?: string }>()

  // Data hooks
  const songId = workId
  const { data: dueCards = [], isLoading: isLoadingCards } = useStudyCards(songId || undefined)

  const currentCard = dueCards[currentCardIndex]
  const { data: segmentMetadata, isLoading: isLoadingMetadata } = useSegmentMetadata(
    currentCard?.metadataUri
  )

  // Extract English lyrics from alignment file (contains all words with timing)
  const alignmentUri = segmentMetadata?.assets?.alignment
  const { data: alignmentData, isLoading: isLoadingAlignment } = useQuery({
    queryKey: ['alignment', alignmentUri],
    queryFn: async () => {
      if (!alignmentUri) throw new Error('Alignment URI required')
      const httpUrl = alignmentUri.startsWith('http') ? alignmentUri : alignmentUri
      const response = await fetch(httpUrl)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
      return response.json()
    },
    enabled: !!alignmentUri,
    staleTime: 300000,
  })

  // Fetch first translation file to get line structure
  const firstTranslation = segmentMetadata?.translations?.[0]
  const { data: translationData, isLoading: isLoadingTranslation } = useQuery({
    queryKey: ['translation-first', firstTranslation?.grove_url],
    queryFn: async () => {
      if (!firstTranslation?.grove_url) throw new Error('Translation URI required')
      const response = await fetch(firstTranslation.grove_url)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
      return response.json()
    },
    enabled: !!firstTranslation?.grove_url,
    staleTime: 300000,
  })

  // Audio recorder and grader hooks - must be after data hooks to maintain consistent hook order
  const audioRecorder = useAudioRecorder()
  const { grade } = useLitActionGrader()

  // Extract exercise text - FIRST LINE ONLY
  // Must be computed before callbacks that reference it
  let exerciseText = 'Loading...'
  let isLoadingText = isLoadingAlignment || isLoadingTranslation

  if (alignmentData?.words && translationData?.lines?.[0]?.words?.length) {
    // Use translation line structure to determine word count for first line
    const firstLineWordCount = translationData.lines[0].words.length
    const firstLineWords = alignmentData.words.slice(0, firstLineWordCount)
    exerciseText = firstLineWords
      .map((w: any) => w.text || w.word)
      .join(' ')
  } else if (alignmentData?.words && Array.isArray(alignmentData.words)) {
    // Fallback: first 6 words
    const firstLineWords = alignmentData.words.slice(0, 6)
    exerciseText = firstLineWords
      .map((w: any) => w.text || w.word)
      .join(' ')
  } else if (segmentMetadata?.lyrics?.original?.lines && segmentMetadata.lyrics.original.lines.length > 0) {
    // Old format fallback
    const firstLine = segmentMetadata.lyrics.original.lines[0]
    if (firstLine?.words) {
      exerciseText = firstLine.words
        .map((w: any) => w.word)
        .join(' ')
    }
  }

  // Define all callbacks BEFORE any conditional returns (to maintain hook order)
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

    try {
      // Validate dependencies
      if (!currentCard) {
        throw new Error('No current card loaded')
      }

      if (!segmentMetadata?.assets?.instrumental) {
        throw new Error('No instrumental audio available')
      }

      if (!exerciseText) {
        throw new Error('No exercise text available')
      }

      if (!pkpWalletClient || !pkpAddress) {
        throw new Error('PKP wallet not ready')
      }

      // Step 1: Upload user recording to Grove
      console.log('[StudySession] Uploading recording to Grove...')
      const userAudioUri = await audioRecorder.stopRecording()

      if (!userAudioUri) {
        throw new Error('Failed to upload audio recording')
      }

      console.log('[StudySession] Recording uploaded:', userAudioUri)

      // Step 2: Call Lit Action to grade performance
      console.log('[StudySession] Calling Lit Action grader...')
      const gradingResult = await grade(
        userAudioUri,
        segmentMetadata.assets.instrumental,
        exerciseText,
        currentCard.segmentHash
      )

      if (!gradingResult) {
        throw new Error('Grading failed - no result returned')
      }

      console.log('[StudySession] Grading complete:', gradingResult)

      // Step 3: Emit performance to contract with master PKP
      console.log('[StudySession] Emitting performance to contract...')
      const txHash = await emitPerformanceGraded(
        pkpWalletClient,
        PERFORMANCE_GRADER_ADDRESS,
        gradingResult.performanceId,
        currentCard.segmentHash as any, // TODO: proper bytes32 conversion
        pkpAddress,
        gradingResult.score,
        currentCard.metadataUri
      )

      console.log('[StudySession] Performance emitted, tx:', txHash)

      // Step 4: Update UI with results
      setTranscript(gradingResult.transcript)
      setScore(gradingResult.score)

      const isFeedbackPositive = gradingResult.rating !== 'Again'
      const feedbackMessage = `Score: ${gradingResult.score}% (${gradingResult.rating})`

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
  }, [audioRecorder, grade, currentCard, segmentMetadata, exerciseText, pkpWalletClient, pkpAddress])

  const handleNext = useCallback(() => {
    console.log('[StudySession] Moving to next card...')
    // TODO: Update FSRS, emit event, move to next
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
  }, [])

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

  if (isLoadingCards || isLoadingMetadata || isLoadingText) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-2xl font-bold">No Cards to Study</h1>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">
          Go Back
        </button>
      </div>
    )
  }

  // Progress: cards completed out of due cards
  const progress = dueCards.length > 0 ? Math.round((currentCardIndex / dueCards.length) * 100) : 0

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <ExerciseHeader progress={progress} onClose={handleClose} />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 pt-8">
        <div className="max-w-3xl mx-auto">
          <SayItBackExercise
            expectedText={exerciseText}
            transcript={transcript}
            score={score}
          />
        </div>
      </div>

      {/* Footer with controls */}
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
            : {
                type: 'voice',
                isRecording,
                isProcessing,
                onStartRecording: handleStartRecording,
                onStopRecording: handleStopRecording,
                label: 'Record',
              }
        }
      />
    </div>
  )
}
