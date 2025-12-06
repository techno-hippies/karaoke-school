import { type Component, createEffect, Show } from 'solid-js'
import { Progress } from '@/components/ui/progress'
import { BackButton } from '@/components/ui/back-button'
import { cn } from '@/lib/utils'

export interface ExerciseHeaderProps {
  /** Current progress percentage (0-100) */
  progress: number
  /** Callback when close button is clicked */
  onClose: () => void
  /** Optional className for the container */
  class?: string
  /** Show close button (default: true) */
  showCloseButton?: boolean
  /** Optional stats to display */
  stats?: {
    currentCard: number
    totalCards: number
    newToday: number
    newRemaining: number
    reviewCount: number
    learningCount: number
  }
}

export const ExerciseHeader: Component<ExerciseHeaderProps> = (props) => {
  // Log stats to console instead of displaying in UI
  createEffect(() => {
    if (props.stats) {
      console.log('[ExerciseHeader]', {
        today: `${props.stats.newToday}/15 new`,
        review: `${props.stats.reviewCount} review`,
        learning: props.stats.learningCount > 0 ? `${props.stats.learningCount} learning` : undefined,
        card: `${props.stats.currentCard}/${props.stats.totalCards}`,
        progress: `${props.progress}%`
      })
    }
  })

  return (
    <div
      class={cn(
        'flex items-center gap-3 w-full',
        props.class
      )}
    >
      {/* Close button */}
      <Show when={props.showCloseButton ?? true}>
        <BackButton
          variant="close"
          onClick={props.onClose}
          class="shrink-0"
        />
      </Show>

      {/* Progress bar */}
      <div class="flex-1">
        <Progress value={props.progress} />
      </div>
    </div>
  )
}
