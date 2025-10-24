import { evmAddress } from '@lens-protocol/react'
import { useEffect, useState } from 'react'
import { fetchTimeline } from '@lens-protocol/client/actions'
import { LENS_APP_ADDRESS } from '@/lib/lens/config'
import { transformLensPostsToVideoData } from '@/lib/lens/transformers'
import { batchCheckLikedPosts } from '@/lib/lens/reactions'
import { useAuth } from '@/contexts/AuthContext'
import type { VideoPostData } from './types'
import type { Post } from '@lens-protocol/client'

export interface FollowingFeedProps {
  children: (posts: VideoPostData[], isLoading: boolean, error: string | null) => React.ReactNode
}

/**
 * FollowingFeed - Personalized feed from followed creators
 *
 * Features:
 * - Requires authentication
 * - Uses timeline API for social graph filtering
 * - Shows posts ONLY from accounts user follows
 * - Includes both copyright-free and copyrighted karaoke content
 *
 * Note: Timeline API filters by social graph, unlike global feed
 */
export function FollowingFeed({ children }: FollowingFeedProps) {
  const { lensSession, lensAccount } = useAuth()
  const [videoPosts, setVideoPosts] = useState<VideoPostData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTimeline() {
      // Require authentication for Following feed
      if (!lensSession || !lensAccount?.address) {
        setError('Please sign in to see your Following feed')
        setLoading(false)
        setVideoPosts([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log('[FollowingFeed] Fetching timeline for:', lensAccount.address)

        // ✅ FIXED: Use timeline API without globalFeed to get following feed
        // Timeline API automatically filters by social graph (followed accounts)
        const result = await fetchTimeline(lensSession, {
          account: evmAddress(lensAccount.address),
          filter: {
            // ❌ DO NOT include globalFeed: true - that fetches ALL posts
            // Timeline without globalFeed = posts from accounts you follow
            apps: [evmAddress(LENS_APP_ADDRESS)],
            metadata: {
              tags: { all: ['karaoke'] } // Filter for karaoke content
            }
          }
        })

        if (result.isErr()) {
          console.error('[FollowingFeed] Timeline error:', result.error)
          setError('Failed to load your Following feed')
          setLoading(false)
          return
        }

        const { items } = result.value
        console.log('[FollowingFeed] Timeline items:', items.length)

        // Extract posts from timeline items
        const timelinePosts = items
          .map(item => item.primary)
          .filter((post): post is Post => post.metadata?.__typename === 'VideoMetadata')

        // Batch check which posts are liked
        let likedMap = new Map<string, boolean>()
        if (lensAccount?.address) {
          try {
            likedMap = await batchCheckLikedPosts(lensSession, timelinePosts, lensAccount.address)
          } catch (err) {
            console.error('[FollowingFeed] Error checking likes:', err)
          }
        }

        // Transform using shared utility
        const posts = transformLensPostsToVideoData(
          timelinePosts,
          likedMap,
          true // User is authenticated
        )

        // Override isFollowing to true for Following feed
        // (All posts in timeline are from followed accounts)
        const postsWithFollowing = posts.map(post => ({
          ...post,
          isFollowing: true
        }))

        console.log('[FollowingFeed] Transformed posts:', postsWithFollowing.length)
        setVideoPosts(postsWithFollowing)
        setLoading(false)

      } catch (err) {
        console.error('[FollowingFeed] Error loading timeline:', err)
        setError('Something went wrong loading your feed')
        setLoading(false)
      }
    }

    loadTimeline()
  }, [lensSession, lensAccount?.address])

  return <>{children(videoPosts, loading, error)}</>
}
