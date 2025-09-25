import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Fingerprint, Wallet, CircleNotch } from '@phosphor-icons/react'

interface LitAuthModalViewProps {
  isOpen: boolean
  onClose: () => void
  
  // State
  mode?: 'signup' | 'login'
  isLoading?: boolean
  error?: string | null
  
  // Callbacks
  onSignUpWithDevice?: () => void
  onSignInWithDevice?: () => void
  onConnectWallet?: () => void
  onSwitchMode?: () => void
}

export const LitAuthModalView: React.FC<LitAuthModalViewProps> = ({
  isOpen,
  onClose,
  mode = 'signup',
  isLoading = false,
  error = null,
  onSignUpWithDevice = () => {},
  onSignInWithDevice = () => {},
  onConnectWallet = () => {},
  onSwitchMode = () => {},
}) => {
  const isSignup = mode === 'signup'
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-black border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {isSignup ? 'Sign Up for K-School' : 'Authenticate for Transaction'}
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {isSignup 
              ? 'Create your account with biometric authentication' 
              : 'Sign in again to authorize this transaction'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Primary button - Device auth */}
          <Button
            onClick={isSignup ? onSignUpWithDevice : onSignInWithDevice}
            disabled={isLoading}
            className="w-full bg-white text-black hover:bg-neutral-200"
            size="lg"
          >
            {isLoading ? (
              <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Fingerprint className="w-4 h-4 mr-2" />
            )}
            {isSignup ? 'Sign Up' : 'Sign In'}
          </Button>

          {/* Secondary button - Wallet */}
          <Button
            onClick={onConnectWallet}
            disabled={isLoading}
            className="w-full bg-neutral-900 border border-neutral-700 text-white hover:bg-neutral-800"
            size="lg"
          >
            {isLoading ? (
              <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4 mr-2" />
            )}
            Connect Wallet
          </Button>

          {/* Error display */}
          {error && (
            <div className="text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          {/* Terms text */}
          <p className="text-xs text-neutral-500 text-center px-4">
            By continuing, you agree to K-School's Terms of Service and 
            confirm that you have read K-School's Privacy Policy.
          </p>
        </div>

        {/* Bottom divider and switch mode */}
        <div className="mt-6 pt-4 border-t border-neutral-800">
          <p className="text-sm text-neutral-400 text-center">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={onSwitchMode}
              className="text-white hover:underline"
            >
              {isSignup ? 'Login' : 'Sign up'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}