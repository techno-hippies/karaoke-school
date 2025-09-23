import { useAccount } from 'wagmi';
import { useLitAuth } from '../providers/LitAuthProvider';

/**
 * Shared hook for consistent authentication display logic
 * Used across VerticalFeed, ProfilePage, and other components
 */
export function useDisplayAuth() {
  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();

  // Lit Protocol v8 auth
  const { isAuthenticated, pkpInfo, hasInitialized } = useLitAuth();

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