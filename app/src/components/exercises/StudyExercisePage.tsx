import { useState, useCallback, useEffect, useRef } from 'react'
import { BackButton } from '@/components/ui/back-button'
import { SayItBackExercise } from './SayItBackExercise'
import { VoiceControls } from './VoiceControls'
import { ExerciseFeedback } from './ExerciseFeedback'
import { AnimatedFooter } from './AnimatedFooter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LyricLine } from '@/types/karaoke'

export interface StudyExercisePageProps {
  /** Song ID for FSRS tracking */
  songId: string
  /** Segment ID for FSRS tracking */
  segmentId: string
  /** Segment display name */
  segmentName: string
  /** Lyrics lines to practice */
  lyrics: LyricLine[]
  /** Callback when back button is clicked */
  onBack?: () => void
  /** Callback to score study session (calls Lit Action) */
  onScoreSession?: (audioBlob: Blob, lines: LyricLine[]) => Promise<{
    success: boolean
    scores: number[]
    ratings: number[]
    averageScore: number
    txHash?: string
  }>
  /** User address for FSRS tracking */
  userAddress?: string
  /** Whether user has Lit + wallet ready */
  canRecord?: boolean
  className?: string
}

/**
 * StudyExercisePage - Full-screen study exercise with voice recording
 *
 * Flow:
 * 1. Show lyrics to practice
 * 2. User records audio
 * 3. Call study-scorer-v1 Lit Action (transcribe + score + FSRS)
 * 4. Show feedback with per-line scores
 * 5. Option to continue or go back
 */
export function StudyExercisePage({
  songId,
  segmentId,
  segmentName,
  lyrics,
  onBack,
  onScoreSession,
  userAddress,
  canRecord = false,
  className,
}: StudyExercisePageProps) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  // Results state
  const [scores, setScores] = useState<number[]>([])
  const [averageScore, setAverageScore] = useState<number | null>(null)
  const [txHash, setTxHash] = useState<string>()

  // Media recorder ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Filter out section markers
  const practiceLines = lyrics.filter(line => !line.sectionMarker)

  // Current exercise state
  const hasRecorded = audioBlob !== null
  const hasResults = scores.length > 0

  // Start recording
  const handleStartRecording = useCallback(async () => {
    try {
      console.log('[StudyExercise] Starting recording...')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        console.log('[StudyExercise] Recording stopped, blob size:', blob.size)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

    } catch (error) {
      console.error('[StudyExercise] Failed to start recording:', error)
    }
  }, [])

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('[StudyExercise] Stopping recording...')
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  // Submit recording for scoring
  const handleSubmit = useCallback(async () => {
    if (!audioBlob || !onScoreSession) {
      console.error('[StudyExercise] Missing audio blob or score callback')
      return
    }

    setIsProcessing(true)

    try {
      console.log('[StudyExercise] Submitting audio for scoring...')

      const result = await onScoreSession(audioBlob, practiceLines)

      if (result.success) {
        console.log('[StudyExercise] Scoring complete:', result)
        setScores(result.scores)
        setAverageScore(result.averageScore)
        setTxHash(result.txHash)
      } else {
        console.error('[StudyExercise] Scoring failed')
      }

    } catch (error) {
      console.error('[StudyExercise] Scoring error:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [audioBlob, onScoreSession, practiceLines])

  // Try again - reset state
  const handleTryAgain = useCallback(() => {
    setAudioBlob(null)
    setScores([])
    setAverageScore(null)
    setTxHash(undefined)
  }, [])

  // Render exercise content based on state
  const renderContent = () => {
    // State: Results
    if (hasResults && averageScore !== null) {
      const isSuccess = averageScore >= 75 // 75% threshold for "correct"

      return (
        <div className="space-y-8">
          {/* Overall feedback */}
          <div className="text-center">
            <ExerciseFeedback
              isCorrect={isSuccess}
              message={`${averageScore}% Average Score`}
            />
          </div>

          {/* Per-line scores */}
          <div className="space-y-4">
            <div className="text-muted-foreground text-sm font-medium">
              Line Scores:
            </div>
            {practiceLines.map((line, idx) => {
              const score = scores[idx] || 0
              const ratingLabels = ['Again', 'Hard', 'Good', 'Easy']
              const rating = score >= 90 ? 3 : score >= 75 ? 2 : score >= 60 ? 1 : 0

              return (
                <div key={line.lineIndex} className="flex items-center justify-between p-3 bg-neutral-900/30 rounded-lg border border-neutral-800/50">
                  <div className="text-sm text-foreground flex-1">
                    {line.originalText}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      score >= 90 ? "text-green-400" :
                      score >= 75 ? "text-blue-400" :
                      score >= 60 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {score}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ratingLabels[rating]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Transaction link */}
          {txHash && (
            <div className="text-xs text-center text-muted-foreground">
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline"
              >
                View transaction on BaseScan
              </a>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleTryAgain}
              variant="secondary"
              size="lg"
            >
              Try Again
            </Button>
            <Button
              onClick={onBack}
              variant="default"
              size="lg"
            >
              Continue
            </Button>
          </div>
        </div>
      )
    }

    // State: Recorded, waiting for submit
    if (hasRecorded && !isProcessing) {
      return (
        <div className="space-y-6">
          {/* Show what to say */}
          <div className="space-y-4">
            <div className="text-muted-foreground text-sm font-medium">
              Practice these lines:
            </div>
            {practiceLines.map((line) => (
              <div key={line.lineIndex} className="text-lg text-foreground leading-relaxed">
                {line.originalText}
              </div>
            ))}
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            variant="default"
            size="lg"
            className="w-full"
          >
            Check My Pronunciation
          </Button>

          {/* Re-record option */}
          <Button
            onClick={handleTryAgain}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Re-record
          </Button>
        </div>
      )
    }

    // State: Not started or recording
    return (
      <div className="space-y-6">
        {/* Instructions */}
        <div className="space-y-4">
          <div className="text-muted-foreground text-sm font-medium">
            Practice saying:
          </div>
          {practiceLines.map((line) => (
            <div key={line.lineIndex} className="text-xl font-medium text-foreground leading-relaxed">
              {line.originalText}
            </div>
          ))}
        </div>

        {/* Recording status */}
        {isRecording && (
          <div className="text-center text-red-400 text-sm animate-pulse">
            Recording...
          </div>
        )}

        {!canRecord && (
          <div className="text-center text-amber-400 text-sm">
            Please connect your wallet to start practicing
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('relative w-full h-screen bg-background overflow-hidden flex items-center justify-center', className)}>
      <div className="relative w-full h-full md:max-w-4xl">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-background border-b border-neutral-800">
          <div className="flex items-center justify-between px-4 py-2">
            <BackButton onClick={onBack} />
            <h1 className="text-center font-semibold text-base md:text-xl text-foreground flex-1">
              Study: {segmentName}
            </h1>
            <div className="w-9" />
          </div>
        </div>

        {/* Content */}
        <div className="absolute inset-x-0 bottom-24 px-6" style={{ top: '60px' }}>
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-2xl">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* Footer with controls */}
        {!hasResults && (
          <AnimatedFooter>
            <VoiceControls
              isRecording={isRecording}
              isProcessing={isProcessing}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              label="Record"
            />
          </AnimatedFooter>
        )}
      </div>
    </div>
  )
}
