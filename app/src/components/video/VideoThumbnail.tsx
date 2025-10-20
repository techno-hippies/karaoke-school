import { cn } from '@/lib/utils'

export interface VideoThumbnailProps {
  thumbnailUrl: string
  username: string
  onClick?: () => void
  className?: string
}

/**
 * VideoThumbnail - Individual video item for grids
 * Shows thumbnail with username overlay (bottom left)
 */
export function VideoThumbnail({
  thumbnailUrl,
  username,
  onClick,
  className
}: VideoThumbnailProps) {
  return (
    <div
      className={cn(
        'relative aspect-[9/16] bg-neutral-900 overflow-hidden cursor-pointer group md:rounded-xl',
        className
      )}
      onClick={onClick}
    >
      {/* Thumbnail Image */}
      <img
        src={thumbnailUrl}
        alt={`Video by ${username}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Bottom Overlay with username */}
      <div className="absolute bottom-2 left-2">
        <p className="text-white text-xs font-semibold drop-shadow-lg">
          @{username}
        </p>
      </div>
    </div>
  )
}
