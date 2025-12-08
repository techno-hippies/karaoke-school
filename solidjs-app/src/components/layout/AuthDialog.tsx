/**
 * AuthDialog for SolidJS
 *
 * Multi-method authentication dialog supporting:
 * - Passkey (WebAuthn) - recommended
 * - Google OAuth
 * - Discord OAuth
 * - External wallet (Metamask, Rabby, etc.)
 *
 * No username step - accounts are created without usernames.
 * Users can claim a username later from their profile.
 *
 * This is a pure UI component. Data flows through props from ConnectedAuthDialog.
 */

import { createSignal, createEffect, Show, Switch, Match, type Component, type JSX } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Icon } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'
import { useIsMobile } from '@/hooks/useIsMobile'

export type AuthStep =
  | 'select-method'  // Initial method selection
  | 'passkey-intro'  // Create vs Sign In choice
  | 'processing'     // Loading state
  | 'wrong-network'  // Wallet connected but wrong chain
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

  // Wallet state (for EOA flow display)
  isWalletConnected?: boolean
  walletAddress?: string

  // Actions
  onRegister: () => void
  onLogin: () => void

  // Social Actions
  onLoginGoogle?: () => void
  onLoginDiscord?: () => void

  // Wallet Actions
  onConnectWallet?: () => void
  onWalletDisconnect?: () => void

  // Network switching (for wrong network detection)
  isWrongNetwork?: boolean
  isSwitchingChain?: boolean
  targetChainName?: string
  onSwitchNetwork?: () => void
}

