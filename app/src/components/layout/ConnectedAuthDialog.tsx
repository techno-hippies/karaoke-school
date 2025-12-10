/**
 * ConnectedAuthDialog
 *
 * Container component that wires AuthDialog to AuthContext.
 * Separates UI logic from business logic and keeps the AuthDialog pure.
 */

import { createSignal, createEffect, type Component } from 'solid-js'
import { AuthDialog } from './AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import {
  wagmiConfig,
  connect,
  getAccount,
  watchAccount,
  TARGET_CHAIN_ID,
  TARGET_CHAIN,
  switchToTargetChain,
} from '@/providers/Web3Provider'
import { injected } from '@wagmi/connectors'

export interface ConnectedAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ConnectedAuthDialog: Component<ConnectedAuthDialogProps> = (props) => {
  const auth = useAuth()

  const [walletChainId, setWalletChainId] = createSignal<number | null>(null)
  const [isSwitchingChain, setIsSwitchingChain] = createSignal(false)
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  // Watch for chain changes when wallet is connected
  createEffect(() => {
    if (props.open) {
      const account = getAccount(wagmiConfig)
      if (account.isConnected && account.chainId) {
        setWalletChainId(account.chainId)
      }

      // Subscribe to account/chain changes
      const unwatch = watchAccount(wagmiConfig, {
        onChange: (account) => {
          if (account.isConnected && account.chainId) {
            setWalletChainId(account.chainId)
          } else {
            setWalletChainId(null)
          }
        },
      })

      return () => unwatch()
    }
  })

  // Check if wallet is on wrong network
  const isWrongNetwork = () => {
    const chainId = walletChainId()
    return chainId !== null && chainId !== TARGET_CHAIN_ID
  }

  const scheduleClose = () => {
    if (closeTimer) {
      clearTimeout(closeTimer)
    }
    closeTimer = setTimeout(() => props.onOpenChange(false), 2000)
  }

  // Reset local state when dialog closes
  createEffect(() => {
    if (!props.open) {
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
      }
    }
  })

  const handleRegister = async () => {
    try {
      await auth.register()
      scheduleClose()
    } catch (error) {
      console.error('[ConnectedAuthDialog] Registration error:', error)
    }
  }

  const handleLogin = async () => {
    try {
      await auth.signIn()
      scheduleClose()
    } catch (error) {
      console.error('[ConnectedAuthDialog] Login error:', error)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await auth.loginWithGoogle()
      scheduleClose()
    } catch (error) {
      console.error('[ConnectedAuthDialog] Google login error:', error)
    }
  }

  const handleDiscordLogin = async () => {
    try {
      await auth.loginWithDiscord()
      scheduleClose()
    } catch (error) {
      console.error('[ConnectedAuthDialog] Discord login error:', error)
    }
  }

  const handleConnectWallet = async () => {
    console.log('[ConnectedAuthDialog] Connecting wallet via wagmi...')

    // Tell AuthContext we're expecting a wallet connection
    // This will set authMode to 'eoa' and authStep to 'processing'
    auth.expectWalletConnection()

    // Keep dialog open - it will show processing state
    // Don't close: props.onOpenChange(false)

    try {
      // Try injected wallet first (Metamask, Rabby, etc.)
      await connect(wagmiConfig, {
        connector: injected(),
      })
      console.log('[ConnectedAuthDialog] Wallet connected successfully')
      // watchAccount in AuthContext will detect connection and run EOA flow
    } catch (error) {
      console.error('[ConnectedAuthDialog] Wallet connection error:', error)
      // User rejected or no wallet - reset auth flow
      auth.resetAuthFlow()
    }
  }

  const handleSwitchNetwork = async () => {
    setIsSwitchingChain(true)
    try {
      const success = await switchToTargetChain()
      if (success) {
        console.log('[ConnectedAuthDialog] Switched to target chain')
        // Chain changed, watchAccount will update walletChainId
      }
    } catch (error) {
      console.error('[ConnectedAuthDialog] Failed to switch network:', error)
    } finally {
      setIsSwitchingChain(false)
    }
  }

  return (
    <AuthDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      currentStep={auth.authStep()}
      authMode={auth.authMode()}
      isAuthenticating={auth.isAuthenticating()}
      statusMessage={auth.authStatus()}
      errorMessage={auth.authError()?.message || ''}
      onRegister={handleRegister}
      onLogin={handleLogin}
      onLoginGoogle={handleGoogleLogin}
      onLoginDiscord={handleDiscordLogin}
      onConnectWallet={handleConnectWallet}
      // Network switching props
      isWrongNetwork={isWrongNetwork()}
      isSwitchingChain={isSwitchingChain()}
      targetChainName={TARGET_CHAIN.name}
      onSwitchNetwork={handleSwitchNetwork}
    />
  )
}
