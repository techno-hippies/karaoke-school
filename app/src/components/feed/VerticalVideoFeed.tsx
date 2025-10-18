import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { VideoPost } from './VideoPost'
import type { VideoPostData } from './types'

export interface VerticalVideoFeedProps {
  videos: VideoPostData[]
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

/**
 * VerticalVideoFeed - TikTok-style vertical scrolling video feed
 * Custom implementation with snap scrolling and keyboard navigation
 */
export function VerticalVideoFeed({
  videos,
  isLoading = false,
  onLoadMore,
  hasMore = false,
}: VerticalVideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()

  // Handle scroll to detect active video
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const viewportHeight = container.clientHeight
      const newIndex = Math.round(scrollTop / viewportHeight)

      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
        setActiveIndex(newIndex)

        // Load more when approaching end of feed
        if (newIndex >= videos.length - 3 && hasMore && onLoadMore) {
          onLoadMore()
        }
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeIndex, videos.length, hasMore, onLoadMore])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current
      if (!container) return

      if (e.key === 'ArrowDown' && activeIndex < videos.length - 1) {
        e.preventDefault()
        const nextIndex = activeIndex + 1
        container.scrollTo({
          top: nextIndex * container.clientHeight,
          behavior: 'smooth'
        })
      } else if (e.key === 'ArrowUp' && activeIndex > 0) {
        e.preventDefault()
        const prevIndex = activeIndex - 1
        container.scrollTo({
          top: prevIndex * container.clientHeight,
          behavior: 'smooth'
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, videos.length])

  if (isLoading && videos.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-white text-lg">Loading feed...</div>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-white text-lg">No videos available</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-screen w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {videos.map((video, index) => (
          <div key={video.id} className="h-screen w-full snap-start snap-always">
            <VideoPost
              {...video}
              autoplay={index === activeIndex}
              onLikeClick={() => {
                console.log('[VerticalVideoFeed] Like clicked:', video.id)
                // TODO: Implement like mutation
              }}
              onCommentClick={() => {
                console.log('[VerticalVideoFeed] Comment clicked:', video.id)
                // TODO: Handle comment sheet
              }}
              onShareClick={() => {
                console.log('[VerticalVideoFeed] Share clicked:', video.id)
                // TODO: Handle share sheet
              }}
              onFollowClick={() => {
                console.log('[VerticalVideoFeed] Follow clicked:', video.username)
                // TODO: Implement follow mutation
              }}
              onProfileClick={() => {
                console.log('[VerticalVideoFeed] Profile clicked:', video.username)
                navigate(`/u/${video.username}`)
              }}
              onAudioClick={() => {
                console.log('[VerticalVideoFeed] Audio clicked:', video.geniusId)
                if (video.geniusId) {
                  navigate(`/song/${video.geniusId}`)
                }
              }}
            />
          </div>
      ))}

      {/* Loading indicator for infinite scroll */}
      {isLoading && videos.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm z-50">
          Loading more...
        </div>
      )}
    </div>
  )
}
