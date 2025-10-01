import React, { useState, useCallback } from 'react';
import { evmAddress } from "@lens-protocol/client";
import { follow, unfollow } from "@lens-protocol/client/actions";
import { useLensAuth } from './useLensAuth';

interface UseLensFollowsReturn {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  isLoading: boolean;
  canFollow: boolean;
  toggleFollow: () => Promise<void>;
}

export function useLensFollows(profileAddress: string): UseLensFollowsReturn {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Use unified auth system
  const { sessionClient, canPost, isAuthenticated, connectedWalletAddress } = useLensAuth();

  // Allow following if authenticated, can post, and not following self
  const canFollow = canPost &&
                   !!sessionClient &&
                   !!profileAddress &&
                   profileAddress.toLowerCase() !== connectedWalletAddress?.toLowerCase();

  const toggleFollow = useCallback(async () => {
    if (!canFollow || !sessionClient || !profileAddress) {
      console.warn('[useLensFollows] Cannot follow: not authenticated, no posting permissions, or invalid profile');
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      // Optimistic update
      const newIsFollowing = !isFollowing;
      const newFollowerCount = newIsFollowing ? followerCount + 1 : followerCount - 1;

      setIsFollowing(newIsFollowing);
      setFollowerCount(newFollowerCount);

      let result;
      const targetAddress = evmAddress(profileAddress);

      if (newIsFollowing) {
        // Follow user
        result = await follow(sessionClient, {
          account: targetAddress
        });
      } else {
        // Unfollow user
        result = await unfollow(sessionClient, {
          account: targetAddress
        });
      }

      if (result.isErr()) {
        console.error('[useLensFollows] Follow/unfollow failed:', result.error);

        // Check for specific authentication errors
        const errorMessage = result.error?.message || result.error?.toString() || 'Unknown error';
        if (errorMessage.includes('ONBOARDING_USER')) {
          console.error('[useLensFollows] ❌ Cannot follow: User authenticated as ONBOARDING_USER');
          console.error('[useLensFollows] 💡 Solution: User needs to create a Lens account first');
        } else if (errorMessage.includes('Forbidden')) {
          console.error('[useLensFollows] ❌ Permission denied - check authentication role and account status');
        } else {
          console.error('[useLensFollows] ❌ Follow/unfollow failed with error:', errorMessage);
        }

        // Revert optimistic update on error
        setIsFollowing(!newIsFollowing);
        setFollowerCount(followerCount);
        return;
      }

      console.log(`[useLensFollows] ✅ ${newIsFollowing ? 'Follow' : 'Unfollow'} successful`);

    } catch (error) {
      console.error('[useLensFollows] Follow/unfollow error:', error);

      // Revert optimistic update on error
      setIsFollowing(!isFollowing);
      setFollowerCount(followerCount);
    } finally {
      setIsLoading(false);
    }
  }, [profileAddress, isFollowing, followerCount, isLoading, canFollow, sessionClient]);

  return {
    isFollowing,
    followerCount,
    followingCount,
    isLoading,
    canFollow,
    toggleFollow
  };
}