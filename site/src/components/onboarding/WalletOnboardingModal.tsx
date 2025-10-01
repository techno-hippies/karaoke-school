import { Sparkle, LockKey } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface WalletOnboardingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnectWithJoyID: () => void
  onShowOtherOptions: () => void
}

export function WalletOnboardingModal({
  open,
  onOpenChange,
  onConnectWithJoyID,
  onShowOtherOptions,
}: WalletOnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-2xl text-neutral-100">Welcome!</DialogTitle>
          <DialogDescription className="text-base text-neutral-400">
            A web3 wallet is like an email account! We recommend JoyID.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-3 py-4">
          <div className="bg-neutral-800/50 rounded-lg p-4 flex flex-col items-center text-center space-y-2">
            <Sparkle size={32} weight="duotone" className="text-yellow-400" />
            <p className="text-sm text-neutral-200">Free</p>
          </div>
          
          <div className="bg-neutral-800/50 rounded-lg p-4 flex flex-col items-center text-center space-y-2">
            <LockKey size={32} weight="duotone" className="text-blue-400" />
            <p className="text-sm text-neutral-200">No password</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            size="lg" 
            className="w-full bg-red-500 text-white hover:bg-red-600"
            onClick={onConnectWithJoyID}
          >
            Connect with JoyID
          </Button>
          <Button 
            variant="ghost" 
            size="lg"
            className="w-full text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            onClick={onShowOtherOptions}
          >
            Other options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}