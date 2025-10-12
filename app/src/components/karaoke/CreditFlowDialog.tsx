import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, CaretDown, CaretUp } from '@phosphor-icons/react'
import { VisuallyHidden } from '@/components/ui/visually-hidden'

interface CreditFlowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songTitle: string
  songArtist: string
  walletAddress: string
  usdcBalance: string
  onPurchaseCredits: (packageId: number) => void
  isPurchasing?: boolean
}

interface CreditPackage {
  id: number
  credits: number
  priceUSDC: string
  priceDisplay: string
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 0, credits: 1, priceUSDC: '0.50', priceDisplay: '$0.50' },
  { id: 1, credits: 5, priceUSDC: '2.50', priceDisplay: '$2.50' },
  { id: 2, credits: 20, priceUSDC: '10.00', priceDisplay: '$10.00' },
]

/**
 * CreditFlowDialog - Adaptive dialog for credit acquisition
 * Shows different views based on USDC balance:
 * - View 1 (balance < 0.50): Fund wallet with USDC
 * - View 2 (balance >= 0.50): Purchase credits with USDC
 */
export function CreditFlowDialog({
  open,
  onOpenChange,
  songTitle,
  songArtist,
  walletAddress,
  usdcBalance,
  onPurchaseCredits,
  isPurchasing = false,
}: CreditFlowDialogProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const balance = parseFloat(usdcBalance)
  const hasEnoughForPurchase = balance >= 0.50

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  const formatAddress = (address: string) => {
    if (!address) return 'Loading...'
    return `${address.slice(0, 10)}...${address.slice(-8)}`
  }

  const canAfford = (priceUSDC: string) => {
    return balance >= parseFloat(priceUSDC)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 max-w-md">
        <VisuallyHidden>
          <DialogTitle>Get Credits</DialogTitle>
          <DialogDescription>
            {hasEnoughForPurchase
              ? `Purchase credits to sing ${songTitle} by ${songArtist}`
              : `Fund your wallet to sing ${songTitle} by ${songArtist}`}
          </DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col gap-6">
          {/* View 1: Fund Wallet (balance < 0.50) */}
          {!hasEnoughForPurchase && (
            <>
              {/* Header */}
              <div>
                <h2 className="text-3xl font-bold">Fund Wallet</h2>
                <p className="text-lg text-muted-foreground mt-1">
                  Unlock this song for $.50
                </p>
              </div>

              {/* Balance */}
              <div className="text-center py-6 px-4 rounded-lg border-2 border-border">
                <p className="text-5xl font-bold">${usdcBalance}</p>
                <p className="text-base text-muted-foreground mt-2">USDC on Base</p>
              </div>

              {/* Wallet Address */}
              <div className="space-y-2">
                <p className="text-base text-muted-foreground">Your Address:</p>
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary">
                  <code className="flex-1 text-base font-mono">
                    {formatAddress(walletAddress)}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopy}
                    className="flex-shrink-0 h-9 w-9 p-0"
                    disabled={!walletAddress}
                  >
                    {copied ? (
                      <Check size={20} className="text-green-500" />
                    ) : (
                      <Copy size={20} />
                    )}
                  </Button>
                </div>
              </div>

              {/* QR Code Toggle */}
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex items-center justify-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{showQR ? 'Hide' : 'Show'} QR Code</span>
                {showQR ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </button>

              {/* QR Code */}
              {showQR && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg">
                    <QRCodeSVG value={walletAddress || ''} size={180} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* View 2: Purchase Credits (balance >= 0.50) */}
          {hasEnoughForPurchase && (
            <>
              {/* Header */}
              <div>
                <h2 className="text-3xl font-bold">Get Credits</h2>
                <p className="text-lg text-muted-foreground mt-1">
                  One song is 1 credit
                </p>
              </div>

              {/* Balance */}
              <div className="text-center py-6 px-4 rounded-lg border-2 border-border">
                <p className="text-5xl font-bold">${usdcBalance}</p>
                <p className="text-base text-muted-foreground mt-2">USDC on Base</p>
              </div>

              {/* Credit Packages */}
              <div className="space-y-3">
                {CREDIT_PACKAGES.map((pkg) => {
                  const affordable = canAfford(pkg.priceUSDC)
                  return (
                    <div
                      key={pkg.id}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        affordable ? 'border-border' : 'border-border/50 opacity-50'
                      }`}
                    >
                      <div>
                        <p className="text-lg font-semibold">
                          {pkg.credits} {pkg.credits === 1 ? 'Song' : 'Songs'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {pkg.priceDisplay}
                        </p>
                      </div>
                      <Button
                        onClick={() => onPurchaseCredits(pkg.id)}
                        disabled={!affordable || isPurchasing}
                        variant={affordable ? 'default' : 'secondary'}
                        className="min-w-[80px]"
                      >
                        {isPurchasing ? 'Buying...' : 'Buy'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Close Button */}
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full"
            disabled={isPurchasing}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
