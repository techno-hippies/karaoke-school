import React from 'react'
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
  // Log stats to console instead of displaying in UI
  React.useEffect(() => {
    if (stats) {
      console.log('[ExerciseHeader]', {
        today: `${stats.newToday}/15 new`,
        review: `${stats.reviewCount} review`,
        learning: stats.learningCount > 0 ? `${stats.learningCount} learning` : undefined,
        card: `${stats.currentCard}/${stats.totalCards}`,
        progress: `${progress}%`
      })
    }
  }, [stats, progress])

  return (
    <div
      className={cn(
        'flex items-center gap-3 w-full',
        className
      )}
    >
      {/* Close button */}
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

      {/* Progress bar */}
      <div className="flex-1">
        <Progress value={progress} />
      </div>
    </div>
  )
}
