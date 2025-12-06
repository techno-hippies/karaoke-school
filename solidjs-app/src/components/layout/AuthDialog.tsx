/**
 * AuthDialog for SolidJS
 * Simplified authentication dialog with passkey support
 */

import { createSignal, createEffect, Show, type Component } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Key, CheckCircle, AlertCircle, ChevronLeft } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'

type AuthStep = 'select-method' | 'passkey-intro' | 'username' | 'processing' | 'complete'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  // Context state
  currentStep: string
  authMode?: 'register' | 'login' | 'eoa' | null
  isAuthenticating: boolean
  statusMessage: string
  errorMessage: string

  // Actions
  onRegister: () => void
  onRegisterWithUsername: (username: string) => void
  onLogin: () => void
  onUsernameBack: () => void
}

export const AuthDialog: Component<AuthDialogProps> = (props) => {
  const { t } = useTranslation()
  const [view, setView] = createSignal<AuthStep>('select-method')
  const [username, setUsername] = createSignal('')
  const [showErrorDetails, setShowErrorDetails] = createSignal(false)
  const [pendingAuth, setPendingAuth] = createSignal(false)

  // Sync context step to view
  createEffect(() => {
    if (props.currentStep === 'complete') {
      setView('complete')
      setPendingAuth(false)
    }
    if (props.currentStep === 'username') setView('username')
    if (props.currentStep === 'webauthn' || props.currentStep === 'session' ||
        props.currentStep === 'social' || props.currentStep === 'processing') {
      setView('processing')
    }
  })

  // Handle authentication finishing (only when we're not pending and auth stops)
  createEffect(() => {
    // Only fall back if auth finished AND we weren't in a pending state AND there's an error
    if (view() === 'processing' && !props.isAuthenticating && !pendingAuth() && props.errorMessage) {
      setView('passkey-intro')
    }
  })

  // Reset view when closed
  createEffect(() => {
    if (!props.open) {
      setTimeout(() => {
        setView('select-method')
        setUsername('')
        setShowErrorDetails(false)
        setPendingAuth(false)
      }, 300)
    }
  })

  const handleBack = () => {
    if (view() === 'passkey-intro') {
      setView('select-method')
    } else if (view() === 'username') {
      props.onUsernameBack()
      setUsername('')
      setView('passkey-intro')
    }
  }

  const handleUsernameSubmit = (e: Event) => {
    e.preventDefault()
    if (username().trim().length >= 6) {
      setPendingAuth(true)
      setView('processing')
      props.onRegisterWithUsername(username().trim())
    }
  }

  const getTitle = () => {
    switch (view()) {
      case 'passkey-intro':
        return t('auth.usePasskey')
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

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle class="text-2xl text-center">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div class="py-4">
          {/* ERROR DISPLAY */}
          <Show when={props.errorMessage}>
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <div class="flex items-start gap-2">
                <AlertCircle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <p class="text-red-700">{props.errorMessage}</p>
                  <Show when={props.errorMessage.length > 100}>
                    <button
                      type="button"
                      onClick={() => setShowErrorDetails(!showErrorDetails())}
                      class="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      {showErrorDetails() ? t('auth.hideDetails') : t('auth.showDetails')}
                    </button>
                    <Show when={showErrorDetails()}>
                      <pre class="mt-2 p-2 bg-red-100 rounded text-xs text-red-600 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                        {props.errorMessage}
                      </pre>
                    </Show>
                  </Show>
                </div>
              </div>
            </div>
          </Show>

          {/* STEP 1: METHOD SELECTION */}
          <Show when={view() === 'select-method'}>
            <div class="space-y-3">
              <Button
                onClick={() => setView('passkey-intro')}
                variant="outline"
                class="w-full h-14 justify-start px-4 text-base font-medium gap-3"
              >
                <Key class="w-6 h-6 text-orange-500" />
                <div class="flex flex-col items-start">
                  <span>{t('auth.passkeyRecommended')}</span>
                  <span class="text-xs text-muted-foreground font-normal">{t('auth.noPasswordSecure')}</span>
                </div>
              </Button>
            </div>
          </Show>

          {/* STEP 2A: PASSKEY INTRO */}
          <Show when={view() === 'passkey-intro'}>
            <div class="space-y-4">
              <Button
                onClick={() => {
                  setView('username')
                }}
                class="w-full h-12"
                size="lg"
              >
                {t('auth.createNewAccount')}
              </Button>

              <div class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-border"></div>
                </div>
                <div class="relative flex justify-center text-xs uppercase">
                  <span class="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
                </div>
              </div>

              <Button
                onClick={() => {
                  setPendingAuth(true)
                  setView('processing')
                  props.onLogin()
                }}
                variant="outline"
                class="w-full h-12"
              >
                {t('auth.signIn')}
              </Button>

              <Button variant="ghost" size="sm" onClick={handleBack} class="w-full text-muted-foreground">
                <ChevronLeft class="mr-2 h-4 w-4" /> {t('auth.back')}
              </Button>
            </div>
          </Show>

          {/* STEP 2B: USERNAME INPUT */}
          <Show when={view() === 'username'}>
            <form onSubmit={handleUsernameSubmit} class="space-y-4">
              <div class="space-y-2">
                <Input
                  placeholder={t('auth.usernamePlaceholder')}
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  minLength={6}
                  class="h-12"
                  autofocus
                />
                <Show when={username().length >= 6}>
                  <span class="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle class="w-4 h-4" /> {t('auth.validFormat')}
                  </span>
                </Show>
              </div>

              <div class="flex gap-3">
                <Button type="button" variant="outline" onClick={handleBack} class="flex-1">
                  {t('auth.back')}
                </Button>
                <Button
                  type="submit"
                  class="flex-1"
                  disabled={username().length < 6}
                >
                  {t('auth.next')}
                </Button>
              </div>
            </form>
          </Show>

          {/* PROCESSING STATE */}
          <Show when={view() === 'processing'}>
            <div class="flex flex-col items-center py-8 space-y-4 text-center">
              <Spinner size="lg" />
              <p class="text-muted-foreground animate-pulse">
                {props.statusMessage || t('auth.processing')}
              </p>
            </div>
          </Show>

          {/* COMPLETE STATE */}
          <Show when={view() === 'complete'}>
            <div class="flex flex-col items-center py-6 space-y-4">
              <CheckCircle class="w-16 h-16 text-green-500" />
              <p class="text-center text-muted-foreground">
                {t('auth.allSet')}
              </p>
              <Button onClick={() => props.onOpenChange(false)} class="w-full">
                {t('auth.startLearning')}
              </Button>
            </div>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  )
}
