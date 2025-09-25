import React from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '../ui/button'
import { LogOut, Shield } from 'lucide-react'

export const AuthButtons: React.FC = () => {
  const { address: walletAddress, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  // Authenticated state - show wallet is connected
  if (isConnected && walletAddress) {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Wallet Connected</p>
              <p className="text-xs text-green-600 font-mono mt-2 truncate">
                {walletAddress}
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => disconnect()}
          variant="outline"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      </div>
    )
  }

  // Not authenticated state - show wallet connect
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-medium text-neutral-700">Connect your wallet to continue</div>

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
                  Loading...
                </Button>
              );
            }

            // Show connect button if no account connected
            if (!account) {
              return (
                <Button
                  onClick={openConnectModal}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Connect Wallet
                </Button>
              );
            }

            // Show account info if connected
            return (
              <Button
                onClick={openAccountModal}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {account.displayName}
              </Button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </div>
  )
}