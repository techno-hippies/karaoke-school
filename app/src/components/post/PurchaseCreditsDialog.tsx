import {
  Dialog,
  DialogContent,
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <div className="flex flex-col gap-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">Get Karaoke Credits</h2>

          <div className="py-6">
            <div className="text-5xl font-bold text-foreground mb-2">
              {price}
            </div>
            <p className="text-lg text-muted-foreground">
              for {creditAmount} credits
            </p>
          </div>

          <Button
            size="lg"
            onClick={onPurchase}
            className="w-full"
          >
            Buy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
