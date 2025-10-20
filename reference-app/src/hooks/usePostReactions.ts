/**
 * usePostReactions Hook
 * Manages post reactions (likes) state and actions
 */

import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { likePost, unlikePost } from '@/lib/lens/reactions'
import { toast } from 'sonner'

export interface UsePostReactionsResult {
  isLiked: boolean
  likeCount: number
  isLoading: boolean
  toggleLike: () => Promise<void>
  canLike: boolean
}

export interface UsePostReactionsOptions {
  postId: string
  initialIsLiked?: boolean
  initialLikeCount?: number
}

/**
 * Hook to manage post reactions
 * Handles optimistic updates and error recovery
 */
export function usePostReactions({
  postId,
  initialIsLiked = false,
  initialLikeCount = 0,
}: UsePostReactionsOptions): UsePostReactionsResult {
  const { lensSession } = useAuth()
  const [isLiked, setIsLiked] = useState(initialIsLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [isLoading, setIsLoading] = useState(false)

  const canLike = !!lensSession

  const toggleLike = useCallback(async () => {
    if (!lensSession || isLoading) return

    // Optimistic update
    const wasLiked = isLiked
    const prevCount = likeCount

    setIsLiked(!wasLiked)
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1)
    setIsLoading(true)

    try {
      let success: boolean

      if (wasLiked) {
        success = await unlikePost(lensSession, postId)
      } else {
        success = await likePost(lensSession, postId)
      }

      if (!success) {
        throw new Error('Failed to update reaction')
      }

      // Success! Optimistic update was correct
      console.log(`[usePostReactions] ${wasLiked ? 'Unliked' : 'Liked'} post ${postId}`)
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(wasLiked)
      setLikeCount(prevCount)

      console.error('[usePostReactions] Error toggling like:', error)
      toast.error(wasLiked ? 'Failed to unlike post' : 'Failed to like post')
    } finally {
      setIsLoading(false)
    }
  }, [lensSession, postId, isLiked, likeCount, isLoading])

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike,
    canLike,
  }
}
