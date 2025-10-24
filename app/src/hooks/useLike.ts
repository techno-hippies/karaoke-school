/**
 * Like Hook
 * Manages liking/unliking posts on Lens
 */

import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { likePost, unlikePost } from '@/lib/lens/reactions'
import { postId } from '@lens-protocol/react'
import { lensClient } from '@/lib/lens/client'
import { fetchPost } from '@lens-protocol/client/actions'

interface UseLikeOptions {
  /**
   * Post ID to like/unlike
   */
  postId: string

  /**
   * Whether to automatically fetch like status on mount
   * @default true
   */
  enabled?: boolean
}

interface UseLikeReturn {
  /** Whether the current user has liked this post */
  isLiked: boolean

  /** Whether the current user can like this post */
  canLike: boolean

  /** Like the post */
  like: () => Promise<void>

  /** Unlike the post */
  unlike: () => Promise<void>

  /** Whether a like/unlike operation is in progress */
  isLoading: boolean

  /** Error from like/unlike operation */
  error: Error | null
}

/**
 * Hook for liking/unliking posts
 *
 * @example
 * ```tsx
 * const { isLiked, canLike, like, unlike, isLoading } = useLike({
 *   postId: '0x123-0x456'
 * })
 * ```
 */
export function useLike({
  postId: postIdValue,
}: UseLikeOptions): UseLikeReturn {
  const { lensSession, hasLensAccount } = useAuth()
  const queryClient = useQueryClient()
  const [localIsLiked, setLocalIsLiked] = useState(false)

  const hasValidPostId = !!(postIdValue && postIdValue.length > 0)

  // Fetch post with operations using Lens client directly
  const { data: postResult } = useQuery({
    queryKey: ['post', postIdValue, hasLensAccount],
    queryFn: async () => {
      if (!hasValidPostId) return null

      // Use session client when available for operations, otherwise use public client
      const client = lensSession || lensClient
      const result = await fetchPost(client as any, {
        post: postId(postIdValue),
      })

      if (result.isErr()) {
        console.error('[useLike] fetchPost error:', result.error)
        return null
      }

      return result.value
    },
    enabled: hasValidPostId,
    staleTime: 30000,
    // Refetch when hasLensAccount changes (when session becomes available)
  })

  const post = postResult

  // Extract like status from post operations
  // Note: operations field may not exist on all post types (e.g., Repost)
  const operations = post && 'operations' in post ? (post as any).operations : null
  const isLiked = operations?.hasUpvoted ?? localIsLiked
  // canLike: user is logged in, has valid post, and hasn't upvoted yet (can unlike if already liked)
  const canLike = !!(hasLensAccount && hasValidPostId)

  if (post?.stats) {
    console.log('[useLike] Stats:', {
      reactions: post.stats.reactions,
      upvotes: post.stats.upvotes,
      downvotes: post.stats.downvotes,
    })
  }

  // Update local state when server state changes
  useEffect(() => {
    if (operations?.hasUpvoted !== undefined) {
      setLocalIsLiked(operations.hasUpvoted)
    }
  }, [operations?.hasUpvoted])

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!lensSession) {
        throw new Error('Not authenticated')
      }

      console.log('[useLike] Calling likePost for:', postIdValue)
      const success = await likePost(lensSession as any, postIdValue)
      console.log('[useLike] likePost result:', success)

      if (!success) {
        throw new Error('Failed to like post')
      }
    },
    onMutate: async () => {
      // Optimistic update
      setLocalIsLiked(true)
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['post', postIdValue] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (error) => {
      // Rollback optimistic update
      setLocalIsLiked(false)
      console.error('[useLike] Like error:', error)
    },
  })

  // Unlike mutation
  const unlikeMutation = useMutation({
    mutationFn: async () => {
      if (!lensSession) {
        throw new Error('Not authenticated')
      }

      const success = await unlikePost(lensSession as any, postIdValue)

      if (!success) {
        throw new Error('Failed to unlike post')
      }
    },
    onMutate: async () => {
      // Optimistic update
      setLocalIsLiked(false)
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['post', postIdValue] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (error) => {
      // Rollback optimistic update
      setLocalIsLiked(true)
      console.error('[useLike] Unlike error:', error)
    },
  })

  const like = useCallback(async () => {
    if (!canLike) return
    await likeMutation.mutateAsync()
  }, [canLike, likeMutation])

  const unlike = useCallback(async () => {
    await unlikeMutation.mutateAsync()
  }, [unlikeMutation])

  return {
    isLiked,
    canLike,
    like,
    unlike,
    isLoading: likeMutation.isPending || unlikeMutation.isPending,
    error: likeMutation.error || unlikeMutation.error,
  }
}
