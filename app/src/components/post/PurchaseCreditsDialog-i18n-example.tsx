/**
 * EXAMPLE: Refactored PurchaseCreditsDialog with i18n
 *
 * This is a reference implementation showing how to refactor components
 * to use translations. Copy this pattern to other components.
 *
 * Key changes:
 * 1. Import useTranslation hook
 * 2. Get t() function from hook with namespace
 * 3. Replace hardcoded strings with t('key')
 * 4. Use interpolation for dynamic values
 */

import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface PurchaseCreditsDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  price: string
  creditAmount: number
  onPurchase: () => void
}

export function PurchaseCreditsDialog({
  open,
  onOpenChange,
  price,
  creditAmount,
  onPurchase,
}: PurchaseCreditsDialogProps) {
  // 1. Use the useTranslation hook with 'post' namespace
  const { t } = useTranslation('post')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          {/* 2. Replace hardcoded "Purchase Credits" */}
          <DialogTitle>{t('purchaseCredits.title')}</DialogTitle>

          {/* 3. Use interpolation for dynamic values */}
          <DialogDescription>
            {t('purchaseCredits.description', { count: creditAmount, price })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mt-6">
          {/* 4. Use common namespace for shared strings */}
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            className="flex-1"
          >
            {t('purchaseCredits.cancel')}
          </Button>

          <Button
            onClick={onPurchase}
            className="flex-1"
          >
            {t('purchaseCredits.purchase')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * TESTING NOTES:
 * - Stories will automatically support all languages via toolbar
 * - Tests should verify rendering in all 3 languages
 * - See __tests__/PurchaseCreditsDialog.test.tsx for example
 */
