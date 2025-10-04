import { CaretLeft } from '@phosphor-icons/react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export interface BackButtonProps {
  onClick?: () => void
  className?: string
  'aria-label'?: string
  variant?: 'default' | 'floating'
}

/**
 * BackButton - Standardized back navigation button
 * Used for full-page navigation (returns to previous page in stack)
 * Always positioned top-left, uses CaretLeft chevron
 *
 * Variants:
 * - default: In header with solid background (uses theme colors)
 * - floating: Over content like album art (white icon, subtle dark hover)
 */
export function BackButton({
  onClick,
  className,
  'aria-label': ariaLabel = 'Go back',
  variant = 'default'
}: BackButtonProps) {
  const isFloating = variant === 'floating'

  return (
    <Button
      variant="ghost"
      size="lg"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "w-12 px-0",
        isFloating && "text-white hover:bg-black/30 hover:text-white",
        className
      )}
    >
      <CaretLeft className="w-6 h-6" weight="bold" />
    </Button>
  )
}
