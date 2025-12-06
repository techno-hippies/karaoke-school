/**
 * AuthDialog for SolidJS
 *
 * Multi-method authentication dialog supporting:
 * - Passkey (WebAuthn) - recommended
 * - Google OAuth (stub - not yet implemented)
 * - Discord OAuth (stub - not yet implemented)
 * - External wallet (Metamask, Rabby, etc.)
 *
 * This is a pure UI component. Data flows through props from ConnectedAuthDialog.
 */

import { createSignal, createEffect, Show, Switch, Match, type Component } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Icon } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'

export type AuthStep =
  | 'select-method'  // Initial method selection
  | 'passkey-intro'  // Create vs Sign In choice
  | 'username'       // Username input
  | 'processing'     // Loading state
  | 'complete'       // Success

export type AuthProvider = 'passkey' | 'google' | 'discord' | 'wallet' | null

export interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  // Context state
  currentStep: string
  authMode?: 'register' | 'login' | 'eoa' | 'google' | 'discord' | null
  isAuthenticating: boolean
  statusMessage: string
  errorMessage: string
  usernameAvailability?: 'available' | 'unavailable' | null

  // Wallet state (for EOA flow display)
  isWalletConnected?: boolean
  walletAddress?: string

  // Actions
  onRegister: () => void
  onRegisterWithUsername: (username: string) => void
  onLogin: () => void
  onUsernameBack: () => void
  onUsernameChange?: (username: string) => void

  // Social Actions
  onLoginGoogle?: (username?: string) => void
  onLoginDiscord?: (username?: string) => void

  // EOA Actions
  onRetryEoaWithUsername?: (username: string) => void

  // Wallet Actions
  onConnectWallet?: () => void
  onWalletDisconnect?: () => void
}

/**
 * Get user-friendly error message key from technical error
 */
function getErrorInfo(error: string): { message: string; hasTechnicalDetails: boolean } {
  if (error.includes('HTTP request failed') || error.includes('Failed to fetch')) {
    return { message: 'Connection failed. Please check your internet and try again.', hasTechnicalDetails: true }
  }
  if (error.includes('User rejected') || error.includes('user rejected')) {
    return { message: 'Authentication cancelled.', hasTechnicalDetails: false }
  }
  if (error.includes('timeout') || error.includes('Timeout')) {
    return { message: 'Request timed out. Please try again.', hasTechnicalDetails: true }
  }
  if (error.includes('already registered') || error.includes('already exists')) {
    return { message: 'Account already exists. Try signing in instead.', hasTechnicalDetails: false }
  }
  if (error.includes('not found') || error.includes('No credential')) {
    return { message: 'Account not found. Try creating a new account.', hasTechnicalDetails: false }
  }
  if (error.includes('not yet implemented') || error.includes('not implemented')) {
    return { message: error, hasTechnicalDetails: false }
  }
  // Short user-friendly messages pass through
  if (error.length < 100 && !error.includes('0x') && !error.includes('http')) {
    return { message: error, hasTechnicalDetails: false }
  }
  // Default: hide technical details
  return { message: 'Something went wrong. Please try again.', hasTechnicalDetails: true }
}

