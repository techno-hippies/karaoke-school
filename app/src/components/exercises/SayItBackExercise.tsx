import { AudioButton } from '@/components/media/audio-button'

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


      {/* User's transcript (shown after speaking) */}
      {showResults && (
        <div className="text-left space-y-3">
          <div className="text-muted-foreground text-base font-medium">
            You said:
          </div>
          <div className="text-xl font-medium text-foreground leading-relaxed">
            {transcript}
          </div>
        </div>
      )}
    </div>
  )
}
