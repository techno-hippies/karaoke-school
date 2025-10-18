/**
 * AuthDialog
 * Clear two-button authentication with step indicators
 * Separates "Create Account" vs "Sign In" flows
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle } from '@phosphor-icons/react'

/**
 * Auth Step
 */
type AuthStep = 'idle' | 'username' | 'webauthn' | 'session' | 'social' | 'complete'

/**
 * Auth Mode
 */
type AuthMode = 'register' | 'login' | null

export interface AuthDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void
  /** Current auth step */
  currentStep: AuthStep
  /** Whether currently authenticating */
  isAuthenticating?: boolean
  /** Current auth mode (register or login) */
  authMode?: AuthMode
  /** Status message for current step */
  statusMessage?: string
  /** Error message */
  errorMessage?: string
  /** Whether PKP is ready */
  isPKPReady?: boolean
  /** Whether user has connected social account */
  hasSocialAccount?: boolean
  /** Username availability status */
  usernameAvailability?: 'checking' | 'available' | 'unavailable' | null
  /** Called when user clicks "Create Account" (shows username input) */
  onRegister?: () => void
  /** Called when user submits username and starts registration */
  onRegisterWithUsername?: (username: string) => void
  /** Called when user clicks "Sign In" */
  onLogin?: () => void
  /** Called when user clicks back from username input */
  onUsernameBack?: () => void
  /** Called when user clicks "Connect Social Account" */
  onConnectSocial?: () => void
}

export function AuthDialog({
  open,
  onOpenChange,
  currentStep,
  isAuthenticating = false,
  authMode = null,
  statusMessage = '',
  errorMessage = '',
  usernameAvailability = null,
  // isPKPReady, // TODO: Use when adding PKP status indicator
  // hasSocialAccount, // TODO: Use when showing social account status
  onRegister,
  onRegisterWithUsername,
  onLogin,
  onUsernameBack,
  // onConnectSocial, // TODO: Use when adding social account connection
}: AuthDialogProps) {
  // Internal state for username input
  const [username, setUsername] = useState('')

  // Determine current state
  const isComplete = currentStep === 'complete' && authMode === null
  const isUsernameInput = currentStep === 'username'

  // Handle username submission
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim().length >= 6 && onRegisterWithUsername) {
      onRegisterWithUsername(username.trim())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">
            {isUsernameInput ? 'Choose Username' : 'Welcome to K-School'}
          </DialogTitle>
          <p className="text-base text-muted-foreground">
            {isUsernameInput
              ? 'Must be 6+ characters, shorter usernames available for payment.'
              : 'Karaoke to 13M+ songs to learn English!'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
          {/* Initial Choice: Register or Login */}
          {!authMode && !isAuthenticating && !isComplete && !isUsernameInput && (
            <div className="space-y-4">
              <Button
                onClick={onRegister}
                disabled={isAuthenticating}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Create Account
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-base">
                  <span className="bg-background px-4 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                onClick={onLogin}
                disabled={isAuthenticating}
                className="w-full h-14 text-base"
                variant="outline"
                size="lg"
              >
                Sign In
              </Button>
            </div>
          )}

          {/* Username Input - shown after "Create Account" */}
          {isUsernameInput && (
            <form onSubmit={handleUsernameSubmit} className="space-y-6">
              <div className="space-y-2">
                <Input
                  id="username"
                  type="text"
                  placeholder="alice"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 text-base"
                  autoFocus
                  minLength={6}
                  maxLength={26}
                  pattern="[a-zA-Z0-9_-]+"
                  disabled={isAuthenticating}
                  required
                />

                {/* Availability Indicator */}
                {username.trim().length >= 6 && (
                  <div className="flex items-center gap-2 text-sm">
                    {usernameAvailability === 'checking' && (
                      <>
                        <Spinner className="size-3" />
                        <span className="text-muted-foreground">Checking availability...</span>
                      </>
                    )}
                    {usernameAvailability === 'available' && (
                      <span className="text-green-500">✓ Available</span>
                    )}
                    {usernameAvailability === 'unavailable' && (
                      <span className="text-destructive">✗ Not Available</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  type="button"
                  onClick={onUsernameBack}
                  disabled={isAuthenticating}
                  className="flex-1 h-14 text-base"
                  variant="outline"
                  size="lg"
                >
                  Back
                </Button>

                <Button
                  type="submit"
                  disabled={
                    username.trim().length < 6 ||
                    isAuthenticating ||
                    usernameAvailability === 'checking' ||
                    usernameAvailability === 'unavailable'
                  }
                  className="flex-1 h-14 text-base"
                  variant="default"
                  size="lg"
                >
                  {isAuthenticating && <Spinner size="sm" />}
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* Progress/Loading State - show during any auth flow (except username input) */}
          {(authMode || isAuthenticating) && !isComplete && !isUsernameInput && (
            <div className="space-y-4 py-8">
              <div className="flex flex-col items-center gap-4">
                <Spinner className="w-12 h-12" />
                {statusMessage && (
                  <p className="text-base text-center text-muted-foreground">
                    {statusMessage}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="text-base text-center p-4 bg-destructive/10 text-destructive rounded-lg">
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* Complete State */}
          {isComplete && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" weight="fill" />
                <p className="text-base text-muted-foreground">
                  You're all set!
                </p>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
