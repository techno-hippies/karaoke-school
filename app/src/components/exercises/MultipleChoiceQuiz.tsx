import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

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
  /** Exercise type to determine prompt text (matches subgraph enum) */
  exerciseType?: 'TRANSLATION_MULTIPLE_CHOICE' | 'TRIVIA_MULTIPLE_CHOICE' | 'TRANSLATION_QUIZ' | 'TRIVIA_QUIZ'
}

export const MultipleChoiceQuiz = ({
  question,
  options,
  onAnswer,
  isProcessing = false,
  hasAnswered,
  selectedAnswerId,
  explanation,
  exerciseType = 'TRIVIA_QUIZ',
}: MultipleChoiceQuizProps) => {
  const { t } = useTranslation()
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedAnswerId ?? null)
  const [internalAnswered, setInternalAnswered] = useState<boolean>(!!hasAnswered)

  const isSelectedControlled = typeof selectedAnswerId !== 'undefined'
  const isAnsweredControlled = typeof hasAnswered !== 'undefined'

  const resolvedSelectedId = isSelectedControlled ? (selectedAnswerId ?? null) : internalSelectedId
  const resolvedAnswered = isAnsweredControlled ? !!hasAnswered : internalAnswered

  // Sync with props when they change (controlled mode)
  useEffect(() => {
    if (isSelectedControlled) {
      setInternalSelectedId(selectedAnswerId ?? null)
    }
  }, [selectedAnswerId, isSelectedControlled])

  useEffect(() => {
    if (isAnsweredControlled) {
      setInternalAnswered(!!hasAnswered)
    }
  }, [hasAnswered, isAnsweredControlled])

  const handleOptionClick = (option: MultipleChoiceOption) => {
    if (resolvedAnswered || isProcessing) return

    if (!isSelectedControlled) {
      setInternalSelectedId(option.id)
    }
    if (!isAnsweredControlled) {
      setInternalAnswered(true)
    }
    onAnswer?.(option.id, option.isCorrect)
  }

  const getOptionStyles = (option: MultipleChoiceOption) => {
    const baseStyles = "w-full flex items-center gap-3 p-4 rounded-lg transition-all cursor-pointer min-h-[60px]"

    if (!resolvedAnswered) {
      // Not answered yet - normal hover states (matches button outline variant)
      return cn(
        baseStyles,
        "bg-secondary/30 hover:bg-secondary/50 text-foreground"
      )
    }

    // After answering - show feedback
    const isSelected = resolvedSelectedId === option.id
    const isCorrectAnswer = option.isCorrect

    if (isSelected && isCorrectAnswer) {
      // User selected the correct answer - green
      return cn(
        baseStyles,
        "bg-green-500/20 text-green-400"
      )
    }

    if (isSelected && !isCorrectAnswer) {
      // User selected wrong answer - red
      return cn(
        baseStyles,
        "bg-destructive/20 text-destructive"
      )
    }

    if (!isSelected && isCorrectAnswer) {
      // Show correct answer even if not selected - green
      return cn(
        baseStyles,
        "bg-green-500/10 text-green-400"
      )
    }

    // Not selected and not correct - muted
    return cn(
      baseStyles,
      "bg-muted/30 text-muted-foreground opacity-60"
    )
  }

  // Determine prompt text based on exercise type
  // Translation = learner selects correct translation of English text
  // Trivia = learner answers a question about the song/lyrics
  const getPromptText = () => {
    switch (exerciseType) {
      case 'TRANSLATION_MULTIPLE_CHOICE':
      case 'TRANSLATION_QUIZ':
        return t('study.translate')
      case 'TRIVIA_MULTIPLE_CHOICE':
      case 'TRIVIA_QUIZ':
        return t('study.answer')
      default:
        return t('study.question')
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Question */}
      <div className="text-left space-y-3">
        <div className="text-muted-foreground text-base font-medium">
          {getPromptText()}
        </div>
        <div className="text-base sm:text-lg md:text-xl font-medium text-foreground leading-relaxed break-words">
          {question}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = resolvedSelectedId === option.id
          const showSpinner = isProcessing && isSelected

          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option)}
              disabled={resolvedAnswered || isProcessing}
              className={getOptionStyles(option)}
            >
              <span className="flex-1 text-left font-medium text-base leading-relaxed">
                {option.text}
              </span>
              {showSpinner && (
                <Spinner size="sm" className="ml-2" />
              )}
            </button>
          )
        })}
      </div>

      {/* Explanation (shown after answering if provided) */}
      {resolvedAnswered && !isProcessing && explanation && (
        <div className="p-4 bg-secondary/20 rounded-lg">
          <div className="text-muted-foreground text-base font-medium mb-1">{t('study.explanation')}</div>
          <div className="text-foreground text-base">{explanation}</div>
        </div>
      )}
    </div>
  )
}
