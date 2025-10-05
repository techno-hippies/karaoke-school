import { cn } from '@/lib/utils'
import { VideoThumbnail } from '../feed/VideoThumbnail'

export interface Video {
  id: string
  thumbnailUrl: string
  playCount: number
  videoUrl?: string
}

export interface VideoGridProps {
  videos: Video[]
  onVideoClick?: (video: Video) => void
  isLoading?: boolean
  className?: string
}

/**
 * VideoGrid - Clean responsive grid for profile videos
 * 3 columns on mobile, 6 columns on desktop
 * No inline styles, no !important, no data attributes
 */
export function VideoGrid({
  videos,
  onVideoClick,
  isLoading = false,
  className
}: VideoGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('px-4 md:px-6', className)}>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] bg-neutral-800 rounded-md animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (videos.length === 0) {
    return (
      <div className={cn('px-4 md:px-6', className)}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-neutral-400 text-base">No videos yet</p>
        </div>
      </div>
    )
  }

  // Video grid
  return (
    <div className={cn('px-4 md:px-6', className)}>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-2">
        {videos.map((video) => (
          <VideoThumbnail
            key={video.id}
            thumbnailUrl={video.thumbnailUrl}
            playCount={video.playCount}
            onClick={() => onVideoClick?.(video)}
          />
        ))}
      </div>
    </div>
  )
}
