import { Play, Pause, CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface AudioButtonProps {
  /** Whether audio is currently playing */
  isPlaying?: boolean
  /** Whether audio is loading */
  isLoading?: boolean
  /** Click handler */
  onClick?: () => void
  /** Optional size - defaults to 48px (w-12 h-12) */
  size?: 'sm' | 'md' | 'lg'
  /** Optional className for additional styling */
  className?: string
  /** Aria label for accessibility */
  'aria-label'?: string
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
}

const iconSizes = {
  sm: 20,
  md: 24,
  lg: 32,
}

export function AudioButton({
  isPlaying = false,
  isLoading = false,
  onClick,
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Play audio',
}: AudioButtonProps) {
  const iconSize = iconSizes[size]

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'flex items-center justify-center rounded-full transition-all cursor-pointer',
        'bg-primary hover:opacity-90 disabled:opacity-50',
        sizeClasses[size],
        className
      )}
      aria-label={ariaLabel}
    >
      {isLoading ? (
        <CircleNotch
          size={iconSize}
          weight="bold"
          className="text-foreground animate-spin"
        />
      ) : isPlaying ? (
        <Pause size={iconSize} weight="fill" className="text-foreground" />
      ) : (
        <Play size={iconSize} weight="fill" className="text-foreground" />
      )}
    </button>
  )
}
