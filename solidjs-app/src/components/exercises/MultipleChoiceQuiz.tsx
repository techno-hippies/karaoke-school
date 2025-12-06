import { type Component, createSignal, createEffect, Show, For } from 'solid-js'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/lib/i18n'

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

export const MultipleChoiceQuiz: Component<MultipleChoiceQuizProps> = (props) => {
  const { t } = useTranslation()
  const [internalSelectedId, setInternalSelectedId] = createSignal<string | null>(props.selectedAnswerId ?? null)
  const [internalAnswered, setInternalAnswered] = createSignal<boolean>(!!props.hasAnswered)

  const isSelectedControlled = () => typeof props.selectedAnswerId !== 'undefined'
  const isAnsweredControlled = () => typeof props.hasAnswered !== 'undefined'

  const resolvedSelectedId = () => isSelectedControlled() ? (props.selectedAnswerId ?? null) : internalSelectedId()
  const resolvedAnswered = () => isAnsweredControlled() ? !!props.hasAnswered : internalAnswered()

  // Sync with props when they change (controlled mode)
  createEffect(() => {
    if (isSelectedControlled()) {
      setInternalSelectedId(props.selectedAnswerId ?? null)
    }
  })

  createEffect(() => {
    if (isAnsweredControlled()) {
      setInternalAnswered(!!props.hasAnswered)
    }
  })

  const handleOptionClick = (option: MultipleChoiceOption) => {
    if (resolvedAnswered() || props.isProcessing) return

    if (!isSelectedControlled()) {
      setInternalSelectedId(option.id)
    }
    if (!isAnsweredControlled()) {
      setInternalAnswered(true)
    }
    props.onAnswer?.(option.id, option.isCorrect)
  }

  const getOptionStyles = (option: MultipleChoiceOption) => {
    const baseStyles = "w-full flex items-center gap-3 p-4 rounded-lg transition-all cursor-pointer min-h-[60px]"

    if (!resolvedAnswered()) {
      // Not answered yet - normal hover states (matches button outline variant)
      return cn(
        baseStyles,
        "bg-secondary/30 hover:bg-secondary/40 text-foreground"
      )
    }

    // After answering - show feedback
    const isSelected = resolvedSelectedId() === option.id
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
  const getPromptText = () => {
    switch (props.exerciseType) {
      case 'TRANSLATION_MULTIPLE_CHOICE':
      case 'TRANSLATION_QUIZ':
        return t('exercise.translate')
      case 'TRIVIA_MULTIPLE_CHOICE':
      case 'TRIVIA_QUIZ':
        return t('exercise.answer')
      default:
        return t('exercise.question')
    }
  }

  return (
    <div class="w-full space-y-6">
      {/* Question */}
      <div class="text-left space-y-3">
        <div class="text-muted-foreground text-lg sm:text-xl font-medium">
          {getPromptText()}
        </div>
        <div class="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed break-words">
          {props.question}
        </div>
      </div>

      {/* Options */}
      <div class="space-y-3">
        <For each={props.options}>
          {(option) => {
            const isSelected = () => resolvedSelectedId() === option.id
            const showSpinner = () => props.isProcessing && isSelected()

            return (
              <button
                onClick={() => handleOptionClick(option)}
                disabled={resolvedAnswered() || props.isProcessing}
                class={getOptionStyles(option)}
              >
                <span class="flex-1 text-left font-medium text-base leading-relaxed">
                  {option.text}
                </span>
                <Show when={showSpinner()}>
                  <Spinner size="sm" class="ml-2" />
                </Show>
              </button>
            )
          }}
        </For>
      </div>

      {/* Feedback with explanation (shown after answering incorrectly) */}
      <Show when={resolvedAnswered() && !props.isProcessing && props.explanation}>
        {(() => {
          const selectedOption = props.options.find(o => o.id === resolvedSelectedId())
          const isCorrect = selectedOption?.isCorrect ?? false

          return (
            <Show when={!isCorrect}>
              <div class="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <div class="flex items-center gap-2 text-destructive font-medium mb-2">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                  </svg>
                  <span>{t('exercise.incorrect')}</span>
                </div>
                <div class="text-foreground text-base">{props.explanation}</div>
              </div>
            </Show>
          )
        })()}
      </Show>
    </div>
  )
}
