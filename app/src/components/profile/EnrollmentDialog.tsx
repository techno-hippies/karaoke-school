import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { EnrollCard } from './EnrollCard'

export interface EnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  userAvatar?: string
  price?: string
  onEnroll?: () => void
}

/**
 * EnrollmentDialog - Dialog wrapper for EnrollCard
 * Used from: Profile page enroll button, potentially video lock overlays
 */
export function EnrollmentDialog({
  open,
  onOpenChange,
  username,
  userAvatar,
  price,
  onEnroll,
}: EnrollmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <EnrollCard
          username={username}
          userAvatar={userAvatar}
          price={price}
          onEnroll={onEnroll}
        />
      </DialogContent>
    </Dialog>
  )
}
