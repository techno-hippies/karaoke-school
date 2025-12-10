import { createSignal, createEffect, onMount, onCleanup, For, Show, type Component } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { VideoPost } from './VideoPost'
import { useSongPrefetch } from '@/hooks/usePrefetch'
import { useTranslation } from '@/lib/i18n'
import { haptic } from '@/lib/utils'
import type { VideoPostData } from './types'

export interface VerticalVideoFeedProps {
  videos: VideoPostData[]
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  initialVideoId?: string
  hasMobileFooter?: boolean
  onLikeClick?: (videoId: string) => void
  onProfileClick?: (username: string) => void
  /** Show back button on videos */
  showBackButton?: boolean
  /** Back button click handler */
  onBack?: () => void
  /** Called when video has been watched for 3+ seconds */
  onVideoViewed?: (postId: string) => void
}

/**
 * VerticalVideoFeed - TikTok-style vertical scrolling video feed
 * Features snap scrolling and keyboard navigation
 */
export const VerticalVideoFeed: Component<VerticalVideoFeedProps> = (props) => {
  const { t } = useTranslation()
  let containerRef: HTMLDivElement | undefined
  const [activeIndex, setActiveIndex] = createSignal(0)
  const navigate = useNavigate()
  const { prefetch: prefetchSong } = useSongPrefetch()

  // Prefetch song data when active video changes
  createEffect(() => {
    const video = props.videos[activeIndex()]
    if (video?.spotifyTrackId) {
      prefetchSong(video.spotifyTrackId)
    }
  })

  // Scroll to initial video on mount
  onMount(() => {
    if (props.initialVideoId && containerRef && props.videos.length > 0) {
      const index = props.videos.findIndex(v => v.id === props.initialVideoId)
      if (index >= 0) {
        containerRef.scrollTo({
          top: index * containerRef.clientHeight,
          behavior: 'auto'
        })
        setActiveIndex(index)
      }
    }
  })

  // Handle scroll to update active index
  const handleScroll = () => {
    if (!containerRef) return

    const scrollTop = containerRef.scrollTop
    const viewportHeight = containerRef.clientHeight
    const newIndex = Math.round(scrollTop / viewportHeight)

    if (newIndex !== activeIndex() && newIndex >= 0 && newIndex < props.videos.length) {
      haptic.light()
      setActiveIndex(newIndex)
    }

    // Load more when approaching the end
    if (props.hasMore && newIndex >= props.videos.length - 2) {
      props.onLoadMore?.()
    }
  }

  // Attach scroll listener
  onMount(() => {
    containerRef?.addEventListener('scroll', handleScroll)
    onCleanup(() => containerRef?.removeEventListener('scroll', handleScroll))
  })

  // Keyboard navigation
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef) return

      if (e.key === 'ArrowDown' && activeIndex() < props.videos.length - 1) {
        e.preventDefault()
        const nextIndex = activeIndex() + 1
        containerRef.scrollTo({
          top: nextIndex * containerRef.clientHeight,
          behavior: 'smooth'
        })
      } else if (e.key === 'ArrowUp' && activeIndex() > 0) {
        e.preventDefault()
        const prevIndex = activeIndex() - 1
        containerRef.scrollTo({
          top: prevIndex * containerRef.clientHeight,
          behavior: 'smooth'
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
  })

  return (
    <Show
      when={props.videos.length > 0 || props.isLoading}
      fallback={
        <div class="h-vh-screen md:h-screen w-full flex items-center justify-center bg-background">
          <div class="text-foreground text-lg">{t('video.noVideos')}</div>
        </div>
      }
    >
      <div
        ref={containerRef}
        class="h-vh-screen md:h-screen w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ 'scrollbar-width': 'none', '-ms-overflow-style': 'none' }}
      >
        <For each={props.videos}>
          {(video, index) => {
            // Determine if this video should autoplay
            const isActive = () => index() === activeIndex()
            // Priority load for active video and adjacent ones (prev/next)
            const shouldPriorityLoad = () => {
              const current = activeIndex()
              const i = index()
              return i === current || i === current - 1 || i === current + 1
            }

            return (
              <div class="h-vh-screen md:h-screen w-full snap-start snap-always">
                <VideoPost
                  id={video.id}
                  videoUrl={video.videoUrl}
                  thumbnailUrl={video.thumbnailUrl}
                  username={video.username}
                  userAvatar={video.userAvatar}
                  authorAddress={video.authorAddress}
                  grade={video.grade}
                  musicTitle={video.musicTitle}
                  musicAuthor={video.musicAuthor}
                  musicImageUrl={video.musicImageUrl}
                  artistSlug={video.artistSlug}
                  songSlug={video.songSlug}
                  spotifyTrackId={video.spotifyTrackId}
                  likes={video.likes}
                  shares={video.shares}
                  isLiked={video.isLiked}
                  canInteract={video.canInteract}
                  autoplay={isActive()}
                  priorityLoad={shouldPriorityLoad()}
                  hasMobileFooter={props.hasMobileFooter}
                  showBackButton={props.showBackButton}
                  onBack={props.onBack}
                  onLikeClick={() => props.onLikeClick?.(video.id)}
                  onProfileClick={() => {
                    props.onProfileClick?.(video.username)
                    navigate(`/u/${video.username}`)
                  }}
                  onViewed={props.onVideoViewed}
                />
              </div>
            )
          }}
        </For>

        {/* Loading indicator at bottom */}
        <Show when={props.isLoading}>
          <div class="h-20 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </Show>
      </div>
    </Show>
  )
}
