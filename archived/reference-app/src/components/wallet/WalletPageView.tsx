import { Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export interface WalletPageViewProps {
  creditsBalance: number
  usdcBalance: string
  walletAddress: string
  onCopyAddress: () => void
}

export function WalletPageView({
  creditsBalance,
  usdcBalance,
  walletAddress,
  onCopyAddress,
}: WalletPageViewProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Balances */}
      <div className="mb-12">
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          {/* USDC Balance */}
          <div className="text-center py-8 md:py-12 px-4 md:px-6 rounded-lg border-2 border-border">
            <p className="text-4xl md:text-6xl font-bold">${usdcBalance}</p>
            <p className="text-base md:text-lg text-muted-foreground mt-3">USDC on Base</p>
          </div>

          {/* Song Credits Balance */}
          <div className="text-center py-8 md:py-12 px-4 md:px-6 rounded-lg border-2 border-border">
            <p className="text-4xl md:text-6xl font-bold">{creditsBalance.toLocaleString()}</p>
            <p className="text-base md:text-lg text-muted-foreground mt-3">Song Credits</p>
          </div>
        </div>
      </div>

      {/* Wallet Address */}
      <div>
        <h2 className="text-base md:text-lg font-medium text-muted-foreground mb-4">Wallet Address</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 w-0 bg-neutral-800 rounded-lg px-4 md:px-6 py-4 md:py-5">
            <div className="font-mono text-sm md:text-base text-foreground">
              {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
            </div>
          </div>
          <Button
            onClick={onCopyAddress}
            variant="secondary"
            size="icon"
            className="shrink-0 h-12 w-12 md:h-14 md:w-14"
          >
            <Copy className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </div>
      </div>
    </div>
  )
}
