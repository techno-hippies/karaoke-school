import { useNavigate, useParams } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { useSegmentMetadata } from '@/hooks/useSegmentV2'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useLitActionGrader } from '@/hooks/useLitActionGrader'
import { SayItBackExercise } from '@/components/exercises/SayItBackExercise'
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

  if (translationData?.lines?.[0]?.originalText) {
    // Use the complete originalText from the translation (this is the full line)
    exerciseText = translationData.lines[0].originalText
    console.log('[StudySession] Using originalText from translation:', exerciseText)
  } else if (translationData?.lines?.[0]?.text) {
    // Fallback: some translations may have 'text' field instead
    exerciseText = translationData.lines[0].text
  } else if (alignmentData?.words && Array.isArray(alignmentData.words)) {
    // Fallback: reconstruct from alignment words (first 6 words as default)
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

      // Step 1: Record and convert to base64
      console.log('[StudySession] Recording audio...')
      const recordingData = await audioRecorder.stopRecording()

      if (!recordingData) {
        throw new Error('Failed to record audio')
      }

      console.log('[StudySession] Recording complete - size:', recordingData.blob.size, '- uploaded to:', recordingData.groveUri)

      // Step 2: Call Lit Action to grade performance with base64 audio data
      console.log('[StudySession] Calling Lit Action grader...')
      const gradingResult = await grade(
        recordingData.base64,  // Pass base64-encoded audio data
        segmentMetadata.assets.instrumental,
        exerciseText,
        currentCard.segmentHash,
        recordingData.groveUri  // Optional: Grove URI for metadata storage
      )

      if (!gradingResult) {
        throw new Error('Grading failed - no result returned')
      }

      console.log('[StudySession] Grading complete:', gradingResult)

      // Note: The Lit Action has already submitted the performance to the contract
      // using the master PKP signature. We don't need to call it again from the frontend.
      // The txHash is already included in the gradingResult if the submission was successful.
      if (gradingResult.txHash) {
        console.log('[StudySession] Performance already submitted to contract via Lit Action, tx:', gradingResult.txHash)
      } else {
        console.log('[StudySession] Lit Action submitted performance without returning txHash')
      }

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
  }, [audioRecorder, grade, currentCard, segmentMetadata, exerciseText])

  const handleNext = useCallback(() => {
    console.log('[StudySession] Moving to next card...')
    // Move to next card
    setCurrentCardIndex(prev => {
      const nextIndex = prev + 1
      console.log(`[StudySession] Card index: ${prev} → ${nextIndex} (of ${dueCards.length})`)

      // If we've reached the end, show completion message
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
    // Clear grading results
    setTranscript(undefined)
    setScore(undefined)
    setFeedback(undefined)
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

  // Progress: cards completed out of due cards
  const progress = dueCards.length > 0 ? Math.round((currentCardIndex / dueCards.length) * 100) : 0

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-3">
          <ExerciseHeader progress={progress} onClose={handleClose} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          <SayItBackExercise
            expectedText={exerciseText}
            transcript={transcript}
            score={score}
          />
        </div>
      </div>

      {/* Footer with controls */}
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
      </div>
    </div>
  )
}
