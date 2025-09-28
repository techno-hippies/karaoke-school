import { useAccount, useWalletClient } from 'wagmi';
import { useSessionClient, useLogin, useAuthenticatedUser } from '@lens-protocol/react';
import { signMessageWith } from '@lens-protocol/client/viem';

// Lens app configuration
const LENS_TESTNET_APP = '0x9484206D9beA9830F27361a2F5868522a8B8Ad22';

/**
 * Proper Lens authentication hook using the official React SDK
 * This replaces the custom useDisplayAuth hook and eliminates double signatures
 */
export function useLensAuth() {
  // Get wallet connection from RainbowKit/wagmi
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Use Lens SDK's built-in session management (handles resumeSession automatically)
  const { data: sessionClient, loading: sessionLoading } = useSessionClient();

  // Get authenticated user information
  const { data: authenticatedUser, loading: userLoading } = useAuthenticatedUser();

  // Use Lens SDK's login hook
  const { execute: login, loading: loginLoading } = useLogin();

  // Check if user is authenticated
  const isAuthenticated = !!sessionClient && !!authenticatedUser;

  // Manual login function (only call when user explicitly wants to authenticate)
  const handleLogin = async () => {
    if (!connectedWalletAddress || !walletClient) {
      console.warn('[useLensAuth] No wallet connected');
      return false;
    }

    try {
      const result = await login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: connectedWalletAddress, // This will be replaced with actual Lens account if exists
          owner: connectedWalletAddress,
        },
        signMessage: signMessageWith(walletClient),
      });

      if (result.isFailure()) {
        console.error('[useLensAuth] Login failed:', result.error);
        return false;
      }

      console.log('[useLensAuth] ✅ Login successful');
      return true;
    } catch (error) {
      console.error('[useLensAuth] Login error:', error);
      return false;
    }
  };

  return {
    // Authentication state
    isAuthenticated,
    sessionClient,
    authenticatedUser,

    // Wallet state
    connectedWalletAddress,
    isConnected,

    // Loading states
    sessionLoading,
    userLoading,
    loginLoading,

    // Actions
    handleLogin,

    // Display values (for compatibility with existing code)
    displayAddress: connectedWalletAddress,
    displayConnected: isConnected,

    // Helper methods
    isOwnProfile: (profileIdentifier?: string) => {
      // Check against both wallet address and authenticated user address
      const userAddress = authenticatedUser?.address;
      const walletAddress = connectedWalletAddress;

      return (walletAddress && profileIdentifier &&
        walletAddress.toLowerCase() === profileIdentifier.toLowerCase()) ||
        (userAddress && profileIdentifier &&
        userAddress.toLowerCase() === profileIdentifier.toLowerCase());
    }
  };
}