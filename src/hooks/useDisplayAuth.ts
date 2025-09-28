import { useAccount, useWalletClient } from 'wagmi';
import { useEffect } from 'react';
import { createLensSessionWithWallet, isLensAuthenticated, resumeLensSession, getLensSession } from '../lib/lens/session';

/**
 * Shared hook for consistent authentication display logic
 * Used across VerticalFeed, ProfilePage, and other components
 */
export function useDisplayAuth() {
  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Try to resume existing session or create new one when wallet connects
  useEffect(() => {
    if (connectedWalletAddress && walletClient) {
      const sessionClient = getLensSession();
      const needsSession = !isLensAuthenticated() || !sessionClient?.account;

      if (needsSession) {
        console.log('[useDisplayAuth] 🔄 Wallet connected, checking for existing Lens session...', {
          isAuthenticated: isLensAuthenticated(),
          hasAccount: !!sessionClient?.account,
          needsSession
        });

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

  // Get connected address from wallet
  const connectedAddress = connectedWalletAddress;

  // Display username logic - show wallet address
  const displayAddress = connectedWalletAddress;

  // Show connected if wallet is connected
  const displayConnected = !!connectedWalletAddress;

  return {
    // Raw authentication state
    isAuthenticated: isConnected,
    hasInitialized: true,
    connectedWalletAddress,
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