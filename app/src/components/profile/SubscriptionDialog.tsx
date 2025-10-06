import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { SubscribeCard } from './SubscribeCard'

export interface SubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  userAvatar?: string
  price?: string
  onSubscribe?: () => void
}

/**
 * SubscriptionDialog - Dialog wrapper for SubscribeCard
 * Used from: Profile page subscribe button, potentially video lock overlays
 */
export function SubscriptionDialog({
  open,
  onOpenChange,
  username,
  userAvatar,
  price,
  onSubscribe,
}: SubscriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <SubscribeCard
          username={username}
          userAvatar={userAvatar}
          price={price}
          onSubscribe={onSubscribe}
        />
      </DialogContent>
    </Dialog>
  )
}
