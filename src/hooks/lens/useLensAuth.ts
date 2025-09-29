import { useAccount, useWalletClient } from 'wagmi';
import {
  useSessionClient,
  useLogin,
  useAuthenticatedUser,
  useAccountsAvailable
} from '@lens-protocol/react';
import { signMessageWith } from '@lens-protocol/client/viem';
import { useState, useEffect } from 'react';

// Lens app configuration
const LENS_TESTNET_APP = '0x9484206D9beA9830F27361a2F5868522a8B8Ad22';

/**
 * Simplified Lens authentication hook using only available React SDK hooks
 * Focuses on login with existing accounts, account creation handled separately
 */
export function useLensAuth() {
  // Get wallet connection from RainbowKit/wagmi
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Use Lens SDK's built-in session management (handles resumeSession automatically)
  const { data: sessionClient, loading: sessionLoading } = useSessionClient();

  // Get authenticated user information
  const { data: authenticatedUser, loading: userLoading } = useAuthenticatedUser();

  // Get available accounts for the current wallet
  const { data: availableAccounts, loading: accountsLoading } = useAccountsAvailable({
    managedBy: connectedWalletAddress,
    includeOwned: true,
  });

  // Use available Lens SDK hooks
  const { execute: login, loading: loginLoading } = useLogin();

  // Track authentication state
  const [authState, setAuthState] = useState<'idle' | 'checking' | 'needs-account' | 'ready'>('idle');

  // Check if user is authenticated and has proper permissions
  const isAuthenticated = !!sessionClient && !!authenticatedUser;
  const hasLensAccount = availableAccounts && availableAccounts.length > 0;
  const canPost = isAuthenticated && authenticatedUser?.role !== 'ONBOARDING_USER';

  // Auto-authenticate when wallet connects and we have available accounts
  useEffect(() => {
    if (!connectedWalletAddress || !walletClient || sessionLoading || userLoading || accountsLoading) {
      return;
    }

    // If already authenticated with posting permissions, nothing to do
    if (canPost) {
      setAuthState('ready');
      return;
    }

    // If we have a session but user is ONBOARDING_USER, we need to switch to account owner
    if (sessionClient && authenticatedUser?.role === 'ONBOARDING_USER' && hasLensAccount) {
      setAuthState('checking');
      const firstAccount = availableAccounts![0];

      // Re-login as AccountOwner to get posting permissions
      login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: firstAccount.account.address,
          owner: connectedWalletAddress,
        },
        signMessage: signMessageWith(walletClient),
      }).then((result) => {
        if (result.isSuccess()) {
          console.log('[useLensAuth] ✅ Switched to AccountOwner role');
          setAuthState('ready');
        } else {
          console.error('[useLensAuth] Failed to switch to AccountOwner:', result.error);
        }
      });
      return;
    }

    // If no session but has accounts, login as AccountOwner
    if (!sessionClient && hasLensAccount) {
      setAuthState('checking');
      const firstAccount = availableAccounts![0];

      login({
        accountOwner: {
          app: LENS_TESTNET_APP,
          account: firstAccount.account.address,
          owner: connectedWalletAddress,
        },
        signMessage: signMessageWith(walletClient),
      }).then((result) => {
        if (result.isSuccess()) {
          console.log('[useLensAuth] ✅ Logged in as AccountOwner');
          setAuthState('ready');
        } else {
          console.error('[useLensAuth] AccountOwner login failed:', result.error);
        }
      });
      return;
    }

    // If no accounts exist, user needs to create one
    if (!hasLensAccount && !sessionLoading) {
      setAuthState('needs-account');
    }
  }, [connectedWalletAddress, walletClient, authenticatedUser, availableAccounts, hasLensAccount, canPost, sessionLoading, userLoading, accountsLoading]);

  // Manual login function for explicit user action
  const handleLogin = async () => {
    if (!connectedWalletAddress || !walletClient) {
      console.warn('[useLensAuth] No wallet connected');
      return false;
    }

    try {
      setAuthState('checking');

      // Check if user has accounts
      if (hasLensAccount) {
        const firstAccount = availableAccounts![0];
        const result = await login({
          accountOwner: {
            app: LENS_TESTNET_APP,
            account: firstAccount.account.address,
            owner: connectedWalletAddress,
          },
          signMessage: signMessageWith(walletClient),
        });

        if (result.isFailure()) {
          console.error('[useLensAuth] AccountOwner login failed:', result.error);
          setAuthState('idle');
          return false;
        }

        setAuthState('ready');
        console.log('[useLensAuth] ✅ Login successful');
        return true;
      } else {
        // User needs to create an account - redirect to external flow
        console.log('[useLensAuth] No Lens account found, user needs to create one');
        setAuthState('needs-account');
        return false;
      }
    } catch (error) {
      console.error('[useLensAuth] Login error:', error);
      setAuthState('idle');
      return false;
    }
  };


  return {
    // Authentication state
    isAuthenticated,
    canPost,
    authState,
    sessionClient,
    authenticatedUser,
    hasLensAccount,

    // Wallet state
    connectedWalletAddress,
    isConnected,

    // Loading states
    sessionLoading,
    userLoading,
    loginLoading: loginLoading,
    isLoading: sessionLoading || userLoading || accountsLoading,

    // Actions
    handleLogin,

    // Display values (for compatibility with existing code)
    // Use Lens account address when available, fallback to wallet address
    displayAddress: authenticatedUser?.address || connectedWalletAddress,
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