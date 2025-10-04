import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface ExerciseFeedbackProps {
  /** Feedback variant */
  variant: 'correct' | 'incorrect'
  /** Optional custom message (defaults to "Correct!" or "Try again") */
  message?: string
  /** Optional className for additional styling */
  className?: string
}

export function ExerciseFeedback({
  variant,
  message,
  className,
}: ExerciseFeedbackProps) {
  const isCorrect = variant === 'correct'
  const defaultMessage = isCorrect ? 'Correct!' : 'Try again'

  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        isCorrect
          ? 'bg-green-500/20 border-green-500/50'
          : 'bg-destructive/20 border-destructive/50',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3',
          isCorrect ? 'text-green-400' : 'text-destructive'
        )}
      >
        {isCorrect ? (
          <CheckCircle size={24} weight="duotone" />
        ) : (
          <XCircle size={24} weight="duotone" />
        )}
        <span className="text-base font-medium">{message || defaultMessage}</span>
      </div>
    </div>
  )
}
