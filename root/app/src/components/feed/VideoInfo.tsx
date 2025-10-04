import { cn } from '@/lib/utils'
import type { VideoInfoProps } from './types'

/**
 * VideoInfo - Username and description overlay
 * Mobile: bottom-left with gradient background
 * Desktop: bottom-left inside video container
 */
export function VideoInfo({
  username,
  description,
  onUsernameClick,
  className
}: VideoInfoProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Username - clickable */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUsernameClick?.()
        }}
        className="text-white font-semibold text-base hover:underline cursor-pointer drop-shadow-lg"
      >
        @{username}
      </button>

      {/* Description */}
      <p className="text-white text-sm drop-shadow-lg leading-tight">
        {description}
      </p>
    </div>
  )
}
