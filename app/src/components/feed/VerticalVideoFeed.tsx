import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { evmAddress } from '@lens-protocol/react'
import { fetchAccount } from '@lens-protocol/client/actions'
import { VideoPost } from './VideoPost'
import { useAuth } from '@/contexts/AuthContext'
import { followAccount, unfollowAccount } from '@/lib/lens/follow'
import { likePost, unlikePost } from '@/lib/lens/reactions'
import { toast } from 'sonner'
import type { VideoPostData } from './types'

export interface VerticalVideoFeedProps {
  videos: VideoPostData[]
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  initialVideoId?: string // Scroll to this video on mount
  updateUrlOnScroll?: boolean // Update URL as user scrolls (for video detail routes)
  baseUrl?: string // Base URL pattern for updates (e.g., '/u/username/video/')
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
  initialVideoId,
  updateUrlOnScroll = false,
  baseUrl,
}: VerticalVideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const { lensSession, pkpWalletClient, pkpAddress } = useAuth()

  // Track follow and like state for each video (optimistic updates)
  const [followStates, setFollowStates] = useState<Record<string, boolean>>({})
  const [likeStates, setLikeStates] = useState<Record<string, { isLiked: boolean; count: number }>>({})

  // Scroll to initial video on mount (for video detail navigation)
  useEffect(() => {
    if (initialVideoId && containerRef.current && videos.length > 0) {
      const index = videos.findIndex(v => v.id === initialVideoId)
      if (index >= 0) {
        console.log('[VerticalVideoFeed] Scrolling to initial video:', { initialVideoId, index })
        containerRef.current.scrollTo({
          top: index * containerRef.current.clientHeight,
          behavior: 'auto' // Instant scroll on mount
        })
        setActiveIndex(index)
      }
    }
  }, [initialVideoId, videos.length])

  // Reset active index and scroll position when first video ID changes (e.g., tab switch)
  const firstVideoId = videos.length > 0 ? videos[0].id : null
  useEffect(() => {
    // Don't reset if we have an initialVideoId (let the scroll effect above handle it)
    if (!initialVideoId) {
      setActiveIndex(0)
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
      }
    }
  }, [firstVideoId, initialVideoId])

  // Update URL when scrolling through videos (TikTok-style)
  // Use window.history.replaceState to avoid React Router re-renders
  useEffect(() => {
    if (updateUrlOnScroll && baseUrl && videos.length > 0 && activeIndex >= 0) {
      const currentVideo = videos[activeIndex]
      if (currentVideo) {
        const newUrl = `${baseUrl}${currentVideo.id}`
        console.log('[VerticalVideoFeed] Updating URL to:', newUrl)

        // Use native history API to avoid triggering React Router re-render
        window.history.replaceState(
          {
            thumbnailUrl: currentVideo.thumbnailUrl,
            scrollIndex: activeIndex
          },
          '',
          newUrl
        )
      }
    }
  }, [activeIndex, updateUrlOnScroll, baseUrl, videos])

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

  if (videos.length === 0 && !isLoading) {
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
      {videos.map((video, index) => {
        const finalFollowState = followStates[video.id] ?? video.isFollowing
        const finalLikeState = likeStates[video.id] ?? { isLiked: video.isLiked, count: video.likes }

        return (
          <div key={video.id} className="h-screen w-full snap-start snap-always">
            <VideoPost
              {...video}
              isFollowing={finalFollowState}
              isLiked={finalLikeState.isLiked}
              likes={finalLikeState.count}
              autoplay={index === activeIndex}
              karaokeClassName="pt-20 md:pt-6"
              onLikeClick={async () => {
                console.log('[VerticalVideoFeed] Like clicked:', video.id)

                // Check if user is authenticated
                if (!lensSession) {
                  toast.error('Please sign in to like posts')
                  return
                }

                // Get current like state (use optimistic state if available, otherwise server state)
                const currentState = likeStates[video.id] ?? { isLiked: video.isLiked, count: video.likes }

                // Optimistically update UI
                setLikeStates(prev => ({
                  ...prev,
                  [video.id]: {
                    isLiked: !currentState.isLiked,
                    count: currentState.isLiked ? currentState.count - 1 : currentState.count + 1
                  }
                }))

                try {
                  let success: boolean
                  if (currentState.isLiked) {
                    // Unlike
                    success = await unlikePost(lensSession, video.id)
                    if (success) {
                      console.log('[VerticalVideoFeed] Successfully unliked post')
                    } else {
                      // Revert on error
                      setLikeStates(prev => ({
                        ...prev,
                        [video.id]: currentState
                      }))
                      toast.error('Failed to unlike post')
                    }
                  } else {
                    // Like
                    success = await likePost(lensSession, video.id)
                    if (success) {
                      console.log('[VerticalVideoFeed] Successfully liked post')
                    } else {
                      // Revert on error
                      setLikeStates(prev => ({
                        ...prev,
                        [video.id]: currentState
                      }))
                      toast.error('Failed to like post')
                    }
                  }
                } catch (error) {
                  console.error('[VerticalVideoFeed] Like error:', error)
                  toast.error('An unexpected error occurred')
                  // Revert optimistic update
                  setLikeStates(prev => ({
                    ...prev,
                    [video.id]: currentState
                  }))
                }
              }}
              onCommentClick={() => {
                console.log('[VerticalVideoFeed] Comment clicked:', video.id)
                // TODO: Handle comment sheet
              }}
              onShareClick={() => {
                console.log('[VerticalVideoFeed] Share clicked:', video.id)
                // TODO: Handle share sheet
              }}
              onFollowClick={async () => {
                console.log('[VerticalVideoFeed] Follow clicked:', video.username)

                // Check if user is authenticated
                if (!lensSession || !pkpWalletClient) {
                  toast.error('Please sign in to follow accounts')
                  return
                }

                // Check if author address is available
                if (!video.authorAddress) {
                  toast.error('Author information not available')
                  return
                }

                // Check if trying to follow yourself
                if (video.authorAddress === pkpAddress) {
                  toast.error('You cannot follow yourself')
                  return
                }

                // Get current follow state (use optimistic state if available, otherwise server state)
                const currentState = followStates[video.id] ?? video.isFollowing ?? false

                // Optimistically update UI
                setFollowStates(prev => ({
                  ...prev,
                  [video.id]: !currentState
                }))

                try {
                  let result
                  if (currentState) {
                    // Unfollow
                    result = await unfollowAccount(lensSession, pkpWalletClient, video.authorAddress)
                    if (result.success) {
                      toast.success(`Unfollowed @${video.username}`)
                    } else {
                      // Revert on error
                      setFollowStates(prev => ({
                        ...prev,
                        [video.id]: currentState
                      }))
                      toast.error(result.error || 'Failed to unfollow')
                    }
                  } else {
                    // Follow
                    result = await followAccount(lensSession, pkpWalletClient, video.authorAddress)
                    if (result.success) {
                      toast.success(`Following @${video.username}`)
                    } else {
                      // Revert on error
                      setFollowStates(prev => ({
                        ...prev,
                        [video.id]: currentState
                      }))
                      toast.error(result.error || 'Failed to follow')
                    }
                  }
                } catch (error) {
                  console.error('[VerticalVideoFeed] Follow error:', error)
                  toast.error('An unexpected error occurred')
                  // Revert optimistic update
                  setFollowStates(prev => ({
                    ...prev,
                    [video.id]: currentState
                  }))
                }
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
        )
      })}

      {/* Loading indicator for infinite scroll */}
      {isLoading && videos.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm z-50">
          Loading more...
        </div>
      )}
    </div>
  )
}
