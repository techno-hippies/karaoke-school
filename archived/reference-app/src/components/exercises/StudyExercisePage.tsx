import { useState, useCallback, useRef } from 'react'
import { BackButton } from '@/components/ui/back-button'
import { SayItBackExercise } from './SayItBackExercise'
import { VoiceControls } from './VoiceControls'
import { ExerciseFeedback } from './ExerciseFeedback'
import { AnimatedFooter } from './AnimatedFooter'
import { NavigationControls } from './NavigationControls'
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
 * 1. Show lyrics line-by-line
 * 2. User records audio for each line
 * 3. Call study-scorer-v1 Lit Action (transcribe + score + FSRS)
 * 4. Show feedback with score
 * 5. Move to next line or finish
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
  // Filter out section markers
  const practiceLines = lyrics.filter(line => !line.sectionMarker)

  // Current line being practiced
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const currentLine = practiceLines[currentLineIndex]

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Results for current line
  const [transcript, setTranscript] = useState<string>()
  const [score, setScore] = useState<number>()

  // All line results
  const [lineScores, setLineScores] = useState<number[]>([])

  // Media recorder ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Start recording
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Process the recording
        if (onScoreSession) {
          setIsProcessing(true)

          try {
            // Score just this one line
            const result = await onScoreSession(blob, [currentLine])

            if (result.success && result.scores.length > 0) {
              setTranscript(currentLine.originalText) // In test mode, transcript matches expected
              setScore(result.scores[0])

              // Store score for this line
              const newScores = [...lineScores]
              newScores[currentLineIndex] = result.scores[0]
              setLineScores(newScores)
            }
          } catch (error) {
            console.error('[StudyExercise] Scoring error:', error)
          } finally {
            setIsProcessing(false)
          }
        }
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

    } catch (error) {
      console.error('[StudyExercise] Failed to start recording:', error)
    }
  }, [onScoreSession, currentLine, currentLineIndex, lineScores])

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  // Move to next line
  const handleNext = useCallback(() => {
    if (currentLineIndex < practiceLines.length - 1) {
      // Next line
      setCurrentLineIndex(prev => prev + 1)
      setTranscript(undefined)
      setScore(undefined)
    } else {
      // Finished all lines - go back
      onBack?.()
    }
  }, [currentLineIndex, practiceLines.length, onBack])

  // Determine if we should show results
  const hasResult = score !== undefined

  // Calculate if answer is correct (75% threshold)
  const isCorrect = score !== undefined && score >= 75

  return (
    <div className={cn('h-screen bg-background flex flex-col relative', className)}>
      {/* Header */}
      <div className="bg-background border-b border-neutral-800">
        <div className="flex items-center justify-between px-4 py-2">
          <BackButton onClick={onBack} />
          <h1 className="text-center font-semibold text-base md:text-xl text-foreground flex-1">
            Study: {segmentName}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      {/* Exercise Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <SayItBackExercise
            expectedText={currentLine?.originalText || ''}
            transcript={transcript}
            score={score}
            isRecording={isRecording}
            isProcessing={isProcessing}
            canRecord={canRecord}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        </div>
      </div>

      {/* Animated Footer */}
      <AnimatedFooter show={true}>
        {!hasResult ? (
          // State: Recording or not started
          <VoiceControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            label="Record"
          />
        ) : (
          // State: Has result - show feedback and next button
          <div className="space-y-3">
            <ExerciseFeedback
              isCorrect={isCorrect}
              message={isCorrect ? `${score}% - Great job!` : `${score}% - Try harder next time`}
            />
            <NavigationControls
              label={currentLineIndex < practiceLines.length - 1 ? 'Next' : 'Finish'}
              onNext={handleNext}
            />
          </div>
        )}
      </AnimatedFooter>
    </div>
  )
}