export const AuthDialog: Component<AuthDialogProps> = (props) => {
  const { t } = useTranslation()
  const [view, setView] = createSignal<AuthStep>('select-method')
  const [username, setUsername] = createSignal('')
  const [pendingProvider, setPendingProvider] = createSignal<AuthProvider>(null)
  const [showErrorDetails, setShowErrorDetails] = createSignal(false)

  // Sync context step to view
  createEffect(() => {
    if (props.currentStep === 'complete') {
      setView('complete')
    }
    if (props.currentStep === 'username') {
      setView('username')
    }
    if (
      props.currentStep === 'webauthn' ||
      props.currentStep === 'session' ||
      props.currentStep === 'social' ||
      props.currentStep === 'processing'
    ) {
      setView('processing')
    }
  })

  // Handle authentication finishing
  createEffect(() => {
    if (view() === 'processing' && !props.isAuthenticating) {
      if (props.currentStep === 'complete') {
        setView('complete')
      } else if (props.currentStep === 'username') {
        setView('username')
      } else if (props.errorMessage) {
        // Go back to method selection on error
        setView(pendingProvider() ? 'passkey-intro' : 'select-method')
      }
    }
  })

  // Reset view when dialog closes
  createEffect(() => {
    if (!props.open) {
      setTimeout(() => {
        setView('select-method')
        setUsername('')
        setPendingProvider(null)
        setShowErrorDetails(false)
        props.onWalletDisconnect?.()
      }, 300)
    }
  })

  const handleProviderSelect = (provider: AuthProvider) => {
    setPendingProvider(provider)
    if (provider === 'wallet') {
      // External wallet - trigger wallet connection flow
      props.onConnectWallet?.()
    } else {
      setView('passkey-intro')
    }
  }

  const handleBack = () => {
    if (view() === 'passkey-intro') {
      setView('select-method')
      setPendingProvider(null)
    } else if (view() === 'username') {
      props.onUsernameBack()
      setUsername('')
      setView('passkey-intro')
    }
  }

  const handleUsernameSubmit = (e: Event) => {
    e.preventDefault()
    if (username().trim().length >= 6) {
      const normalized = username().trim()
      setView('processing')

      // Route to appropriate handler based on auth mode
      if (props.authMode === 'eoa') {
        props.onRetryEoaWithUsername?.(normalized)
      } else if (pendingProvider() === 'google') {
        props.onLoginGoogle?.(normalized)
      } else if (pendingProvider() === 'discord') {
        props.onLoginDiscord?.(normalized)
      } else {
        props.onRegisterWithUsername(normalized)
      }
    }
  }

  const handleUsernameInput = (value: string) => {
    setUsername(value)
    props.onUsernameChange?.(value)
  }

  const getTitle = () => {
    switch (view()) {
      case 'passkey-intro':
        return pendingProvider() === 'google'
          ? t('auth.continueWithGoogle')
          : pendingProvider() === 'discord'
            ? t('auth.continueWithDiscord')
            : t('auth.usePasskey')
      case 'username':
        return t('auth.chooseUsername')
      case 'processing':
        return t('auth.authenticating')
      case 'complete':
        return t('auth.success')
      default:
        return t('auth.signIn')
    }
  }

  const getCreateButtonText = () => {
    if (pendingProvider() === 'google') return t('auth.createWithGoogle')
    if (pendingProvider() === 'discord') return t('auth.createWithDiscord')
    return t('auth.createNewAccount')
  }

  const getSignInButtonText = () => {
    if (pendingProvider() === 'google') return t('auth.signInWithGoogle')
    if (pendingProvider() === 'discord') return t('auth.signInWithDiscord')
    return t('auth.signIn')
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle class="text-2xl text-center">{getTitle()}</DialogTitle>
        </DialogHeader>

        <div class="py-4">
          {/* ERROR DISPLAY */}
          <Show when={props.errorMessage}>
            {(error) => {
              const info = getErrorInfo(error())
              return (
                <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                  <div class="flex items-start gap-2">
                    <Icon name="warning-circle" class="text-xl text-red-500 flex-shrink-0 mt-0.5" />
                    <div class="flex-1 min-w-0">
                      <p class="text-red-700">{info.message}</p>
                      <Show when={info.hasTechnicalDetails}>
                        <button
                          type="button"
                          onClick={() => setShowErrorDetails(!showErrorDetails())}
                          class="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Show when={showErrorDetails()} fallback={<><Icon name="caret-down" class="text-sm" />{t('auth.showDetails')}</>}>
                            <Icon name="caret-up" class="text-sm" />{t('auth.hideDetails')}
                          </Show>
                        </button>
                        <Show when={showErrorDetails()}>
                          <pre class="mt-2 p-2 bg-red-100 rounded text-xs text-red-600 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {error()}
                          </pre>
                        </Show>
                      </Show>
                    </div>
                  </div>
                </div>
              )
            }}
          </Show>

          <Switch>
            {/* STEP 1: METHOD SELECTION */}
            <Match when={view() === 'select-method'}>
              <div class="space-y-3">
                {/* Passkey (Recommended) */}
                <Button
                  onClick={() => handleProviderSelect('passkey')}
                  variant="outline"
                  class="w-full h-14 justify-start px-4 text-base font-medium gap-3"
                >
                  <Icon name="key" class="text-2xl text-orange-500" />
                  <div class="flex flex-col items-start">
                    <span>{t('auth.passkeyRecommended')}</span>
                    <span class="text-xs text-muted-foreground font-normal">
                      {t('auth.noPasswordSecure')}
                    </span>
                  </div>
                </Button>

                {/* Social login divider */}
                <div class="relative py-2">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-border" />
                  </div>
                  <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-background px-2 text-muted-foreground">
                      {t('auth.orSocialLogin')}
                    </span>
                  </div>
                </div>

                {/* Google */}
                <Button
                  onClick={() => handleProviderSelect('google')}
                  variant="outline"
                  class="w-full h-12 justify-start px-4 text-base font-medium gap-3"
                >
                  <Icon name="google-logo" class="text-2xl text-red-500" />
                  <span>{t('auth.continueWithGoogle')}</span>
                </Button>

                {/* Discord */}
                <Button
                  onClick={() => handleProviderSelect('discord')}
                  variant="outline"
                  class="w-full h-12 justify-start px-4 text-base font-medium gap-3"
                >
                  <Icon name="discord-logo" class="text-2xl text-indigo-500" />
                  <span>{t('auth.continueWithDiscord')}</span>
                </Button>

                {/* Wallet connection */}
                <Show when={props.onConnectWallet}>
                  <>
                    <div class="relative py-2">
                      <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-border" />
                      </div>
                      <div class="relative flex justify-center text-xs uppercase">
                        <span class="bg-background px-2 text-muted-foreground">
                          {t('auth.orConnectWallet')}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleProviderSelect('wallet')}
                      variant="outline"
                      class="w-full h-12 justify-start px-4 text-base font-medium gap-3"
                    >
                      <Icon name="wallet" class="text-2xl text-blue-500" />
                      <span>{t('auth.connectWallet')}</span>
                    </Button>
                  </>
                </Show>
              </div>
            </Match>

            {/* STEP 2A: CREATE / SIGN IN CHOICE */}
            <Match when={view() === 'passkey-intro'}>
              <div class="space-y-4">
                <Button
                  onClick={() => {
                    if (pendingProvider() === 'google' || pendingProvider() === 'discord') {
                      // Social create -> go to username step
                      setView('username')
                    } else {
                      // Passkey create -> triggers username step via context
                      props.onRegister()
                    }
                  }}
                  class="w-full h-12"
                  size="lg"
                >
                  {getCreateButtonText()}
                </Button>

                <div class="relative">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-border" />
                  </div>
                  <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (pendingProvider() === 'google') {
                      setView('processing')
                      props.onLoginGoogle?.()
                    } else if (pendingProvider() === 'discord') {
                      setView('processing')
                      props.onLoginDiscord?.()
                    } else {
                      props.onLogin()
                    }
                  }}
                  variant="outline"
                  class="w-full h-12"
                >
                  {getSignInButtonText()}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  class="w-full text-muted-foreground"
                >
                  <Icon name="caret-left" class="mr-2 text-base" /> {t('auth.back')}
                </Button>
              </div>
            </Match>

            {/* STEP 2B: USERNAME INPUT */}
            <Match when={view() === 'username'}>
              <form onSubmit={handleUsernameSubmit} class="space-y-4">
                <div class="space-y-2">
                  <Input
                    placeholder={t('auth.usernamePlaceholder')}
                    value={username()}
                    onInput={(e) => handleUsernameInput(e.currentTarget.value)}
                    minLength={6}
                    class="h-12"
                    autofocus
                  />
                  <Show when={username().length >= 6}>
                    <span class="text-xs text-green-600 flex items-center gap-1">
                      <Icon name="check-circle" class="text-base" /> {t('auth.validFormat')}
                    </span>
                  </Show>
                </div>

                <div class="flex gap-3">
                  <Button type="button" variant="outline" onClick={handleBack} class="flex-1">
                    {t('auth.back')}
                  </Button>
                  <Button type="submit" class="flex-1" disabled={username().length < 6}>
                    {t('auth.next')}
                  </Button>
                </div>
              </form>
            </Match>

            {/* PROCESSING STATE */}
            <Match when={view() === 'processing'}>
              <div class="flex flex-col items-center py-8 space-y-4 text-center">
                <Spinner size="lg" />
                <p class="text-muted-foreground animate-pulse">
                  {props.statusMessage || t('auth.processing')}
                </p>
                {/* Show wallet address if connected during processing */}
                <Show when={props.isWalletConnected && props.walletAddress}>
                  <div class="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {props.walletAddress?.slice(0, 6)}...{props.walletAddress?.slice(-4)}
                  </div>
                </Show>
              </div>
            </Match>

            {/* COMPLETE STATE */}
            <Match when={view() === 'complete'}>
              <div class="flex flex-col items-center py-6 space-y-4">
                <Icon name="check-circle" class="text-7xl text-green-500" />
                <p class="text-center text-muted-foreground">{t('auth.allSet')}</p>
                <Button onClick={() => props.onOpenChange(false)} class="w-full">
                  {t('auth.startLearning')}
                </Button>
              </div>
            </Match>
          </Switch>
        </div>
      </DialogContent>
    </Dialog>
  )
}
