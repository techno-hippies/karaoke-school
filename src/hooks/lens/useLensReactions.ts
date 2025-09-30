import React, { useState, useCallback } from 'react';
import { PostReactionType, postId } from "@lens-protocol/client";
import { addReaction, undoReaction } from "@lens-protocol/client/actions";
import { useLensAuth } from './useLensAuth';

interface UseLensReactionsProps {
  postId: string;
  initialLikeCount?: number;
  userHasLiked?: boolean;
}

interface UseLensReactionsReturn {
  isLiked: boolean;
  likeCount: number;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
  canLike: boolean;
}

export function useLensReactions(
  postIdString: string,
  initialLikeCount: number = 0,
  userHasLiked: boolean = false,
  onRefreshFeed?: () => void
): UseLensReactionsReturn {
  const [isLiked, setIsLiked] = useState(userHasLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  // Use unified auth system
  const { sessionClient, canPost, isAuthenticated } = useLensAuth();

  // Allow liking if authenticated and can post
  const canLike = canPost && !!sessionClient;

  // Sync state when userHasLiked prop changes
  React.useEffect(() => {
    setIsLiked(userHasLiked);
  }, [userHasLiked]);

  // Sync state when initialLikeCount prop changes
  React.useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount]);

  const toggleLike = useCallback(async () => {
    if (!canLike || !sessionClient) {
      console.warn('[useLensReactions] Cannot like: not authenticated or no posting permissions');
      return;
    }

    if (isLoading) {
      console.warn('[useLensReactions] Already processing like action, ignoring double-click');
      return;
    }

    const postIdValue = postId(postIdString);
    setIsLoading(true);

    try {
      // Optimistic update
      const newIsLiked = !isLiked;
      const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;

      setIsLiked(newIsLiked);
      setLikeCount(newLikeCount);

      let result;

      if (newIsLiked) {
        // Add upvote (like)
        result = await addReaction(sessionClient, {
          post: postIdValue,
          reaction: PostReactionType.Upvote
        });
      } else {
        // Remove upvote (unlike)
        result = await undoReaction(sessionClient, {
          post: postIdValue,
          reaction: PostReactionType.Upvote
        });
      }

      if (result.isErr()) {
        console.error('[useLensReactions] Reaction failed:', result.error);

        // Check for specific authentication errors
        const errorMessage = result.error?.message || result.error?.toString() || 'Unknown error';
        if (errorMessage.includes('ONBOARDING_USER')) {
          console.error('[useLensReactions] ❌ Cannot add reaction: User authenticated as ONBOARDING_USER');
          console.error('[useLensReactions] 💡 Solution: User needs to create a Lens account first');
        } else if (errorMessage.includes('Forbidden')) {
          console.error('[useLensReactions] ❌ Permission denied - check authentication role and account status');
        } else {
          console.error('[useLensReactions] ❌ Reaction failed with error:', errorMessage);
        }

        // Revert optimistic update on error
        setIsLiked(!newIsLiked);
        setLikeCount(likeCount);
        return;
      }

      console.log('[useLensReactions] ✅ Reaction successful');

      // Refresh feed after successful action
      if (onRefreshFeed) {
        setTimeout(() => {
          onRefreshFeed();
        }, 1000); // Small delay to allow Lens to process the action
      }

    } catch (error) {
      console.error('[useLensReactions] Reaction error:', error);

      // Revert optimistic update on error
      setIsLiked(!isLiked);
      setLikeCount(likeCount);
    } finally {
      // Add a small delay to prevent rapid double-clicks
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  }, [postIdString, isLiked, likeCount, isLoading, canLike, sessionClient]);

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike,
    canLike
  };
}