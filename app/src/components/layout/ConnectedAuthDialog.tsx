import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { AuthDialog } from './AuthDialog'
import { useAuth } from '@/contexts/AuthContext'
import { validateUsernameFormat } from '@/lib/lens/account-creation'

interface ConnectedAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * ConnectedAuthDialog
 * Container component that wires AuthDialog to AuthContext.
 * Keeps routing components free of auth orchestration logic.
 */
export function ConnectedAuthDialog({ open, onOpenChange }: ConnectedAuthDialogProps) {
  const {
    isAuthenticating,
    authStep,
    authStatus,
    authError,
    register,
    signIn,
    showUsernameInput,
    resetAuthFlow,
    loginWithGoogle,
    loginWithDiscord,
  } = useAuth()

  const { openConnectModal } = useConnectModal()

  const [usernameAvailability, setUsernameAvailability] =
    useState<'available' | 'unavailable' | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => onOpenChange(false), 2000)
  }, [onOpenChange])

  const handleRegisterClick = useCallback(() => {
    showUsernameInput()
    setUsernameAvailability(null)
  }, [showUsernameInput])

  const handleRegisterWithUsername = useCallback(
    async (username: string) => {
      try {
        await register(username)
        scheduleClose()
      } catch (error) {
        console.error('[ConnectedAuthDialog] Registration error:', error)
      }
    },
    [register, scheduleClose]
  )

  const handleLogin = useCallback(async () => {
    try {
      await signIn()
      scheduleClose()
    } catch (error) {
      console.error('[ConnectedAuthDialog] Login error:', error)
    }
  }, [signIn, scheduleClose])

  const handleSocialLogin = useCallback(
    async (provider: 'google' | 'discord', username?: string) => {
      try {
        if (provider === 'google') {
          await loginWithGoogle(username)
        } else {
          await loginWithDiscord(username)
        }
        scheduleClose()
      } catch (error) {
        console.error(`[ConnectedAuthDialog] ${provider} login error:`, error)
      }
    },
    [loginWithDiscord, loginWithGoogle, scheduleClose]
  )

  const handleUsernameBack = useCallback(() => {
    resetAuthFlow()
    setUsernameAvailability(null)
  }, [resetAuthFlow])

  const handleConnectWallet = useCallback(() => {
    // Close AuthDialog and open RainbowKit modal
    onOpenChange(false)
    // Small delay to let the dialog close before opening RainbowKit
    setTimeout(() => {
      openConnectModal?.()
    }, 100)
  }, [onOpenChange, openConnectModal])

  const checkUsernameAvailability = useCallback((username: string) => {
    const formatError = validateUsernameFormat(username)
    setUsernameAvailability(formatError ? null : 'available')
  }, [])

  // Reset local state and close timers when dialog closes
  useEffect(() => {
    if (!open) {
      setUsernameAvailability(null)
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open])

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    },
    []
  )

  return (
    <AuthDialog
      open={open}
      onOpenChange={onOpenChange}
      currentStep={authStep}
      isAuthenticating={isAuthenticating}
      statusMessage={authStatus}
      errorMessage={authError?.message || ''}
      usernameAvailability={usernameAvailability}
      onRegister={handleRegisterClick}
      onRegisterWithUsername={handleRegisterWithUsername}
      onLogin={handleLogin}
      onUsernameBack={handleUsernameBack}
      onUsernameChange={checkUsernameAvailability}
      onLoginGoogle={(username) => handleSocialLogin('google', username)}
      onLoginDiscord={(username) => handleSocialLogin('discord', username)}
      onConnectWallet={handleConnectWallet}
    />
  )
}
