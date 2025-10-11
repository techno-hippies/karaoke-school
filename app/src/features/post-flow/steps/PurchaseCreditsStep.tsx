/**
 * Purchase Credits Step
 * Shows credit purchase dialog with on-ramp option
 */

import { useState, useEffect } from 'react'
import { PurchaseCreditsDialog } from '@/components/karaoke/PurchaseCreditsDialog'
import { useOnRamp } from '@/hooks/useOnRamp'
import { useCredits } from '../hooks/useCredits'
import { CREDIT_PACKAGES } from '../types'
import type { PostFlowContext } from '../types'

interface PurchaseCreditsStepProps {
  flow: PostFlowContext
}

export function PurchaseCreditsStep({ flow }: PurchaseCreditsStepProps) {
  const { openBuyUSDC } = useOnRamp()
  const { checkUSDCBalance } = useCredits()
  const [showOnRampPrompt, setShowOnRampPrompt] = useState(false)
  const [isCheckingBalance, setIsCheckingBalance] = useState(true)

  // Check USDC balance on mount
  useEffect(() => {
    const checkBalance = async () => {
      const pkg = CREDIT_PACKAGES[0]
      const requiredAmount = BigInt(pkg.priceUSDC)

      // Check if user has enough USDC
      const balance = await checkUSDCBalance()
      console.log('[PurchaseCreditsStep] USDC balance:', balance.toString(), 'required:', requiredAmount.toString())

      if (balance < requiredAmount) {
        // Show on-ramp prompt immediately
        setShowOnRampPrompt(true)
      }

      setIsCheckingBalance(false)
    }

    checkBalance()
  }, [checkUSDCBalance])

  const handlePurchase = async () => {
    try {
      // Default to package 0 (1 credit)
      await flow.purchaseCredits(0)
      // Flow hook will auto-return to song select
    } catch (error) {
      console.error('[PurchaseCreditsStep] Purchase failed:', error)

      // Check if it's insufficient USDC error
      if (error instanceof Error && error.message === 'INSUFFICIENT_USDC') {
        setShowOnRampPrompt(true)
      }
    }
  }

  const handleBuyUSDC = () => {
    openBuyUSDC()
    // Close dialog - user will return after buying USDC
    flow.goToSongSelect()
  }

  const pkg = CREDIT_PACKAGES[0]

  // Show loading while checking balance
  if (isCheckingBalance) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 rounded-lg">
          <p className="text-gray-300">Checking USDC balance...</p>
        </div>
      </div>
    )
  }

  if (showOnRampPrompt) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-4">Insufficient USDC</h2>
          <p className="text-gray-300 mb-6">
            You need USDC in your Smart Account to purchase credits.
            Would you like to buy USDC with a credit card?
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleBuyUSDC}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded"
            >
              Buy USDC
            </button>
            <button
              onClick={() => flow.goToSongSelect()}
              className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PurchaseCreditsDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          // Return to song select - user can pick song again with credits
          flow.goToSongSelect()
        }
      }}
      price={pkg.priceDisplay}
      creditAmount={pkg.credits}
      onPurchase={handlePurchase}
    />
  )
}
