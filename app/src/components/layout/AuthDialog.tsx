/**
 * AuthDialog
 * Clear two-button authentication with step indicators
 * Separates "Create Account" vs "Sign In" flows
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle } from '@phosphor-icons/react'

/**
 * Auth Step
 */
type AuthStep = 'idle' | 'webauthn' | 'session' | 'social' | 'complete'

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
  /** Called when user clicks "Create Account" */
  onRegister?: () => void
  /** Called when user clicks "Sign In" */
  onLogin?: () => void
  /** Called when user clicks "Connect Social Account" */
  onConnectSocial?: () => void
  /** Whether PKP is ready (session complete) */
  isPKPReady?: boolean
  /** Whether social account is connected */
  hasSocialAccount?: boolean
}

export function AuthDialog({
  open,
  onOpenChange,
  currentStep,
  isAuthenticating = false,
  authMode = null,
  statusMessage = '',
  errorMessage = '',
  onRegister,
  onLogin,
  onConnectSocial,
  isPKPReady = false,
  hasSocialAccount = false,
}: AuthDialogProps) {
  console.log('[AuthDialog] Render:', {
    open,
    currentStep,
    isAuthenticating,
    authMode,
    isPKPReady,
    hasSocialAccount,
    statusMessage,
  })

  // Determine current state
  const needsPKP = !isPKPReady
  const needsSocial = isPKPReady && !hasSocialAccount && currentStep !== 'complete'
  const isComplete = currentStep === 'complete' && authMode === null

  console.log('[AuthDialog] State:', { needsPKP, needsSocial, isComplete })

  // Step status helper
  const getStepStatus = (stepId: AuthStep): 'complete' | 'current' | 'pending' => {
    const stepOrder = ['webauthn', 'session', 'social']
    const currentIndex = stepOrder.indexOf(currentStep)
    const thisIndex = stepOrder.indexOf(stepId)

    if (thisIndex < currentIndex) return 'complete'
    if (thisIndex === currentIndex) return 'current'
    return 'pending'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">
            Welcome to K-School
          </DialogTitle>
          <p className="text-base text-muted-foreground">
            Karaoke to 13M+ songs to learn English!
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
          {/* Initial Choice: Register or Login */}
          {!authMode && !isAuthenticating && !isComplete && (
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

          {/* Progress/Loading State - show during any auth flow */}
          {(authMode || isAuthenticating) && !isComplete && (
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
