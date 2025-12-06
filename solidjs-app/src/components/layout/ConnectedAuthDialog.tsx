/**
 * ConnectedAuthDialog
 *
 * Container component that wires AuthDialog to AuthContext.
 * Separates UI logic from business logic and keeps the AuthDialog pure.
 */

import { createSignal, createEffect, type Component } from 'solid-js'
import { AuthDialog } from './AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import { validateUsernameFormat } from '@/lib/lens/account-creation'
import { wagmiConfig, connect } from '@/providers/Web3Provider'
import { injected } from '@wagmi/connectors'

export interface ConnectedAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ConnectedAuthDialog: Component<ConnectedAuthDialogProps> = (props) => {
  const auth = useAuth()

  const [usernameAvailability, setUsernameAvailability] = createSignal<
    'available' | 'unavailable' | null
  >(null)
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleClose = () => {
    if (closeTimer) {
      clearTimeout(closeTimer)
    }
    closeTimer = setTimeout(() => props.onOpenChange(false), 2000)
  }

  // Reset local state when dialog closes
  createEffect(() => {
    if (!props.open) {
      setUsernameAvailability(null)
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
      }
    }
  })

  const handleRegisterClick = () => {
    auth.showUsernameInput()
    setUsernameAvailability(null)
  }

  const handleRegisterWithUsername = async (username: string) => {
    try {
      await auth.register(username)
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

  const handleSocialLogin = async (provider: 'google' | 'discord', username?: string) => {
    try {
      if (provider === 'google') {
        await auth.loginWithGoogle(username)
      } else {
        await auth.loginWithDiscord(username)
      }
      scheduleClose()
    } catch (error) {
      console.error(`[ConnectedAuthDialog] ${provider} login error:`, error)
    }
  }

  const handleUsernameBack = () => {
    auth.resetAuthFlow()
    setUsernameAvailability(null)
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

  const handleEoaRetry = async (username: string) => {
    try {
      await auth.retryEoaWithUsername(username)
      scheduleClose()
    } catch (error) {
      console.error('[ConnectedAuthDialog] EOA retry error:', error)
    }
  }

  const checkUsernameAvailability = (username: string) => {
    const formatError = validateUsernameFormat(username)
    setUsernameAvailability(formatError ? null : 'available')
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
      usernameAvailability={usernameAvailability()}
      onRegister={handleRegisterClick}
      onRegisterWithUsername={handleRegisterWithUsername}
      onLogin={handleLogin}
      onUsernameBack={handleUsernameBack}
      onUsernameChange={checkUsernameAvailability}
      onLoginGoogle={(username) => handleSocialLogin('google', username)}
      onLoginDiscord={(username) => handleSocialLogin('discord', username)}
      onRetryEoaWithUsername={handleEoaRetry}
      onConnectWallet={handleConnectWallet}
    />
  )
}
