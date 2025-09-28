import React, { useState, useCallback } from 'react';
import { evmAddress } from "@lens-protocol/client";
import { follow, unfollow, fetchAccount } from "@lens-protocol/client/actions";
import { createLensSessionWithWallet, getLensSession } from '../lib/lens/session';
// import { lensClient } from '../lib/lens/client';
import { useAccount, useWalletClient } from 'wagmi';

interface UseLensFollowsProps {
  targetAccountAddress?: string; // Lens account address (0x...)
  initialFollowState?: boolean;
}

interface UseLensFollowsReturn {
  isFollowing: boolean;
  isLoading: boolean;
  canFollow: boolean;
  toggleFollow: () => Promise<boolean>;
}

export function useLensFollows({
  targetAccountAddress,
  initialFollowState = false
}: UseLensFollowsProps): UseLensFollowsReturn {
  const [isFollowing, setIsFollowing] = useState(initialFollowState);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state when initialFollowState prop changes
  React.useEffect(() => {
    setIsFollowing(initialFollowState);
  }, [initialFollowState, targetAccountAddress, isFollowing]);

  // Get wallet connection from RainbowKit/wagmi
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const sessionClient = getLensSession();

  // Allow following if wallet is connected AND we have a valid target address
  const canFollow = isWalletConnected && !!walletAddress && !!targetAccountAddress;


  // Fetch initial follow status when component mounts
  React.useEffect(() => {
    if (!targetAccountAddress || !canFollow || !sessionClient) {
      return;
    }

    const checkFollowStatus = async () => {
      try {
        // Must use sessionClient for isFollowedByMe to work
        const accountResult = await fetchAccount(sessionClient, {
          address: evmAddress(targetAccountAddress)
        });

        if (accountResult.isErr()) {
          console.error('[useLensFollows] Failed to fetch account:', accountResult.error);
          return;
        }

        const account = accountResult.value;

        // Check if we're following this account - requires authenticated client
        const isFollowedByMe = account.operations?.isFollowedByMe === true;

        setIsFollowing(isFollowedByMe);
      } catch (error) {
        console.error('[useLensFollows] Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [targetAccountAddress, canFollow, sessionClient]);

  const toggleFollow = useCallback(async (): Promise<boolean> => {
    if (!canFollow) {
      return false;
    }

    if (!targetAccountAddress) {
      return false;
    }

    // Get or create session client
    let currentSessionClient = sessionClient;

    // Try regular wallet session if no existing session
    if (!currentSessionClient && walletClient && walletAddress) {

      currentSessionClient = await createLensSessionWithWallet(walletClient, walletAddress);
      if (!currentSessionClient) {
        console.error('[useLensFollows] Failed to create wallet Lens session');
        return false;
      }
    }

    if (!currentSessionClient) {
      return false;
    }

    if (isLoading) {
      return false;
    }

    setIsLoading(true);

    try {
      // Optimistic update
      const newIsFollowing = !isFollowing;
      setIsFollowing(newIsFollowing);

      let result;
      const targetAddress = evmAddress(targetAccountAddress);

      if (newIsFollowing) {
        // Follow user
        result = await follow(currentSessionClient, {
          account: targetAddress
        });
      } else {
        // Unfollow user
        result = await unfollow(currentSessionClient, {
          account: targetAddress
        });
      }

      if (result.isErr()) {
        console.error('[useLensFollows] Follow operation failed:', result.error);

        // Check for specific authentication errors
        const errorMessage = result.error?.message || result.error?.toString() || 'Unknown error';
        if (errorMessage.includes('ONBOARDING_USER')) {
          console.error('[useLensFollows] ❌ Cannot follow: User authenticated as ONBOARDING_USER');
          console.error('[useLensFollows] 💡 Solution: User needs to create a Lens account first');
        } else if (errorMessage.includes('Forbidden')) {
          console.error('[useLensFollows] ❌ Permission denied - check authentication role and account status');
        } else {
          console.error('[useLensFollows] ❌ Follow operation failed with error:', errorMessage);
        }

        // Revert optimistic update on error
        setIsFollowing(!newIsFollowing);
        return false;
      }

      return true;

    } catch (error) {
      console.error('[useLensFollows] Follow error:', error);

      // Revert optimistic update on error
      setIsFollowing(!isFollowing);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [targetAccountAddress, isFollowing, isLoading, canFollow, sessionClient, walletClient, walletAddress]);

  return {
    isFollowing,
    isLoading,
    canFollow,
    toggleFollow
  };
}