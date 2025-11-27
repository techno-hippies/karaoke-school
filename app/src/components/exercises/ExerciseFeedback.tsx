import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface ExerciseFeedbackProps {
  /** Whether the answer was correct */
  isCorrect: boolean
  /** Optional custom message (defaults to "Correct!" or "Try again") */
  message?: string
  /** Whether to animate the feedback (default: true) */
  animated?: boolean
}

export function ExerciseFeedback({ isCorrect, message, animated = true }: ExerciseFeedbackProps) {
  const defaultMessage = isCorrect ? 'Correct!' : 'Try again'
  const displayMessage = message || defaultMessage

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        isCorrect
          ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]'
          : 'text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.4)]',
        animated && 'animate-bounce-in'
      )}
    >
      {isCorrect ? (
        <CheckCircle size={28} weight="fill" />
      ) : (
        <XCircle size={28} weight="fill" />
      )}
      <span className="text-base md:text-lg font-semibold">{displayMessage}</span>
    </div>
  )
}