/**
 * Get user-friendly error message from technical error
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
  const [pendingProvider, setPendingProvider] = createSignal<AuthProvider>(null)
  const [showErrorDetails, setShowErrorDetails] = createSignal(false)

  // Sync context step to view
  createEffect(() => {
    if (props.currentStep === 'complete') {
      setView('complete')
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
      } else if (props.errorMessage) {
        // Go back to method selection on error
        setView(pendingProvider() ? 'passkey-intro' : 'select-method')
      }
    }
  })

  // Detect wrong network after wallet connection
  createEffect(() => {
    if (pendingProvider() === 'wallet') {
      if (props.isWrongNetwork) {
        setView('wrong-network')
      } else if (view() === 'wrong-network' && !props.isWrongNetwork) {
        // Chain switched successfully, go back to processing
        // AuthContext's watchAccount will now proceed with the EOA flow
        setView('processing')
      }
    }
  })

  // Reset view when dialog closes
  createEffect(() => {
    if (!props.open) {
      setTimeout(() => {
        setView('select-method')
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
    } else if (provider === 'google') {
      setView('processing')
      props.onLoginGoogle?.()
    } else if (provider === 'discord') {
      setView('processing')
      props.onLoginDiscord?.()
    } else {
      // Passkey - still needs create vs sign in distinction
      setView('passkey-intro')
    }
  }

  const handleBack = () => {
    if (view() === 'passkey-intro') {
      setView('select-method')
      setPendingProvider(null)
    }
  }

  const getTitle = () => {
    switch (view()) {
      case 'processing':
        return t('auth.authenticating')
      case 'complete':
        return t('auth.success')
      default:
        return t('auth.signIn')
    }
  }

  const showBackButton = () => view() === 'passkey-intro'
  const isMobile = useIsMobile()

  // Shared content rendered inside either Dialog or Drawer
  const content = (): JSX.Element => (
    <>
      {/* Fixed height content area to prevent layout shifts */}
      <div class="py-6 min-h-[320px] flex flex-col">
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
              <div class="space-y-4 flex-1 flex flex-col justify-center">
                {/* Passkey */}
                <Button
                  onClick={() => handleProviderSelect('passkey')}
                  variant="outline"
                  class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
                >
                  <Icon name="key" weight="fill" class="text-3xl" />
                  <span>{t('auth.passkeyRecommended')}</span>
                </Button>

                {/* Wallet */}
                <Show when={props.onConnectWallet}>
                  <Button
                    onClick={() => handleProviderSelect('wallet')}
                    variant="outline"
                    class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
                  >
                    <Icon name="wallet" weight="fill" class="text-3xl" />
                    <span>{t('auth.connectWallet')}</span>
                  </Button>
                </Show>

                {/* Google */}
                <Button
                  onClick={() => handleProviderSelect('google')}
                  variant="outline"
                  class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
                >
                  <Icon name="google-logo" weight="fill" class="text-3xl" />
                  <span>{t('auth.google')}</span>
                </Button>

                {/* Discord */}
                <Button
                  onClick={() => handleProviderSelect('discord')}
                  variant="outline"
                  class="w-full h-14 justify-start px-5 text-lg font-medium gap-4"
                >
                  <Icon name="discord-logo" weight="fill" class="text-3xl" />
                  <span>{t('auth.discord')}</span>
                </Button>
              </div>
            </Match>

            {/* STEP 2: CREATE / SIGN IN CHOICE (Passkey only) */}
            <Match when={view() === 'passkey-intro'}>
              <div class="space-y-5 flex-1 flex flex-col justify-center">
                <Button
                  onClick={() => props.onRegister()}
                  class="w-full h-14 text-lg"
                  size="lg"
                >
                  {t('auth.createNewAccount')}
                </Button>

                <div class="flex justify-center">
                  <span class="text-sm uppercase text-muted-foreground">{t('auth.or')}</span>
                </div>

                <Button
                  onClick={() => props.onLogin()}
                  variant="outline"
                  class="w-full h-14 text-lg"
                >
                  {t('auth.signIn')}
                </Button>
              </div>
            </Match>

            {/* PROCESSING STATE */}
            <Match when={view() === 'processing'}>
              <div class="flex-1 flex flex-col items-center justify-center space-y-5 text-center">
                <Spinner size="lg" />
                <p class="text-lg text-muted-foreground animate-pulse">
                  {props.statusMessage ? t(props.statusMessage as any) || props.statusMessage : t('auth.processing')}
                </p>
                {/* Show wallet address if connected during processing */}
                <Show when={props.isWalletConnected && props.walletAddress}>
                  <div class="text-sm font-mono bg-muted px-3 py-2 rounded">
                    {props.walletAddress?.slice(0, 6)}...{props.walletAddress?.slice(-4)}
                  </div>
                </Show>
              </div>
            </Match>

            {/* WRONG NETWORK STATE */}
            <Match when={view() === 'wrong-network'}>
              <div class="flex-1 flex flex-col justify-center space-y-6">
                {/* Warning banner */}
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div class="flex items-start gap-3">
                    <Icon name="warning" weight="fill" class="text-2xl text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p class="font-medium text-amber-800">{t('auth.wrongNetwork')}</p>
                      <p class="text-sm text-amber-700 mt-1">
                        {t('auth.wrongNetworkDesc', { chain: props.targetChainName || 'Base Sepolia' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Switch network button */}
                <Button
                  onClick={props.onSwitchNetwork}
                  disabled={props.isSwitchingChain}
                  class="w-full h-14 text-lg"
                >
                  <Show when={props.isSwitchingChain} fallback={
                    <>{t('auth.switchNetwork', { chain: props.targetChainName || 'Base Sepolia' })}</>
                  }>
                    <Spinner size="sm" class="mr-2" />
                    {t('auth.switchingNetwork')}
                  </Show>
                </Button>

                {/* Manual instructions fallback */}
                <div class="text-xs text-muted-foreground space-y-2 p-3 bg-muted/50 rounded-lg">
                  <p class="font-medium">{t('auth.manualNetworkSwitch')}</p>
                  <ul class="space-y-1 ml-2">
                    <li>• Network: Base Sepolia</li>
                    <li>• RPC: https://sepolia.base.org</li>
                    <li>• Chain ID: 84532</li>
                    <li>• Symbol: ETH</li>
                  </ul>
                </div>
              </div>
            </Match>

            {/* COMPLETE STATE */}
            <Match when={view() === 'complete'}>
              <div class="flex-1 flex flex-col items-center justify-center">
                <Icon name="check-circle" class="text-8xl text-green-500" />
              </div>
            </Match>
          </Switch>
        </div>
    </>
  )

  // Footer content - only shown for complete state
  const footerContent = () => {
    if (view() === 'complete') {
      return (
        <Button onClick={() => props.onOpenChange(false)} class="w-full h-14 text-lg">
          {t('common.close')}
        </Button>
      )
    }
    return undefined
  }

  // Mobile: Drawer (bottom sheet)
  // Desktop: Dialog (centered modal)
  return (
    <Show
      when={isMobile()}
      fallback={
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
          <DialogContent
            class="sm:max-w-[450px]"
            onBack={showBackButton() ? handleBack : undefined}
            footer={footerContent()}
          >
            <DialogHeader>
              <DialogTitle class="text-3xl text-center">{getTitle()}</DialogTitle>
            </DialogHeader>
            {content()}
          </DialogContent>
        </Dialog>
      }
    >
      <Drawer open={props.open} onOpenChange={props.onOpenChange}>
        <DrawerContent
          onBack={showBackButton() ? handleBack : undefined}
          footer={footerContent()}
        >
          <DrawerHeader>
            <DrawerTitle class="text-3xl text-center">{getTitle()}</DrawerTitle>
          </DrawerHeader>
          {content()}
        </DrawerContent>
      </Drawer>
    </Show>
  )
}
