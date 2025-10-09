/**
 * AuthDialog
 * Shows authentication requirements and guides user through the flow
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
  /** Whether wallet is connected */
  isWalletConnected: boolean
  /** Whether Lens account exists */
  hasLensAccount: boolean
  /** Whether Lit Protocol is ready */
  isLitReady: boolean
  /** Whether currently authenticating */
  isAuthenticating?: boolean
  /** Called when user clicks connect wallet */
  onConnectWallet?: () => void
  /** Called when user clicks login to Lens */
  onLoginLens?: () => void
}

export function AuthDialog({
  open,
  onOpenChange,
  isWalletConnected,
  hasLensAccount,
  isLitReady,
  isAuthenticating = false,
  onConnectWallet,
  onLoginLens,
}: AuthDialogProps) {
  // Determine current state
  const needsWallet = !isWalletConnected
  const needsLens = isWalletConnected && !hasLensAccount
  const needsLit = isWalletConnected && hasLensAccount && !isLitReady

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login Required</DialogTitle>
          <DialogDescription>
            To create karaoke posts, you need to complete authentication
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Wallet Status */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isWalletConnected ? 'bg-green-500/20' : 'bg-muted'
            }`}>
              {isWalletConnected ? '✓' : '1'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Connect Wallet</p>
              <p className="text-xs text-muted-foreground">
                {isWalletConnected ? 'Connected' : 'Required to continue'}
              </p>
            </div>
          </div>

          {/* Lens Status */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              hasLensAccount ? 'bg-green-500/20' : needsLens ? 'bg-primary/20' : 'bg-muted'
            }`}>
              {hasLensAccount ? '✓' : '2'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Login to Lens</p>
              <p className="text-xs text-muted-foreground">
                {hasLensAccount ? 'Logged in' : 'Required to post content'}
              </p>
            </div>
          </div>

          {/* Lit Status */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isLitReady ? 'bg-green-500/20' : needsLit ? 'bg-primary/20' : 'bg-muted'
            }`}>
              {isLitReady ? '✓' : needsLit ? <Spinner size="sm" /> : '3'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Initialize Lit Protocol</p>
              <p className="text-xs text-muted-foreground">
                {isLitReady ? 'Ready' : needsLit ? 'Initializing...' : 'Automatic after login'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2">
          {needsWallet && (
            <Button
              onClick={onConnectWallet}
              disabled={isAuthenticating}
              className="w-full"
            >
              {isAuthenticating ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}

          {needsLens && (
            <Button
              onClick={onLoginLens}
              disabled={isAuthenticating}
              className="w-full"
            >
              {isAuthenticating ? 'Logging in...' : 'Login to Lens'}
            </Button>
          )}

          {needsLit && (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">
                Setting up your account...
              </p>
            </div>
          )}

          {!needsWallet && !needsLens && !needsLit && (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
