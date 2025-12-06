import { type Component, createEffect } from 'solid-js'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
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
      {(props.showCloseButton ?? true) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onClose}
          class="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      )}

      {/* Progress bar */}
      <div class="flex-1">
        <Progress value={props.progress} />
      </div>
    </div>
  )
}
