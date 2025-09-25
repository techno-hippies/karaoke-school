import React from 'react'
import { useLitAuth } from '../../providers/LitAuthProvider'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '../ui/button'
import { Fingerprint, LogOut, Loader2, Shield, UserPlus } from 'lucide-react'

export const AuthButtons: React.FC = () => {
  const { 
    isAuthenticated, 
    isLoading, 
    error,
    authMethod,
    pkpInfo,
    signUpWithWebAuthn,
    authenticateWithWebAuthn,
    connectWallet,
    signOut 
  } = useLitAuth()
  
  const { address: walletAddress } = useAccount()

  const handleWebAuthnSignUp = async () => {
    await signUpWithWebAuthn()
  }

  const handleWebAuthnSignIn = async () => {
    await authenticateWithWebAuthn()
  }

  const handleWalletConnect = async () => {
    if (walletAddress) {
      await connectWallet()
    }
  }

  // Authenticated state
  if (isAuthenticated && pkpInfo) {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Successfully Authenticated</p>
              <p className="text-xs text-green-600 mt-1">
                Method: <span className="font-semibold">{authMethod?.type === 'webauthn' ? 'Device Authentication' : 'Wallet'}</span>
              </p>
              <p className="text-xs text-green-600 font-mono mt-2 truncate">
                PKP: {pkpInfo.ethAddress || pkpInfo.publicKey?.slice(0, 20) + '...'}
              </p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={signOut} 
          variant="outline"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    )
  }

  // Not authenticated state
  return (
    <div className="p-6 space-y-6">
      {/* New Users Section */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-neutral-700">New to Karaoke School?</div>
        
        <Button
          onClick={handleWebAuthnSignUp}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4 mr-2" />
          )}
          Create Account with Device
        </Button>
        
        <p className="text-xs text-neutral-500 text-center">
          Uses your device's biometric authentication (Face ID, Touch ID, or PIN)
        </p>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-neutral-500">or</span>
        </div>
      </div>

      {/* Existing Users Section */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-neutral-700">Already have an account?</div>
        
        <Button
          onClick={handleWebAuthnSignIn}
          disabled={isLoading}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Fingerprint className="w-4 h-4 mr-2" />
          )}
          Sign In with Device
        </Button>

        <ConnectButton.Custom>
          {({
            account,
            chain,
            openConnectModal,
            openAccountModal,
            authenticationStatus,
            mounted,
          }) => {
            // Show loading state if not mounted
            if (!mounted) {
              return (
                <Button disabled variant="outline" className="w-full" size="lg">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </Button>
              );
            }

            // Show connect button if no account connected
            if (!account) {
              return (
                <Button
                  onClick={openConnectModal}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Connect Wallet
                </Button>
              );
            }

            // Show sign in button if wallet connected but not authenticated with PKP
            return (
              <Button
                onClick={handleWalletConnect}
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Sign In with Wallet
              </Button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* Wallet status */}
      {walletAddress && !isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            Wallet connected: <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Click "Sign In with Wallet" to continue
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}