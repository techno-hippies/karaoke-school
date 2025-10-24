import { usePosts, evmAddress } from '@lens-protocol/react'
import { useState, useEffect } from 'react'
import { LENS_APP_ADDRESS } from '@/lib/lens/config'
import { transformLensPostsToVideoData } from '@/lib/lens/transformers'
import { batchCheckLikedPosts } from '@/lib/lens/reactions'
import { useAuth } from '@/contexts/AuthContext'
import type { VideoPostData } from './types'
import type { Post } from '@lens-protocol/client'

export interface ForYouFeedProps {
  children: (posts: VideoPostData[], isLoading: boolean) => React.ReactNode
}

/**
 * ForYouFeed - Global feed of copyright-free karaoke posts
 *
 * Features:
 * - Fetches posts with karaoke tag from app
 * - Uses global feed (all creators, not just following)
 * - Checks like status for authenticated users
 * - Transforms Lens posts to VideoPostData format
 *
 * Uses render props pattern to pass data to presentation components
 */
export function ForYouFeed({ children }: ForYouFeedProps) {
  const { lensSession, lensAccount } = useAuth()
  const isAuthenticated = !!lensSession
  const [likedPostsMap, setLikedPostsMap] = useState<Map<string, boolean>>(new Map())
  const [isCheckingLikes, setIsCheckingLikes] = useState(false)

  // Fetch posts using Lens React hook
  const { data: postsData, loading } = usePosts({
    filter: {
      apps: [evmAddress(LENS_APP_ADDRESS)],
      feeds: [{ globalFeed: true }], // ✅ Correctly using global feed
      metadata: {
        tags: { all: ['karaoke'] } // Only show karaoke content
      }
    },
  })

  // Batch check liked status when authenticated and posts load
  useEffect(() => {
    if (!isAuthenticated || !lensAccount?.address || !postsData?.items?.length) {
      setLikedPostsMap(new Map())
      return
    }

    const checkLikedPosts = async () => {
      setIsCheckingLikes(true)
      try {
        const posts = postsData.items.filter(
          (post): post is Post => 'metadata' in post && post.metadata?.__typename === 'VideoMetadata'
        )
        const likedMap = await batchCheckLikedPosts(lensSession, posts, lensAccount.address)
        setLikedPostsMap(likedMap)
      } catch (error) {
        console.error('[ForYouFeed] Error checking liked posts:', error)
      } finally {
        setIsCheckingLikes(false)
      }
    }

    checkLikedPosts()
  }, [lensSession, lensAccount?.address, postsData?.items, isAuthenticated])

  // Transform Lens posts to VideoPostData using shared utility
  console.log('[ForYouFeed] Posts data:', postsData)
  console.log('[ForYouFeed] Number of posts:', postsData?.items?.length)

  const videoPosts = transformLensPostsToVideoData(
    (postsData?.items ?? []).filter((post): post is Post => 'metadata' in post),
    likedPostsMap,
    isAuthenticated
  )

  console.log('[ForYouFeed] Transformed video posts:', videoPosts)

  return <>{children(videoPosts, loading || isCheckingLikes)}</>
}
