import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PurchaseCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPurchase: () => void
  price: string
  creditAmount: number
}

/**
 * PurchaseCreditsDialog - Dialog for purchasing karaoke credits
 * Shows price and credit amount
 */
export function PurchaseCreditsDialog({
  open,
  onOpenChange,
  onPurchase,
  price,
  creditAmount,
}: PurchaseCreditsDialogProps) {
  const { t } = useTranslation('post')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <DialogTitle className="text-2xl font-bold text-foreground text-center">
          {t('purchaseCredits.title')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Purchase {creditAmount} karaoke credits for {price} USDC
        </DialogDescription>

        <div className="flex flex-col gap-6 text-center">
          <div className="py-6">
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <div className="text-5xl font-bold text-foreground">
                {price}
              </div>
              <div className="text-lg text-muted-foreground">
                {t('purchaseCredits.priceLabel')}
              </div>
            </div>
            <p className="text-lg text-muted-foreground">
              {t('purchaseCredits.description', { count: creditAmount })}
            </p>
          </div>

          <Button
            size="lg"
            onClick={onPurchase}
            className="w-full"
          >
            {t('purchaseCredits.purchase')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
