import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface MultipleChoiceOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface MultipleChoiceExerciseProps {
  question: string
  options: MultipleChoiceOption[]
  onAnswer?: (selectedId: string, isCorrect: boolean) => void
  exerciseType?: 'translate' | 'trivia'
  isProcessing?: boolean
  hasAnswered?: boolean
  selectedAnswerId?: string | null
  explanation?: string
}

export const MultipleChoiceExercise = ({
  question,
  options,
  onAnswer,
  exerciseType = 'translate',
  isProcessing = false,
  hasAnswered = false,
  selectedAnswerId = null,
}: MultipleChoiceExerciseProps) => {
  // Use props if provided, otherwise use internal state
  const [selectedId, setSelectedId] = useState<string | null>(selectedAnswerId)
  const [answered, setAnswered] = useState(hasAnswered)
  
  // Sync with props when they change
  useEffect(() => {
    setSelectedId(selectedAnswerId)
    setAnswered(hasAnswered)
  }, [selectedAnswerId, hasAnswered])
  
  const handleOptionClick = (option: MultipleChoiceOption) => {
    if (answered) return
    
    setSelectedId(option.id)
    setAnswered(true)
    onAnswer?.(option.id, option.isCorrect)
  }

  const getOptionStyles = (option: MultipleChoiceOption) => {
    const baseStyles = "w-full flex items-center gap-3 p-4 md:p-5 rounded-lg transition-all cursor-pointer border min-h-[50px] md:min-h-[60px]"
    
    // After answering - show selected in light blue
    if (answered && selectedId === option.id) {
      return cn(baseStyles, "bg-blue-900/20 border-blue-600/50 text-blue-300")
    }
    
    // Not answered yet - normal hover states
    return cn(
      baseStyles,
      "bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-left space-y-2">
        {exerciseType === 'translate' && (
          <div className="text-neutral-400 text-base font-medium">Translate:</div>
        )}
        <div className="flex items-center gap-4">
          <div className="text-lg md:text-xl font-medium text-white leading-relaxed">{question}</div>
        </div>
      </div>
      
      <div className="space-y-3 md:space-y-4">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleOptionClick(option)}
            disabled={answered || isProcessing}
            className={getOptionStyles(option)}
          >
            <span className="flex-1 text-left font-medium text-white text-base md:text-lg leading-relaxed">
              {option.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
};