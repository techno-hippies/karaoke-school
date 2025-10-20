import { CheckCircle, XCircle } from '@phosphor-icons/react'

export interface ExerciseFeedbackProps {
  /** Whether the answer was correct */
  isCorrect: boolean
  /** Optional custom message (defaults to "Correct!" or "Try again") */
  message?: string
}

export function ExerciseFeedback({ isCorrect, message }: ExerciseFeedbackProps) {
  const defaultMessage = isCorrect ? 'Correct!' : 'Try again'
  const displayMessage = message || defaultMessage

  return (
    <div
      className={`flex items-center gap-3 ${
        isCorrect ? 'text-green-400' : 'text-red-400'
      }`}
    >
      {isCorrect ? (
        <CheckCircle size={28} weight="duotone" />
      ) : (
        <XCircle size={28} weight="duotone" />
      )}
      <span className="text-lg font-medium">{displayMessage}</span>
    </div>
  )
}
