import { useAccount, useWalletClient } from 'wagmi';
import { useLitAuth } from '../providers/LitAuthProvider';
import { useEffect } from 'react';
import { createLensSessionWithWallet, isLensAuthenticated, resumeLensSession } from '../lib/lens/sessionClient';

/**
 * Shared hook for consistent authentication display logic
 * Used across VerticalFeed, ProfilePage, and other components
 */
export function useDisplayAuth() {
  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Lit Protocol v8 auth
  const { isAuthenticated, pkpInfo, hasInitialized } = useLitAuth();

  // Try to resume existing session or create new one when wallet connects
  useEffect(() => {
    if (connectedWalletAddress && walletClient) {
      if (!isLensAuthenticated()) {
        console.log('[useDisplayAuth] 🔄 Wallet connected, checking for existing Lens session...');

        // First try to resume existing session from localStorage
        resumeLensSession()
          .then((resumedSession) => {
            if (resumedSession) {
              console.log('[useDisplayAuth] ✅ Resumed existing Lens session from localStorage - no signing required!');
              // Trigger a refetch of the feed data since we now have authentication
              window.dispatchEvent(new CustomEvent('lens-session-created'));
            } else {
              console.log('[useDisplayAuth] 🔄 No existing session found, creating new Lens session...');
              return createLensSessionWithWallet(walletClient, connectedWalletAddress);
            }
            return resumedSession;
          })
          .then((session) => {
            if (session && session !== 'resumed') { // Check if this is the createSession result
              console.log('[useDisplayAuth] ✅ Created new Lens session');
              // Trigger a refetch of the feed data since we now have authentication
              window.dispatchEvent(new CustomEvent('lens-session-created'));
            } else if (!session) {
              console.log('[useDisplayAuth] ❌ Failed to create/resume Lens session');
            }
          })
          .catch((error) => {
            console.error('[useDisplayAuth] Error with Lens session:', error);
          });
      } else {
        console.log('[useDisplayAuth] ✅ Already authenticated with Lens');
      }
    }
  }, [connectedWalletAddress, walletClient]);

  // Get connected address from either PKP Viem account, PKP info, or wallet
  const connectedAddress = pkpInfo?.ethAddress || connectedWalletAddress;

  // Display username logic - show wallet address or PKP status
  const displayAddress = connectedWalletAddress || pkpInfo?.ethAddress ||
    (pkpInfo?.pkpPublicKey ? 'PKP Connected' : undefined);

  // Show connected if either wallet or PKP is connected
  const displayConnected = !!connectedWalletAddress || isAuthenticated;

  return {
    // Raw authentication state
    isAuthenticated,
    hasInitialized,
    connectedWalletAddress,
    pkpInfo,
    isConnected,

    // Computed display values
    connectedAddress,
    displayAddress,
    displayConnected,

    // Helper methods
    isOwnProfile: (profileIdentifier?: string) => {
      return connectedAddress && profileIdentifier &&
        connectedAddress.toLowerCase() === profileIdentifier.toLowerCase();
    }
  };
}