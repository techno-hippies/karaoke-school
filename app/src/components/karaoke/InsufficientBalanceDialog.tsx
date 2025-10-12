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

interface InsufficientBalanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songTitle: string
  songArtist: string
  walletAddress: string
  balance?: string
}

/**
 * InsufficientBalanceDialog - Clean, minimal dialog for funding PKP wallet
 */
export function InsufficientBalanceDialog({
  open,
  onOpenChange,
  songTitle,
  songArtist,
  walletAddress,
  balance,
}: InsufficientBalanceDialogProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 max-w-md">
        <VisuallyHidden>
          <DialogTitle>Fund Wallet</DialogTitle>
          <DialogDescription>
            Send USDC to continue singing {songTitle} by {songArtist}
          </DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col gap-6">
          {/* Title */}
          <div>
            <h2 className="text-3xl font-bold">Fund Wallet</h2>
            <p className="text-lg text-muted-foreground mt-1">Unlock this song for $.50</p>
          </div>

          {/* Balance */}
          {balance !== undefined && (
            <div className="text-center py-6 px-4 rounded-lg border-2 border-border">
              <p className="text-5xl font-bold">${balance}</p>
              <p className="text-base text-muted-foreground mt-2">USDC on Base</p>
            </div>
          )}

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

          {/* Close */}
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
