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
}

export function ExerciseHeader({
  progress,
  onClose,
  className,
  showCloseButton = true,
}: ExerciseHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 w-full',
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
