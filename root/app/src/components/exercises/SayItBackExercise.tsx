import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { AudioButton } from '@/components/ui/audio-button'

// Simple text similarity scoring (can be enhanced with phoneme matching later)
export function calculateTextSimilarity(expected: string, actual: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const expectedNorm = normalize(expected)
  const actualNorm = normalize(actual)

  if (expectedNorm === actualNorm) return 100

  // Simple word-based similarity
  const expectedWords = expectedNorm.split(/\s+/)
  const actualWords = actualNorm.split(/\s+/)

  let matches = 0
  for (const word of expectedWords) {
    if (actualWords.includes(word)) matches++
  }

  return Math.round((matches / expectedWords.length) * 100)
}

export interface SayItBackExerciseProps {
  /** The text the user should say */
  expectedText: string
  /** The user's transcribed speech (when available) */
  transcript?: string
  /** Score 0-100 (when available) */
  score?: number | null
  /** Number of attempts */
  attempts?: number
  /** Whether recording is in progress */
  isRecording?: boolean
  /** Whether transcription is processing */
  isProcessing?: boolean
  /** Whether the exercise can record (Lit + wallet ready) */
  canRecord?: boolean
  /** Status message to show */
  statusMessage?: string
  /** Callbacks */
  onStartRecording?: () => void
  onStopRecording?: () => void
}

export function SayItBackExercise({
  expectedText,
  transcript,
  score = null,
  attempts = 0,
  isRecording = false,
  isProcessing = false,
  canRecord = true,
  statusMessage,
  onStartRecording,
  onStopRecording,
}: SayItBackExerciseProps) {
  const isCorrect = score !== null && score >= 70
  const showResults = transcript !== undefined

  const handlePlayAudio = () => {
    console.log('[TTS] Would play:', expectedText)
    // Future: Implement TTS playback
  }

  return (
    <div className="space-y-6">
      {/* Target text section */}
      <div className="text-left space-y-3">
        <div className="text-muted-foreground text-base font-medium">
          Say it back:
        </div>
        <div className="flex items-center gap-4">
          <AudioButton onClick={handlePlayAudio} aria-label="Play audio" />
          <div className="text-xl font-medium text-foreground leading-relaxed">
            {expectedText}
          </div>
        </div>
      </div>

      {/* Status messages */}
      {statusMessage && (
        <div className="text-yellow-400 text-sm">
          {statusMessage}
        </div>
      )}

      {isRecording && (
        <div className="text-blue-400 text-sm animate-pulse">
          Recording... Click stop when done
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="text-left space-y-4">
          {isCorrect ? (
            <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-lg">
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle size={32} weight="duotone" />
                <span className="text-xl font-medium">Correct!</span>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-destructive/20 border border-destructive/50 rounded-lg space-y-3">
              <div className="flex items-center gap-3 text-destructive">
                <XCircle size={32} weight="duotone" />
                <span className="text-xl font-medium">Try again</span>
              </div>
              <div>
                <div className="text-muted-foreground text-sm mb-1">
                  You said:
                </div>
                <div className="text-lg font-medium text-foreground">
                  {transcript}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
