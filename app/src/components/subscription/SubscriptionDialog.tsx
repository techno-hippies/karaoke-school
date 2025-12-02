/**
 * UnlockDialog
 * One-time purchase modal for SongAccess NFT (~$0.10 USDC)
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
import { useCurrency } from '@/contexts/CurrencyContext'

type UnlockStep = 'idle' | 'checking' | 'signing' | 'approving' | 'purchasing' | 'complete' | 'error'

export interface SubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Song or content title */
  displayName: string
  currentStep: UnlockStep
  isProcessing?: boolean
  statusMessage?: string
  errorMessage?: string
  /** Price in USD (default: 0.10) */
  priceUsd?: number
  onSubscribe?: () => void
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
  priceUsd = 0.10,
  onSubscribe,
  onRetry,
}: SubscriptionDialogProps) {
  const { formatPrice } = useCurrency()
  const isComplete = currentStep === 'complete'
  const isError = currentStep === 'error'
  const isIdle = currentStep === 'idle'
  const isInProgress = currentStep === 'checking' || currentStep === 'signing' || currentStep === 'approving' || currentStep === 'purchasing'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl">
            Unlock {displayName}
          </DialogTitle>
          <p className="text-base text-muted-foreground">
            {isComplete
              ? 'Song unlocked!'
              : 'Get access to the full-length song.'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
          {isIdle && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-muted/30 border border-border">
                <div className="text-center">
                  <span className="text-2xl font-bold">{formatPrice(priceUsd)}</span>
                </div>
              </div>

              <Button
                onClick={onSubscribe}
                disabled={isProcessing}
                className="w-full h-14 text-base"
                variant="default"
                size="lg"
              >
                {isProcessing && <Spinner size="sm" />}
                Unlock
              </Button>
            </div>
          )}

          {isInProgress && (
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

          {isComplete && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" weight="fill" />
                <p className="text-base text-muted-foreground">
                  {displayName} unlocked!
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
