/**
 * Lens Reactions API
 * Handles adding/removing/fetching post reactions (likes)
 */

import { postId, PostReactionType } from '@lens-protocol/client'
import type { SessionClient, Post } from '@lens-protocol/client'
import { addReaction, undoReaction, fetchPostReactions } from '@lens-protocol/client/actions'

/**
 * Add an upvote (like) to a post
 */
export async function likePost(sessionClient: SessionClient, postIdValue: string): Promise<boolean> {
  try {
    const result = await addReaction(sessionClient, {
      post: postId(postIdValue),
      reaction: PostReactionType.Upvote,
    })

    if (result.isErr()) {
      console.error('[Reactions] Failed to like post:', result.error)
      return false
    }

    // Log failure reason if available
    if (result.value.__typename === 'AddReactionFailure') {
      console.error('[Reactions] Reaction failure:', (result.value as any).reason)
      return false
    }

    return result.value.__typename === 'AddReactionResponse' && result.value.success
  } catch (error) {
    console.error('[Reactions] Error liking post:', error)
    return false
  }
}

/**
 * Remove an upvote (unlike) from a post
 */
export async function unlikePost(sessionClient: SessionClient, postIdValue: string): Promise<boolean> {
  try {
    const result = await undoReaction(sessionClient, {
      post: postId(postIdValue),
      reaction: PostReactionType.Upvote,
    })

    if (result.isErr()) {
      console.error('[Reactions] Failed to unlike post:', result.error)
      return false
    }

    // Check if the result is successful
    return result.value.__typename === 'UndoReactionResponse' && result.value.success
  } catch (error) {
    console.error('[Reactions] Error unliking post:', error)
    return false
  }
}

/**
 * Check if current user has liked a post
 */
export async function hasLikedPost(
  sessionClient: SessionClient,
  postIdValue: string,
  accountAddress: string
): Promise<boolean> {
  try {
    const result = await fetchPostReactions(sessionClient, {
      post: postId(postIdValue),
      filter: { anyOf: [PostReactionType.Upvote] },
    })

    if (result.isErr()) {
      console.error('[Reactions] Failed to fetch reactions:', result.error)
      return false
    }

    // Check if current user is in the list of users who liked
    const currentUserReaction = result.value.items.find(
      (item) => item.account.address.toLowerCase() === accountAddress.toLowerCase()
    )

    return currentUserReaction?.reactions.some(r => r.reaction === PostReactionType.Upvote) ?? false
  } catch (error) {
    console.error('[Reactions] Error checking if user liked post:', error)
    return false
  }
}

/**
 * Batch check if current user has liked multiple posts
 * This is more efficient for feeds with many posts
 */
export async function batchCheckLikedPosts(
  sessionClient: SessionClient,
  posts: Post[],
  accountAddress: string
): Promise<Map<string, boolean>> {
  const likedMap = new Map<string, boolean>()

  // Process posts in parallel with limit to avoid rate limiting
  const BATCH_SIZE = 5
  const batches: Post[][] = []

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batches.push(posts.slice(i, i + BATCH_SIZE))
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (post) => {
        const isLiked = await hasLikedPost(sessionClient, post.id, accountAddress)
        likedMap.set(post.id, isLiked)
      })
    )
  }

  return likedMap
}
