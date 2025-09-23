import { Wallet, Chrome, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useConnect, useConnectors } from 'wagmi'

interface WalletSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletSelectionModal({
  open,
  onOpenChange,
}: WalletSelectionModalProps) {
  const { connect } = useConnect()
  const connectors = useConnectors()

  const handleConnect = (connector: any) => {
    connect({ connector })
    onOpenChange(false)
  }

  // Group connectors by type
  const injectedConnector = connectors.find(c => c.type === 'injected')
  const walletConnectConnector = connectors.find(c => c.type === 'walletConnect')
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-xl text-neutral-100">Choose a wallet</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Select how you'd like to connect
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {injectedConnector && (
            <button
              onClick={() => handleConnect(injectedConnector)}
              className="w-full p-4 bg-neutral-800/50 hover:bg-neutral-800 rounded-lg flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 bg-neutral-700 rounded-lg flex items-center justify-center">
                <Chrome className="h-5 w-5 text-neutral-300" />
              </div>
              <div className="text-left flex-1">
                <div className="text-neutral-100 font-medium">Browser Wallet</div>
                <div className="text-neutral-400 text-sm">MetaMask, Coinbase, etc.</div>
              </div>
            </button>
          )}

          {walletConnectConnector && (
            <button
              onClick={() => handleConnect(walletConnectConnector)}
              className="w-full p-4 bg-neutral-800/50 hover:bg-neutral-800 rounded-lg flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 bg-neutral-700 rounded-lg flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-neutral-300" />
              </div>
              <div className="text-left flex-1">
                <div className="text-neutral-100 font-medium">WalletConnect</div>
                <div className="text-neutral-400 text-sm">Scan with wallet app</div>
              </div>
            </button>
          )}

          {connectors.length === 0 && (
            <div className="text-center py-8 text-neutral-400">
              No wallets detected. Please install a wallet extension.
            </div>
          )}
        </div>

        <div className="text-center">
          <a 
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-400 hover:text-neutral-200 underline"
          >
            Don't have a wallet? Get one here
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}