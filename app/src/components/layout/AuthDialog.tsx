/**
 * AuthDialog
 * Unified authentication (auto-detects new vs returning users)
 * Uses Lit WebAuthn for biometric authentication
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export interface AuthDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void
  /** Whether PKP wallet is connected */
  isPKPReady: boolean
  /** Whether Lens account exists */
  hasLensAccount: boolean
  /** Whether currently authenticating */
  isAuthenticating?: boolean
  /** Auth status message */
  authStatus?: string
  /** Called when user clicks authenticate (unified flow) */
  onAuthenticate?: () => void
  /** Called when user clicks login to Lens */
  onLoginLens?: () => void
  // Backwards compat
  onRegister?: () => void
  onSignIn?: () => void
}

export function AuthDialog({
  open,
  onOpenChange,
  isPKPReady,
  hasLensAccount,
  isAuthenticating = false,
  authStatus = '',
  onAuthenticate,
  onLoginLens,
  onRegister,
  onSignIn,
}: AuthDialogProps) {
  // Determine current state
  const needsPKP = !isPKPReady
  const needsLens = isPKPReady && !hasLensAccount
  const isComplete = isPKPReady && hasLensAccount

  // Use unified handler or fall back to register (both do the same thing now)
  const handleAuth = onAuthenticate || onRegister || onSignIn

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-h-[200px]">
        <div className="space-y-4 py-6">
          {needsPKP && (
            <>
              <Button
                onClick={handleAuth}
                disabled={isAuthenticating}
                className="w-full text-base h-12"
                variant="default"
              >
                {isAuthenticating ? (
                  <>
                    <Spinner className="mr-2" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In / Create Account'
                )}
              </Button>

              {authStatus && (
                <div className="text-sm text-center text-muted-foreground px-4">
                  {authStatus}
                </div>
              )}
            </>
          )}

          {needsLens && (
            <Button
              onClick={onLoginLens}
              disabled={isAuthenticating}
              className="w-full text-base h-12"
            >
              {isAuthenticating ? (
                <>
                  <Spinner className="mr-2" />
                  Connecting...
                </>
              ) : (
                'Connect Social Account'
              )}
            </Button>
          )}

          {isComplete && (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full text-base h-12"
              variant="default"
            >
              Continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
