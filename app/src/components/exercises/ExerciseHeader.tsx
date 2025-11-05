import { X } from '@phosphor-icons/react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ExerciseHeaderProps {
  /** Current progress percentage (0-100) */
  progress: number
  /** Callback when close button is clicked */
  onClose: () => void
  /** Optional className for the container */
  className?: string
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

export function ExerciseHeader({
  progress,
  onClose,
  className,
  showCloseButton = true,
  stats,
}: ExerciseHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 w-full',
        className
      )}
    >
      {/* Top row: Close button and stats */}
      <div className="flex items-center gap-4">
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <X size={24} weight="bold" />
          </Button>
        )}

        {/* Daily stats */}
        {stats && (
          <div className="flex-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">
              Today: {stats.newToday}/15 new
            </span>
            <span>•</span>
            <span>
              {stats.reviewCount} review
            </span>
            {stats.learningCount > 0 && (
              <>
                <span>•</span>
                <span>
                  {stats.learningCount} learning
                </span>
              </>
            )}
            <span className="ml-auto">
              Card {stats.currentCard}/{stats.totalCards}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <Progress value={progress} />
      </div>
    </div>
  )
}
