import { SpeakerHigh, CheckCircle, XCircle } from '@phosphor-icons/react'

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

// TTS Button (mock for now)
const TTSButton = ({ text }: { text: string }) => {
  const handleTTS = () => {
    console.log('[TTS] Would play:', text)
    // Future: Implement TTS playback
  }

  return (
    <button
      onClick={handleTTS}
      className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
      aria-label="Play audio"
    >
      <SpeakerHigh className="w-6 h-6 text-white" weight="fill" />
    </button>
  )
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

  return (
    <div className="space-y-6">
      {/* Target text section */}
      <div className="text-left space-y-3">
        <div className="text-neutral-400 text-lg font-medium">
          Say it back:
        </div>
        <div className="flex items-center gap-4">
          <TTSButton text={expectedText} />
          <div className="text-2xl font-medium text-white leading-relaxed">
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
            <div className="p-6 bg-green-900/20 border border-green-600 rounded-lg">
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle size={32} weight="duotone" />
                <span className="text-xl font-medium">Correct!</span>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-red-900/20 border border-red-600 rounded-lg space-y-3">
              <div className="flex items-center gap-3 text-red-400">
                <XCircle size={32} weight="duotone" />
                <span className="text-xl font-medium">Try again</span>
              </div>
              <div>
                <div className="text-neutral-400 text-sm mb-1">
                  You said:
                </div>
                <div className="text-lg font-medium text-white">
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
