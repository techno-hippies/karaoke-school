import { useAccount, useWalletClient } from 'wagmi';
import { useEffect } from 'react';
import { createLensSessionWithWallet, isLensAuthenticated, resumeLensSession, getLensSession } from '../../lib/lens/session';

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
        // First check if we have stored credentials and if they match current wallet
        const storedCredentials = localStorage.getItem('lens.testnet.credentials');

        if (storedCredentials) {
          try {
            const credentials = JSON.parse(storedCredentials);
            const accessToken = credentials.data.accessToken;
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            const storedWalletAddress = payload.act?.sub; // This is the wallet that signed

            // If stored wallet doesn't match current wallet, clear the session
            if (storedWalletAddress && storedWalletAddress.toLowerCase() !== connectedWalletAddress.toLowerCase()) {
              console.log('[useDisplayAuth] 🧹 Wallet mismatch, clearing old session and creating new one');
              localStorage.removeItem('lens.testnet.credentials');
              // Directly create new session since wallet doesn't match
              createLensSessionWithWallet(walletClient, connectedWalletAddress)
                .then((session) => {
                  if (session) {
                    console.log('[useDisplayAuth] ✅ Created new Lens session for current wallet');
                    window.dispatchEvent(new CustomEvent('lens-session-created'));
                  }
                })
                .catch((error) => {
                  console.error('[useDisplayAuth] Error creating new wallet session:', error);
                });
              return;
            }
          } catch (error) {
            console.warn('[useDisplayAuth] Error parsing stored credentials, clearing:', error);
            localStorage.removeItem('lens.testnet.credentials');
          }
        }

        console.log('[useDisplayAuth] 🔄 Wallet connected, checking for existing Lens session...');

        // Try to resume existing session from localStorage
        resumeLensSession()
          .then((resumedSession) => {
            if (resumedSession) {
              console.log('[useDisplayAuth] ✅ Resumed existing Lens session from localStorage - no signing required!');
              // Trigger a refetch of the feed data since we now have authentication
              window.dispatchEvent(new CustomEvent('lens-session-created'));
              return resumedSession;
            } else {
              console.log('[useDisplayAuth] 🔄 No existing session found or invalid session cleared, creating new Lens session...');
              return createLensSessionWithWallet(walletClient, connectedWalletAddress);
            }
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