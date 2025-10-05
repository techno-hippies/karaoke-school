import { Play } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface VideoThumbnailProps {
  thumbnailUrl: string
  playCount: number
  onClick?: () => void
  className?: string
}

/**
 * VideoThumbnail - Thumbnail for profile video grid
 * Shows thumbnail image with play count overlay and hover effect
 */
export function VideoThumbnail({
  thumbnailUrl,
  playCount,
  onClick,
  className
}: VideoThumbnailProps) {
  // Format play count with K/M suffixes
  const formatPlayCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  return (
    <div
      className={cn(
        'relative aspect-[9/16] bg-neutral-900 overflow-hidden cursor-pointer group md:rounded-md',
        className
      )}
      onClick={onClick}
    >
      {/* Thumbnail Image */}
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Play Count Overlay - bottom left */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-foreground text-base font-semibold">
        <Play weight="fill" className="w-4 h-4" />
        <span>{formatPlayCount(playCount)}</span>
      </div>

      {/* Hover Overlay - desktop only */}
      <div className="hidden md:flex absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 items-center justify-center">
        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Play className="w-8 h-8 text-foreground ml-1" weight="fill" />
        </div>
      </div>
    </div>
  )
}
