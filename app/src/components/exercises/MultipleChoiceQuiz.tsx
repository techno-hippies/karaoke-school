import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface MultipleChoiceOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface MultipleChoiceQuizProps {
  /** The trivia question */
  question: string
  /** Array of answer options */
  options: MultipleChoiceOption[]
  /** Callback when an answer is selected */
  onAnswer?: (selectedId: string, isCorrect: boolean) => void
  /** Whether the quiz is processing the answer */
  isProcessing?: boolean
  /** Whether the user has already answered (controlled mode) */
  hasAnswered?: boolean
  /** The selected answer ID (controlled mode) */
  selectedAnswerId?: string | null
  /** Optional explanation to show after answering */
  explanation?: string
}

export const MultipleChoiceQuiz = ({
  question,
  options,
  onAnswer,
  isProcessing = false,
  hasAnswered = false,
  selectedAnswerId = null,
  explanation,
}: MultipleChoiceQuizProps) => {
  // Use props if provided (controlled), otherwise use internal state (uncontrolled)
  const [selectedId, setSelectedId] = useState<string | null>(selectedAnswerId)
  const [answered, setAnswered] = useState(hasAnswered)

  // Sync with props when they change (controlled mode)
  useEffect(() => {
    setSelectedId(selectedAnswerId)
    setAnswered(hasAnswered)
  }, [selectedAnswerId, hasAnswered])

  const handleOptionClick = (option: MultipleChoiceOption) => {
    if (answered || isProcessing) return

    setSelectedId(option.id)
    setAnswered(true)
    onAnswer?.(option.id, option.isCorrect)
  }

  const getOptionStyles = (option: MultipleChoiceOption) => {
    const baseStyles = "w-full flex items-center gap-3 p-4 rounded-lg transition-all cursor-pointer border min-h-[60px]"

    if (!answered) {
      // Not answered yet - normal hover states
      return cn(
        baseStyles,
        "bg-secondary/30 hover:bg-secondary border-border text-foreground"
      )
    }

    // After answering - show feedback
    const isSelected = selectedId === option.id
    const isCorrectAnswer = option.isCorrect

    if (isSelected && isCorrectAnswer) {
      // User selected the correct answer - green
      return cn(
        baseStyles,
        "bg-green-500/20 border-green-500/50 text-green-400"
      )
    }

    if (isSelected && !isCorrectAnswer) {
      // User selected wrong answer - red
      return cn(
        baseStyles,
        "bg-destructive/20 border-destructive/50 text-destructive"
      )
    }

    if (!isSelected && isCorrectAnswer) {
      // Show correct answer even if not selected - green
      return cn(
        baseStyles,
        "bg-green-500/10 border-green-500/30 text-green-400"
      )
    }

    // Not selected and not correct - muted
    return cn(
      baseStyles,
      "bg-muted/30 border-border/50 text-muted-foreground opacity-60"
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Question */}
      <div className="text-left space-y-3">
        <div className="text-muted-foreground text-base font-medium">
          Question:
        </div>
        <div className="text-xl font-medium text-foreground leading-relaxed">
          {question}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleOptionClick(option)}
            disabled={answered || isProcessing}
            className={getOptionStyles(option)}
          >
            <span className="flex-1 text-left font-medium text-base leading-relaxed">
              {option.text}
            </span>
          </button>
        ))}
      </div>

      {/* Explanation (shown after answering if provided) */}
      {answered && explanation && (
        <div className="p-4 bg-secondary/20 border border-border rounded-lg">
          <div className="text-muted-foreground text-sm font-medium mb-1">Explanation:</div>
          <div className="text-foreground text-base">{explanation}</div>
        </div>
      )}
    </div>
  )
}
