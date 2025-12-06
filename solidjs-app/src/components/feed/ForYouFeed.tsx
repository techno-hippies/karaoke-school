import { createSignal, createMemo, Show, type Component } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useFeedPosts } from '../../lib/lens'
import { VerticalVideoFeed } from './VerticalVideoFeed'
import { FeedLoadingSkeleton } from './FeedLoadingSkeleton'
import { useViewHistory, sortByViewStatus } from '@/hooks/useViewHistory'

export interface ForYouFeedProps {
  /** Initial video ID to scroll to */
  initialVideoId?: string
  /** Whether to show mobile footer spacing */
  hasMobileFooter?: boolean
  /** Show back button on videos */
  showBackButton?: boolean
  /** Back button click handler */
  onBack?: () => void
}

/**
 * ForYouFeed - Global feed of karaoke posts from Lens Protocol
 *
 * Features:
 * - Fetches posts with karaoke tag from app
 * - Uses global feed (all creators)
 * - Handles like/follow interactions
 * - Lazy loads more posts on scroll
 */
export const ForYouFeed: Component<ForYouFeedProps> = (props) => {
  const navigate = useNavigate()

  // Fetch posts from Lens
  const { posts, isLoading, hasMore, loadMore } = useFeedPosts()

  // View history for sorting unseen posts first
  const { markViewed, viewedPostIds, isLoaded: viewHistoryLoaded } = useViewHistory()

  // Capture initial view history snapshot (won't change during session)
  // This prevents re-sorting when new videos are marked as viewed
  const [initialViewedIds, setInitialViewedIds] = createSignal<Set<string> | null>(null)

  // Set the initial snapshot once when view history loads
  createMemo(() => {
    if (viewHistoryLoaded() && initialViewedIds() === null) {
      setInitialViewedIds(new Set(viewedPostIds()))
    }
  })

  // Local state for optimistic UI updates
  const [localLikes, setLocalLikes] = createSignal<Map<string, boolean>>(new Map())
  const [localFollows, setLocalFollows] = createSignal<Map<string, boolean>>(new Map())

  // Merge server data with local optimistic updates
  const videoPosts = createMemo(() => {
    const likes = localLikes()
    const follows = localFollows()

    const merged = posts().map(post => ({
      ...post,
      isLiked: likes.has(post.id) ? likes.get(post.id)! : post.isLiked,
      isFollowing: follows.has(post.username) ? follows.get(post.username)! : post.isFollowing,
      likes: likes.has(post.id)
        ? (likes.get(post.id) ? post.likes + 1 : Math.max(0, post.likes - 1))
        : post.likes,
    }))

    // Sort: unseen videos first using initial snapshot (not reactive to new views)
    const snapshot = initialViewedIds()
    if (snapshot) {
      return sortByViewStatus(merged, (id) => snapshot.has(id))
    }
    return merged
  })

  // Handle like toggle (optimistic update)
  const handleLike = async (videoId: string) => {
    const post = posts().find(p => p.id === videoId)
    if (!post) return

    // Optimistic update
    setLocalLikes(prev => {
      const next = new Map(prev)
      const currentlyLiked = next.has(videoId) ? next.get(videoId)! : post.isLiked
      next.set(videoId, !currentlyLiked)
      return next
    })

    // TODO: Call Lens API to actually like/unlike
  }

  // Handle follow toggle (optimistic update)
  const handleFollow = async (videoId: string) => {
    const post = posts().find(p => p.id === videoId)
    if (!post) return

    // Optimistic update
    setLocalFollows(prev => {
      const next = new Map(prev)
      const currentlyFollowing = next.has(post.username) ? next.get(post.username)! : post.isFollowing
      next.set(post.username, !currentlyFollowing)
      return next
    })

    // TODO: Call Lens API to actually follow/unfollow
  }

  // Handle profile click
  const handleProfileClick = (username: string) => {
    navigate(`/u/${username}`)
  }

  // Wait for view history snapshot before showing feed (prevents flash of wrong order)
  const feedIsLoading = () => isLoading() || initialViewedIds() === null

  return (
    <Show
      when={!feedIsLoading() || posts().length > 0}
      fallback={<FeedLoadingSkeleton />}
    >
      <Show
        when={posts().length > 0}
        fallback={
          <div class="h-screen w-full flex items-center justify-center bg-background">
            <div class="text-center space-y-4">
              <div class="text-foreground text-lg">No videos available</div>
              <div class="text-muted-foreground text-sm">Check back later for new content</div>
            </div>
          </div>
        }
      >
        <VerticalVideoFeed
          videos={videoPosts()}
          initialVideoId={props.initialVideoId}
          hasMobileFooter={props.hasMobileFooter}
          showBackButton={props.showBackButton}
          onBack={props.onBack}
          isLoading={isLoading()}
          hasMore={hasMore()}
          onLoadMore={loadMore}
          onLikeClick={handleLike}
          onFollowClick={handleFollow}
          onProfileClick={handleProfileClick}
          onVideoViewed={markViewed}
        />
      </Show>
    </Show>
  )
}
