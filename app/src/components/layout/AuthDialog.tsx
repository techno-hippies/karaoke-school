/**
 * AuthDialog
 * Multi-method authentication (Passkey, Wallet)
 * Ensures all users get a PKP (Lit Protocol Identity)
 * 
 * Note: This component is PURE UI. It does not use hooks like useAccount directly.
 * Data must be passed in via props.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, Wallet, Fingerprint, CaretLeft, GoogleLogo, DiscordLogo, CaretDown, CaretUp, Warning } from '@phosphor-icons/react'

// Helper to extract a user-friendly message key from technical errors
function getErrorMessageKey(error: string): { key: string; hasTechnicalDetails: boolean } {
  // Check for common error patterns and provide friendly message keys
  if (error.includes('HTTP request failed') || error.includes('Failed to fetch')) {
    return { key: 'auth.errors.connectionFailed', hasTechnicalDetails: true }
  }
  if (error.includes('User rejected') || error.includes('user rejected')) {
    return { key: 'auth.errors.cancelled', hasTechnicalDetails: false }
  }
  if (error.includes('timeout') || error.includes('Timeout')) {
    return { key: 'auth.errors.timeout', hasTechnicalDetails: true }
  }
  if (error.includes('already registered') || error.includes('already exists')) {
    return { key: 'auth.errors.accountExists', hasTechnicalDetails: false }
  }
  if (error.includes('not found') || error.includes('No credential')) {
    return { key: 'auth.errors.accountNotFound', hasTechnicalDetails: false }
  }
  // For short, already-friendly messages, just return as-is (no i18n key)
  if (error.length < 100 && !error.includes('0x') && !error.includes('http')) {
    return { key: '', hasTechnicalDetails: false }
  }
  // Default: hide technical details
  return { key: 'auth.errors.generic', hasTechnicalDetails: true }
}

// ---------------- Types ----------------

export type AuthStep = 
  | 'select-method' // Initial choice
  | 'passkey-intro' // "Create" vs "Login" for WebAuthn
  | 'username'      // Username input (Passkey or Social)
  | 'wallet-select' // REMOVED - Wallet (Metamask, etc)
  | 'processing'    // Minting/Loading
  | 'funding'       // Check gas (for EOA)
  | 'complete'      // Done

type AuthMode = 'register' | 'login' | null

// Generic connector interface to avoid Wagmi dependency in View
export interface WalletConnector {
  uid: string
  name: string
  icon?: string
}

export interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  
  // Context state
  currentStep: string // Mapped to internal logic
  isAuthenticating: boolean
  statusMessage: string
  errorMessage: string
  usernameAvailability?: 'available' | 'unavailable' | null

  // Wallet State (Deprecated but kept for type compat if needed)
  walletConnectors?: WalletConnector[]
  isWalletConnected?: boolean
  walletAddress?: string
  walletError?: string

  // Actions
  onRegister: () => void
  onRegisterWithUsername: (username: string) => void
  onLogin: () => void
  onUsernameBack: () => void
  onUsernameChange: (username: string) => void
  
  // Social Actions
  onLoginGoogle?: (username?: string) => void
  onLoginDiscord?: (username?: string) => void
  
  // Wallet Actions
  onConnectWallet?: (connectorId: any) => void
  onWalletDisconnect?: () => void
}

export function AuthDialog({
  open,
  onOpenChange,
  currentStep: contextStep,
  isAuthenticating,
  statusMessage,
  errorMessage,
  usernameAvailability,
  
  walletConnectors = [],
  isWalletConnected = false,
  walletAddress,
  walletError,

  onRegister,
  onRegisterWithUsername,
  onLogin,
  onUsernameBack,
  onUsernameChange,
  
  onLoginGoogle,
  onLoginDiscord,
  
  onConnectWallet,
  onWalletDisconnect,
}: AuthDialogProps) {
  const { t } = useTranslation()

  // Internal UI state to manage the multi-step flow over the context's simpler state
  const [view, setView] = useState<AuthStep>('select-method')
  const [username, setUsername] = useState('')
  const [pendingProvider, setPendingProvider] = useState<'passkey' | 'google' | 'discord' | null>(null)
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  // Sync context step to view if needed
  useEffect(() => {
    if (contextStep === 'complete') setView('complete')
    if (contextStep === 'username') setView('username')
    // If context is working (webauthn), show processing
    if (contextStep === 'webauthn' || contextStep === 'session' || contextStep === 'social') {
      setView('processing')
    }
  }, [contextStep])

  // Handle authentication finishing (success or error)
  useEffect(() => {
    // If we were processing but are no longer authenticating
    if (view === 'processing' && !isAuthenticating) {
      if (contextStep === 'complete') {
        setView('complete')
      } else {
        // If we stopped authenticating and aren't complete, it likely failed.
        // Go back to selection so user can try again or see error.
        setView(pendingProvider ? 'passkey-intro' : 'select-method')
      }
    }
  }, [isAuthenticating, view, contextStep, pendingProvider])

  // Reset view when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setView('select-method')
        setUsername('')
        setPendingProvider(null)
        setShowErrorDetails(false)
        onWalletDisconnect?.()
      }, 300)
    }
  }, [open, onWalletDisconnect])

  // --- Handlers ---

  const handleProviderSelect = (provider: 'passkey' | 'google' | 'discord') => {
    setPendingProvider(provider)
    setView('passkey-intro')
  }

  const handleWalletSelect = () => {
    setView('wallet-select')
  }

  const handleBack = () => {
    if (view === 'passkey-intro' || view === 'wallet-select') {
      setView('select-method')
      setPendingProvider(null)
    } else if (view === 'username') {
      onUsernameBack() // Context handler
      setUsername('')
      setView('passkey-intro')
    }
  }

  const handleWalletConnect = (connector: any) => {
    onConnectWallet?.(connector)
    setView('processing')
  }

  // Handle username (Passkey flow)
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim().length >= 6) {
      const normalized = username.trim()
      setView('processing')
      if (pendingProvider === 'google') {
        onLoginGoogle?.(normalized)
      } else if (pendingProvider === 'discord') {
        onLoginDiscord?.(normalized)
      } else {
        onRegisterWithUsername(normalized)
      }
    }
  }

  // Combined error message
  const displayError = errorMessage || walletError

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            {view === 'passkey-intro' && t('auth.usePasskey')}
            {view === 'wallet-select' && t('auth.connectWallet')}
            {view === 'username' && t('auth.chooseUsername')}
            {view === 'processing' && t('auth.authenticating')}
            {view === 'complete' && t('auth.success')}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* ERROR DISPLAY */}
          {displayError && (() => {
            const { key, hasTechnicalDetails } = getErrorMessageKey(displayError)
            const friendlyMessage = key ? t(key) : displayError
            return (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <Warning className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
                  <div className="flex-1 min-w-0">
                    <p className="text-red-700">{friendlyMessage}</p>
                    {hasTechnicalDetails && (
                      <button
                        type="button"
                        onClick={() => setShowErrorDetails(!showErrorDetails)}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        {showErrorDetails ? (
                          <>
                            <CaretUp className="w-3 h-3" />
                            {t('auth.errors.hideDetails')}
                          </>
                        ) : (
                          <>
                            <CaretDown className="w-3 h-3" />
                            {t('auth.errors.showDetails')}
                          </>
                        )}
                      </button>
                    )}
                    {showErrorDetails && hasTechnicalDetails && (
                      <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-600 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                        {displayError}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* STEP 1: METHOD SELECTION */}
          {view === 'select-method' && (
            <div className="space-y-3">
              <Button
                onClick={() => handleProviderSelect('passkey')}
                variant="outline"
                className="w-full h-14 justify-start px-4 text-base font-medium gap-3"
              >
                <Fingerprint className="w-6 h-6 text-orange-500" />
                <div className="flex flex-col items-start">
                  <span>{t('auth.passkeyRecommended')}</span>
                  <span className="text-xs text-muted-foreground font-normal">{t('auth.noPasswordSecure')}</span>
                </div>
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('auth.orSocialLogin')}</span>
                </div>
              </div>

              <Button
                onClick={() => handleProviderSelect('google')}
                variant="outline"
                className="w-full h-12 justify-start px-4 text-base font-medium gap-3"
              >
                <GoogleLogo className="w-6 h-6 text-red-500" weight="bold" />
                <span>{t('auth.continueWithGoogle')}</span>
              </Button>

              <Button
                onClick={() => handleProviderSelect('discord')}
                variant="outline"
                className="w-full h-12 justify-start px-4 text-base font-medium gap-3"
              >
                <DiscordLogo className="w-6 h-6 text-indigo-500" weight="fill" />
                <span>{t('auth.continueWithDiscord')}</span>
              </Button>

              {onConnectWallet && (
                <>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">{t('auth.orConnectWallet')}</span>
                    </div>
                  </div>

                  <Button
                    onClick={onConnectWallet}
                    variant="outline"
                    className="w-full h-12 justify-start px-4 text-base font-medium gap-3"
                  >
                    <Wallet className="w-6 h-6 text-blue-500" weight="fill" />
                    <span>{t('auth.connectWallet')}</span>
                  </Button>
                </>
              )}
            </div>
          )}

          {/* STEP 2A: PASSKEY INTRO (Register/Login) */}
          {view === 'passkey-intro' && (
            <div className="space-y-4">
              <Button
                onClick={() => {
                    if (pendingProvider === 'google') {
                      // Social create -> go to username step
                      setView('username')
                    } else if (pendingProvider === 'discord') {
                      setView('username')
                    } else {
                      onRegister() // Passkey create triggers username step via context
                    }
                }}
                className="w-full h-12"
                size="lg"
              >
                {pendingProvider === 'google' ? t('auth.createWithGoogle') : pendingProvider === 'discord' ? t('auth.createWithDiscord') : t('auth.createNewAccount')}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
                </div>
              </div>

              <Button
                onClick={() => {
                    if (pendingProvider === 'google') {
                      setView('processing')
                      onLoginGoogle?.()
                    } else if (pendingProvider === 'discord') {
                      setView('processing')
                      onLoginDiscord?.()
                    } else {
                      onLogin() // Passkey login
                    }
                }}
                variant="outline"
                className="w-full h-12"
              >
                {pendingProvider === 'google' ? t('auth.signInWithGoogle') : pendingProvider === 'discord' ? t('auth.signInWithDiscord') : t('auth.signIn')}
              </Button>

              <Button variant="ghost" size="sm" onClick={handleBack} className="w-full text-muted-foreground">
                <CaretLeft className="mr-2 h-4 w-4" /> {t('common.back')}
              </Button>
            </div>
          )}

          {/* STEP 2B: USERNAME INPUT */}
          {view === 'username' && (
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder={t('auth.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    onUsernameChange(e.target.value)
                  }}
                  minLength={6}
                  className="h-12"
                  autoFocus
                />
                {usernameAvailability === 'available' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle weight="fill" /> {t('auth.formatValid')}
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  {t('common.back')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={username.length < 6 || usernameAvailability === 'unavailable'}
                >
                  {t('common.next')}
                </Button>
              </div>

            </form>
          )}

          {/* STEP 3: WALLET SELECTION */}
          {view === 'wallet-select' && (
            <div className="space-y-2">
              {walletConnectors.map((connector) => (
                <Button
                  key={connector.uid}
                  onClick={() => handleWalletConnect(connector)}
                  variant="outline"
                  className="w-full justify-start gap-3 h-12"
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    {connector.icon ? (
                      <img src={connector.icon} alt="" className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  {connector.name}
                </Button>
              ))}

              {walletConnectors.length === 0 && (
                 <div className="text-center text-sm text-muted-foreground py-4">
                   {t('auth.noWalletsDetected')}
                 </div>
              )}

              <Button variant="ghost" size="sm" onClick={handleBack} className="w-full mt-2">
                <CaretLeft className="mr-2 h-4 w-4" /> {t('common.back')}
              </Button>
            </div>
          )}

          {/* PROCESSING STATE */}
          {view === 'processing' && (
            <div className="flex flex-col items-center py-8 space-y-4 text-center">
              <Spinner className="w-10 h-10" />
              <p className="text-muted-foreground animate-pulse">
                {statusMessage || t('auth.processing')}
              </p>
              {/* Show wallet address if connected during processing */}
              {isWalletConnected && walletAddress && (
                <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                  {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}
                </div>
              )}
            </div>
          )}

          {/* COMPLETE STATE */}
          {view === 'complete' && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500" weight="fill" />
              <p className="text-center text-muted-foreground">
                {t('auth.successMessage')}
              </p>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                {t('auth.startLearning')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
