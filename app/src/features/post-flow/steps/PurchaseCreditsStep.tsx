/**
 * Purchase Credits Step
 * Wrapper for PurchaseCreditsDialog
 */

import { PurchaseCreditsDialog } from '@/components/karaoke/PurchaseCreditsDialog'
import { CREDIT_PACKAGES } from '../types'
import type { PostFlowContext } from '../types'

interface PurchaseCreditsStepProps {
  flow: PostFlowContext
}

export function PurchaseCreditsStep({ flow }: PurchaseCreditsStepProps) {
  const handlePurchase = async () => {
    try {
      // Default to package 0 (1 credit)
      await flow.purchaseCredits(0)
      // Flow hook will auto-return to segment picker
    } catch (error) {
      console.error('[PurchaseCreditsStep] Purchase failed:', error)
      // TODO: Show error UI
    }
  }

  const pkg = CREDIT_PACKAGES[0]

  return (
    <PurchaseCreditsDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) flow.goToSegmentPicker(flow.data.selectedSong!)
      }}
      price={pkg.priceUsd}
      creditAmount={pkg.credits}
      onPurchase={handlePurchase}
    />
  )
}
