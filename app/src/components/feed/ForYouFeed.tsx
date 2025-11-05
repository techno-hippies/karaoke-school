import { usePosts, evmAddress } from '@lens-protocol/react'
import { useState, useEffect, useMemo, useRef } from 'react'
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

  // Memoize posts array to stabilize dependency
  const posts = useMemo(() => {
    return (postsData?.items ?? []).filter((post): post is Post => 'metadata' in post)
  }, [postsData?.items])

  // Track post IDs to detect when posts actually change (not just reference)
  const previousPostIds = useRef<Set<string>>(new Set())
  const postsHaveChanged = useMemo(() => {
    const currentPostIds = new Set(posts.map(post => post.id))
    
    // Check if any posts were added, removed, or changed
    if (currentPostIds.size !== previousPostIds.current.size) {
      return true
    }
    
    for (const id of currentPostIds) {
      if (!previousPostIds.current.has(id)) {
        return true
      }
    }
    
    return false
  }, [posts.map(post => post.id).sort().join(',')])

  // Batch check liked status when authenticated and posts actually change
  useEffect(() => {
    if (!isAuthenticated || !lensAccount?.address || !posts.length || !postsHaveChanged) {
      if (!posts.length) {
        setLikedPostsMap(new Map())
      }
      return
    }

    const checkLikedPosts = async () => {
      setIsCheckingLikes(true)
      try {
        const videoPosts = posts.filter(
          (post): post is Post => post.metadata?.__typename === 'VideoMetadata'
        )
        const likedMap = await batchCheckLikedPosts(lensSession, videoPosts, lensAccount.address)
        setLikedPostsMap(likedMap)
        
        // Update previous post IDs after successful check
        previousPostIds.current = new Set(posts.map(post => post.id))
      } catch (error) {
        console.error('[ForYouFeed] Error checking liked posts:', error)
      } finally {
        setIsCheckingLikes(false)
      }
    }

    checkLikedPosts()
  }, [lensSession, lensAccount?.address, postsHaveChanged, isAuthenticated])

  // Transform Lens posts to VideoPostData using shared utility (memoized)
  const videoPosts = useMemo(() => {
    return transformLensPostsToVideoData(posts, likedPostsMap, isAuthenticated)
  }, [posts, likedPostsMap, isAuthenticated])

  return <>{children(videoPosts, loading || isCheckingLikes)}</>
}
