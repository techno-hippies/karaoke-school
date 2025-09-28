import React, { useState, useCallback } from 'react';
import { PostReactionType, postId } from "@lens-protocol/client";
import { addReaction, undoReaction } from "@lens-protocol/client/actions";
import { createLensSessionWithWallet, getLensSession } from '../lib/lens/sessionClient';
import { useAccount, useWalletClient } from 'wagmi';

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

export function useLensReactions({
  postId: postIdString,
  initialLikeCount = 0,
  userHasLiked = false
}: UseLensReactionsProps): UseLensReactionsReturn {
  const [isLiked, setIsLiked] = useState(userHasLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state when userHasLiked prop changes (e.g., after auth or feed refetch)
  React.useEffect(() => {
    setIsLiked(userHasLiked);
  }, [userHasLiked]);

  // Sync state when initialLikeCount prop changes
  React.useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount]);

  // Get wallet connection from RainbowKit/wagmi
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const sessionClient = getLensSession();

  // Allow liking if wallet is connected
  const canLike = isWalletConnected && !!walletAddress;


  const toggleLike = useCallback(async () => {
    if (!canLike) {
      // TODO: Show login modal or prompt
      return;
    }

    // Get or create session client
    let currentSessionClient = sessionClient;

    // Try regular wallet session if no existing session
    if (!currentSessionClient && walletClient && walletAddress) {

      currentSessionClient = await createLensSessionWithWallet(walletClient, walletAddress);
      if (!currentSessionClient) {
        console.error('[useLensReactions] Failed to create wallet Lens session');
        return;
      }
    }

    if (!currentSessionClient) {
      return;
    }

    if (isLoading) {
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
        result = await addReaction(currentSessionClient, {
          post: postIdValue,
          reaction: PostReactionType.Upvote
        });
      } else {
        // Remove upvote (unlike)
        result = await undoReaction(currentSessionClient, {
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
          console.error('[useLensReactions] 🔧 Account creation will be implemented in next phase');
        } else if (errorMessage.includes('Forbidden')) {
          console.error('[useLensReactions] ❌ Permission denied - check authentication role and account status');
        } else {
          console.error('[useLensReactions] ❌ Reaction failed with error:', errorMessage);
        }

        // Revert optimistic update on error
        setIsLiked(!newIsLiked);
        setLikeCount(likeCount);

        // TODO: Show error toast
        return;
      }


    } catch (error) {
      console.error('[useLensReactions] Reaction error:', error);

      // Revert optimistic update on error
      setIsLiked(!isLiked);
      setLikeCount(likeCount);

      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  }, [postIdString, isLiked, likeCount, isLoading, canLike, sessionClient, walletClient, walletAddress]);

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike,
    canLike
  };
}