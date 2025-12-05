import { Video } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { VideoThumbnail } from './VideoThumbnail'

export interface VideoPost {
  id: string
  thumbnailUrl: string
  username: string
}

export interface VideoGridProps {
  videos: VideoPost[]
  onVideoClick?: (video: VideoPost) => void
  isLoading?: boolean
  showUsernames?: boolean
  className?: string
}

/**
 * VideoGrid - Responsive grid for video posts
 * - Mobile: 3 columns
 * - Desktop: 4-6 columns based on viewport width (like TikTok)
 * - No lock state, just clean video thumbnails
 */
export function VideoGrid({
  videos,
  onVideoClick,
  isLoading = false,
  showUsernames = true,
  className
}: VideoGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn(className)}>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
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
      <div className={cn(className)}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <Video className="w-12 h-12 text-neutral-600" weight="regular" />
          </div>
          <p className="text-neutral-400 text-base">No videos yet</p>
        </div>
      </div>
    )
  }

  // Video grid
  return (
    <div className={cn(className)}>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-2">
        {videos.map((video) => (
          <VideoThumbnail
            key={video.id}
            thumbnailUrl={video.thumbnailUrl}
            username={showUsernames ? video.username : undefined}
            onClick={() => onVideoClick?.(video)}
          />
        ))}
      </div>
    </div>
  )
}
