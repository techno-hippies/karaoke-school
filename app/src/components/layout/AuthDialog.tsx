/**
 * AuthDialog
 * Multi-method authentication (Passkey, Wallet)
 * Ensures all users get a PKP (Lit Protocol Identity)
 * 
 * Note: This component is PURE UI. It does not use hooks like useAccount directly.
 * Data must be passed in via props.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, Wallet, Fingerprint, CaretLeft, Copy, GoogleLogo, DiscordLogo } from '@phosphor-icons/react'

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
  // Internal UI state to manage the multi-step flow over the context's simpler state
  const [view, setView] = useState<AuthStep>('select-method')
  const [username, setUsername] = useState('')
  const [pendingProvider, setPendingProvider] = useState<'passkey' | 'google' | 'discord' | null>(null)

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
            {view === 'select-method' && 'Welcome to K-School'}
            {view === 'passkey-intro' && 'Use Passkey'}
            {view === 'wallet-select' && 'Connect Wallet'}
            {view === 'username' && 'Choose Username'}
            {view === 'processing' && 'Authenticating'}
            {view === 'complete' && 'Success!'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* ERROR DISPLAY */}
          {displayError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 break-words">
              {displayError}
            </div>
          )}

          {/* STEP 1: METHOD SELECTION */}
          {view === 'select-method' && (
            <div className="space-y-3">
              <Button
                onClick={() => handleProviderSelect('passkey')}
                variant="outline"
                className="w-full h-14 justify-start px-4 text-base font-medium gap-3 hover:bg-slate-50"
              >
                <Fingerprint className="w-6 h-6 text-orange-500" />
                <div className="flex flex-col items-start">
                  <span>Passkey (Recommended)</span>
                  <span className="text-xs text-muted-foreground font-normal">No password, secure sign in</span>
                </div>
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or Social Login</span>
                </div>
              </div>

              <Button
                onClick={() => handleProviderSelect('google')}
                variant="outline"
                className="w-full h-12 justify-start px-4 text-base font-medium gap-3 hover:bg-slate-50"
              >
                <GoogleLogo className="w-6 h-6 text-red-500" weight="bold" />
                <span>Continue with Google</span>
              </Button>
              
              <Button
                onClick={() => handleProviderSelect('discord')}
                variant="outline"
                className="w-full h-12 justify-start px-4 text-base font-medium gap-3 hover:bg-slate-50"
              >
                <DiscordLogo className="w-6 h-6 text-indigo-500" weight="fill" />
                <span>Continue with Discord</span>
              </Button>
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
                Create New Account {pendingProvider && pendingProvider !== 'passkey' ? `with ${pendingProvider === 'google' ? 'Google' : 'Discord'}` : ''}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
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
                Sign In {pendingProvider && pendingProvider !== 'passkey' ? `with ${pendingProvider === 'google' ? 'Google' : 'Discord'}` : ''}
              </Button>

              <Button variant="ghost" size="sm" onClick={handleBack} className="w-full text-muted-foreground">
                <CaretLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          )}

          {/* STEP 2B: USERNAME INPUT */}
          {view === 'username' && (
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Username (e.g. alice_in_chains)"
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
                    <CheckCircle weight="fill" /> Format valid
                  </span>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={username.length < 6 || usernameAvailability === 'unavailable'}
                >
                  Continue
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
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                    {connector.icon ? (
                      <img src={connector.icon} alt="" className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  {connector.name}
                </Button>
              ))}

              {walletConnectors.length === 0 && (
                 <div className="text-center text-sm text-muted-foreground py-4">
                   No wallets detected. Please install MetaMask or Rabby.
                 </div>
              )}

              <Button variant="ghost" size="sm" onClick={handleBack} className="w-full mt-2">
                <CaretLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          )}

          {/* PROCESSING STATE */}
          {view === 'processing' && (
            <div className="flex flex-col items-center py-8 space-y-4 text-center">
              <Spinner className="w-10 h-10" />
              <p className="text-muted-foreground animate-pulse">
                {statusMessage || 'Processing...'}
              </p>
              {/* Show wallet address if connected during processing */}
              {isWalletConnected && walletAddress && (
                <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
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
                You are successfully authenticated!
              </p>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Start Learning
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
