import React, { useState } from 'react'
import { LitAuthModalView } from './LitAuthModalView'
import { useLitAuth } from '../../providers/LitAuthProvider'
import { useAccount, useConnect } from 'wagmi'

interface LitAuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export const LitAuthModal: React.FC<LitAuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'signup' | 'login'>('login') // Default to login since most users will be re-authenticating
  
  const { 
    isAuthenticated,
    isLoading, 
    error,
    signUpWithWebAuthn,
    authenticateWithWebAuthn,
    connectWallet,
    pkpViemAccount,
  } = useLitAuth()
  
  // Track previous auth state to detect changes
  const [prevAuthenticated, setPrevAuthenticated] = React.useState(isAuthenticated)
  const [prevPkpViemAccount, setPrevPkpViemAccount] = React.useState(pkpViemAccount)
  
  // Close modal when authentication succeeds or when we get a fresh PKP Viem account
  React.useEffect(() => {
    // Close if we just authenticated
    if (!prevAuthenticated && isAuthenticated) {
      onClose()
    }
    // Close if we just got a fresh PKP Viem account (for re-auth cases)
    if (!prevPkpViemAccount && pkpViemAccount) {
      console.log('[LitAuthModal] Got fresh PKP Viem account, closing modal')
      onClose()
    }
    setPrevAuthenticated(isAuthenticated)
    setPrevPkpViemAccount(pkpViemAccount)
  }, [isAuthenticated, prevAuthenticated, pkpViemAccount, prevPkpViemAccount, onClose])
  
  const { address: walletAddress } = useAccount()
  const { connect, connectors } = useConnect()

  const handleWalletConnect = async () => {
    if (!walletAddress) {
      const connector = connectors[0]
      if (connector) {
        connect({ connector })
      }
    } else {
      await connectWallet()
    }
  }

  const handleSwitchMode = () => {
    setMode(mode === 'signup' ? 'login' : 'signup')
  }

  return (
    <LitAuthModalView
      isOpen={isOpen}
      onClose={onClose}
      mode={mode}
      isLoading={isLoading}
      error={error}
      onSignUpWithDevice={signUpWithWebAuthn}
      onSignInWithDevice={authenticateWithWebAuthn}
      onConnectWallet={handleWalletConnect}
      onSwitchMode={handleSwitchMode}
    />
  )
}