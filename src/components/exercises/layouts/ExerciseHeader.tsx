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
        'fixed top-0 left-0 right-0 z-10 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-700',
        className
      )}
    >
      <div className="w-full max-w-2xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Close button */}
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-neutral-400 hover:text-white shrink-0"
              aria-label="Close"
            >
              <X size={24} weight="bold" />
            </Button>
          )}

          {/* Progress bar */}
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>
    </div>
  )
}
