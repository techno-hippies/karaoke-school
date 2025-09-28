import { cn } from '@/lib/utils'

// Mock TTS Button component for now
const TTSButton = ({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' | 'lg' }) => {
  const handleTTSClick = () => {
    console.log('TTS clicked for:', text)
    // Future: Implement actual TTS functionality
  }

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  return (
    <button
      className={cn(
        "flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full transition-colors",
        sizeClasses[size]
      )}
      onClick={handleTTSClick}
    >
      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
    </button>
  )
}

// Mock translation function for now
const useTranslation = () => {
  const t = (_key: string, fallback: string) => fallback
  return { t }
}

export interface SayItBackProps {
  expectedText: string
  transcript?: string
  score?: number | null
  attempts?: number
  isCompleted?: boolean
  onComplete?: (score: number, transcript: string) => void
}

export function SayItBack({
  expectedText,
  transcript,
  score,
  attempts
}: SayItBackProps) {
  const { t } = useTranslation()

  // Determine if the answer was correct based on score
  // Using phoneme-based scoring with 70% threshold to match PhonemeScoringService
  const isCorrect = score !== null && score !== undefined && score >= 70

  return (
    <div className="space-y-6">
      {/* Target text section */}
      <div className="text-left space-y-3">
        <div className="text-neutral-400 text-lg font-medium">
          {t('exercise.sayItBack', '跟着说：')}
        </div>
        <div className="flex items-center gap-4">
          <TTSButton
            text={expectedText}
            size="lg"
          />
          <div className="text-2xl font-medium text-white leading-relaxed">
            {expectedText}
          </div>
        </div>
      </div>

      {/* Show transcript and feedback if available */}
      {transcript && (
        <div className="text-left space-y-2">
          {/* Show success message if correct */}
          {isCorrect && (
            <div className="text-green-400 text-lg font-medium">
              {t('exercise.correct', '✓ Correct!')}
            </div>
          )}

          {/* Show transcript if incorrect */}
          {!isCorrect && (
            <>
              <div className="text-neutral-400 text-lg font-medium">
                {t('exercise.youSaid', 'You said:')}
              </div>
              <div className="text-2xl font-medium text-white leading-relaxed">
                {transcript}
              </div>
            </>
          )}
        </div>
      )}

      {/* Show attempts counter if provided */}
      {attempts !== undefined && attempts > 0 && (
        <div className="text-neutral-500 text-sm">
          {t('exercise.attempts', `Attempts: ${attempts}`)}
        </div>
      )}
    </div>
  )
}