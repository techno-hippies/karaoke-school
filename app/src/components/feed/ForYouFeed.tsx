import { usePosts, evmAddress } from '@lens-protocol/react'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
 * - ALWAYS uses global feed (all creators, not personalized timeline)
 * - Checks like status for authenticated users
 * - Transforms Lens posts to VideoPostData format
 *
 * Note: This feed is not personalized. For personalized content, see FollowingFeed.
 *
 * Uses render props pattern to pass data to presentation components
 */
export function ForYouFeed({ children }: ForYouFeedProps) {
  const { lensSession, lensAccount } = useAuth()
  const isAuthenticated = !!lensSession && !!lensAccount?.address
  const likedPostsMapRef = useRef<Map<string, boolean>>(new Map())
  const [likedPostsVersion, setLikedPostsVersion] = useState(0)
  const [isCheckingLikes, setIsCheckingLikes] = useState(false)

  const replaceLikedPostsMap = useCallback((nextMap: Map<string, boolean>) => {
    likedPostsMapRef.current = nextMap
    setLikedPostsVersion(prev => prev + 1)
  }, [])

  const clearLikedPostsMap = useCallback(() => {
    if (likedPostsMapRef.current.size === 0) return
    likedPostsMapRef.current = new Map()
    setLikedPostsVersion(prev => prev + 1)
  }, [])

  // Fetch posts using Lens React hook
  const { data: postsData, loading: fallbackLoading } = usePosts({
    filter: {
      apps: [evmAddress(LENS_APP_ADDRESS)],
      feeds: [{ globalFeed: true }], // ✅ Correctly using global feed
      metadata: {
        tags: { all: ['karaoke'] } // Only show karaoke content
      }
    },
  })

  // Memoize posts array to stabilize dependency
  const fallbackPosts = useMemo(() => {
    return (postsData?.items ?? []).filter((post): post is Post => 'metadata' in post)
  }, [postsData?.items])

  // For You feed ALWAYS uses global feed, not personalized timeline
  // Personalized timeline is only for the "Following" feed
  const activePosts = fallbackPosts
  const isActiveLoading = fallbackLoading

  // Debug logging (only in development with debug flag)
  if (import.meta.env.DEV && localStorage.getItem('debug')?.includes('feed')) {
    console.log('[ForYouFeed] State:', {
      isAuthenticated,
      postCount: activePosts.length,
    })
  }

  // Track post IDs to detect when posts actually change (not just reference)
  const previousPostIds = useRef<Set<string>>(new Set())
  const currentPostIds = useMemo(() => activePosts.map(post => post.id), [activePosts])

  const postsHaveChanged = useMemo(() => {
    const currentPostIdSet = new Set(currentPostIds)

    if (currentPostIdSet.size !== previousPostIds.current.size) {
      return true
    }

    for (const id of currentPostIdSet) {
      if (!previousPostIds.current.has(id)) {
        return true
      }
    }

    return false
  }, [currentPostIds])

  // Batch check liked status when authenticated and posts actually change
  useEffect(() => {
    if (!lensAccount?.address || !activePosts.length || !postsHaveChanged || !isAuthenticated) {
      if (!activePosts.length) {
        clearLikedPostsMap()
      }
      return
    }

    const checkLikedPosts = async () => {
      setIsCheckingLikes(true)
      try {
        const videoPosts = activePosts.filter(
          (post): post is Post => post.metadata?.__typename === 'VideoMetadata'
        )
        const likedMap = await batchCheckLikedPosts(lensSession, videoPosts, lensAccount.address)
        replaceLikedPostsMap(likedMap)

        // Update previous post IDs after successful check
        previousPostIds.current = new Set(currentPostIds)
      } catch (error) {
        console.error('[ForYouFeed] Error checking liked posts:', error)
      } finally {
        setIsCheckingLikes(false)
      }
    }

    checkLikedPosts()
  }, [activePosts, clearLikedPostsMap, currentPostIds, isAuthenticated, lensAccount?.address, lensSession, postsHaveChanged, replaceLikedPostsMap])

  // Transform Lens posts to VideoPostData using shared utility (memoized)
  const likedPostsSnapshot = useMemo(() => {
    void likedPostsVersion
    return likedPostsMapRef.current
  }, [likedPostsVersion])

  const videoPosts = useMemo(() => {
    return transformLensPostsToVideoData(activePosts, likedPostsSnapshot, isAuthenticated)
  }, [activePosts, likedPostsSnapshot, isAuthenticated])

  return <>{children(videoPosts, isActiveLoading || isCheckingLikes)}</>
}
