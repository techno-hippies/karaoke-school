/**
 * SubscriptionDialog
 * Minimal subscription modal for Unlock Protocol NFT purchase
 * 0.006 ETH on Base Sepolia
 */

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
 * Subscription Step
 */
type SubscriptionStep = 'idle' | 'approving' | 'purchasing' | 'complete' | 'error'

export interface SubscriptionDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void
  /** Creator display name (not handle) */
  displayName: string
  /** Current subscription step */
  currentStep: SubscriptionStep
  /** Whether currently processing */
  isProcessing?: boolean
  /** Status message for current step */
  statusMessage?: string
  /** Error message */
  errorMessage?: string
  /** Called when user clicks Subscribe button */
  onSubscribe?: () => void
  /** Called when user clicks Retry after error */
  onRetry?: () => void
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  displayName,
  currentStep,
  isProcessing = false,
  statusMessage = '',
  errorMessage = '',
  onSubscribe,
  onRetry,
}: SubscriptionDialogProps) {
  const isComplete = currentStep === 'complete'
  const isError = currentStep === 'error'
  const isIdle = currentStep === 'idle'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">
            Subscribe to {displayName}
          </DialogTitle>
          <p className="text-base text-muted-foreground">
            {isComplete
              ? 'You are now subscribed!'
              : 'Karaoke to full-length songs and exclusive features.'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
          {/* Idle State - Show price and subscribe button */}
          {isIdle && (
            <div className="space-y-6">
              {/* Price Display */}
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-muted/30 border border-border">
                <div className="text-center">
                  <div className="flex items-baseline gap-2 justify-center">
                    <span className="text-4xl font-bold">0.0006 ETH</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Base Sepolia
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Complete lyrics</p>
                <p>✓ All exercise types</p>
                <p>✓ More songs added weekly</p>
              </div>

              {/* Subscribe Button */}
              <Button
                onClick={onSubscribe}
                disabled={isProcessing}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                {isProcessing && <Spinner size="sm" />}
                Subscribe
              </Button>
            </div>
          )}

          {/* Processing State - Show spinner and status */}
          {(currentStep === 'approving' || currentStep === 'purchasing') && (
            <div className="space-y-4 py-8">
              <div className="flex flex-col items-center gap-4">
                <Spinner className="w-12 h-12" />
                {statusMessage && (
                  <p className="text-base text-center text-muted-foreground">
                    {statusMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="space-y-4">
              <div className="text-base text-center p-4 bg-destructive/10 text-destructive rounded-lg break-words" style={{ overflowWrap: 'anywhere' }}>
                {errorMessage || 'Transaction failed. Please try again.'}
              </div>

              <Button
                onClick={onRetry}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Complete State */}
          {isComplete && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" weight="fill" />
                <p className="text-base text-muted-foreground">
                  Subscribed to {displayName}
                </p>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
