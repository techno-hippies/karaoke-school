import React, { useState, useCallback } from 'react';
import { PostReactionType, postId } from "@lens-protocol/client";
import { addReaction, undoReaction } from "@lens-protocol/client/actions";
import { createLensSession, createLensSessionWithWallet, getLensSession, isLensAuthenticated, refreshLensSession } from '../lib/lens/sessionClient';
import { useLitAuth } from '../providers/LitAuthProvider';
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
    console.log(`[useLensReactions] ${postIdString.slice(-8)} - Updating isLiked state: ${isLiked} → ${userHasLiked}`);
    setIsLiked(userHasLiked);
  }, [userHasLiked, postIdString]);

  // Sync state when initialLikeCount prop changes
  React.useEffect(() => {
    console.log(`[useLensReactions] ${postIdString.slice(-8)} - Updating likeCount state: ${likeCount} → ${initialLikeCount}`);
    setLikeCount(initialLikeCount);
  }, [initialLikeCount, postIdString]);

  // Get PKP authentication from LitAuth provider
  const { isAuthenticated: isPkpAuthenticated, pkpViemAccount, pkpInfo } = useLitAuth();

  // Get wallet connection from RainbowKit/wagmi
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const sessionClient = getLensSession();

  // Allow liking if either PKP is authenticated OR wallet is connected
  const canLike = (isPkpAuthenticated && !!pkpInfo?.ethAddress) || (isWalletConnected && !!walletAddress);

  // Enhanced debug logging
  React.useEffect(() => {
    console.log('[useLensReactions] State:', {
      isPkpAuthenticated,
      pkpAddress: pkpInfo?.ethAddress,
      isWalletConnected,
      walletAddress,
      hasWalletClient: !!walletClient,
      canLike,
      hasSessionClient: !!sessionClient,
      postId: postIdString
    });
  }, [isPkpAuthenticated, pkpInfo?.ethAddress, isWalletConnected, walletAddress, walletClient, canLike, sessionClient, postIdString]);

  const toggleLike = useCallback(async () => {
    if (!canLike) {
      console.warn('[useLensReactions] Cannot like: No authentication (PKP or wallet)');
      console.warn('[useLensReactions] PKP authenticated:', isPkpAuthenticated);
      console.warn('[useLensReactions] Wallet connected:', isWalletConnected);
      // TODO: Show login modal or prompt
      return;
    }

    console.log('[useLensReactions] Starting like toggle process...');

    // Get or create session client
    let currentSessionClient = sessionClient;
    let authMethod = 'existing';

    // Try PKP session first (if available)
    if (!currentSessionClient && pkpViemAccount && pkpInfo?.ethAddress) {
      console.log('[useLensReactions] Creating new Lens session with PKP...');
      authMethod = 'PKP';
      const lensAccountAddress = pkpInfo?.lensAccountAddress;
      currentSessionClient = await createLensSession(pkpViemAccount, pkpInfo.ethAddress, lensAccountAddress);
      if (!currentSessionClient) {
        console.error('[useLensReactions] Failed to create PKP Lens session');
      }
    }

    // Try regular wallet session if PKP session failed or not available
    if (!currentSessionClient && walletClient && walletAddress) {
      console.log('[useLensReactions] Creating new Lens session with wallet (AccountOwner pattern)...');
      authMethod = 'wallet';

      // Only clear cached session if we're sure we need to re-authenticate
      // Don't clear on every attempt to avoid creating duplicate accounts

      currentSessionClient = await createLensSessionWithWallet(walletClient, walletAddress);
      if (!currentSessionClient) {
        console.error('[useLensReactions] Failed to create wallet Lens session');
        return;
      }
    }

    if (!currentSessionClient) {
      console.warn('[useLensReactions] No session client available');
      return;
    }

    console.log(`[useLensReactions] Using session client authenticated via: ${authMethod}`);

    if (isLoading) {
      console.log('[useLensReactions] Already processing like action');
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

      console.log(`[useLensReactions] Successfully ${newIsLiked ? 'liked' : 'unliked'} post ${postIdString}`);

    } catch (error) {
      console.error('[useLensReactions] Reaction error:', error);

      // Revert optimistic update on error
      setIsLiked(!isLiked);
      setLikeCount(likeCount);

      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  }, [postIdString, isLiked, likeCount, isLoading, canLike, sessionClient, pkpViemAccount, pkpInfo?.ethAddress, walletClient, walletAddress]);

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike,
    canLike
  };
}