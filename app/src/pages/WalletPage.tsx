import { useAuth } from '@/contexts/AuthContext'
import { useUSDCBalance } from '@/hooks/useUSDCBalance'
import { WalletPageView } from '@/components/wallet/WalletPageView'
import { toast } from 'sonner'

/**
 * WalletPage - Container component for wallet page
 * Handles wallet data fetching and state management
 * Presentation logic delegated to WalletPageView
 */
export function WalletPage() {
  const { pkpAddress, credits } = useAuth()
  const { balance: usdcBalance, isLoading: usdcLoading } = useUSDCBalance(pkpAddress)

  const handleCopyAddress = async () => {
    if (!pkpAddress) return

    try {
      await navigator.clipboard.writeText(pkpAddress)
      toast.success('Address copied to clipboard')
    } catch (err) {
      console.error('Failed to copy address:', err)
      toast.error('Failed to copy address')
    }
  }

  // Loading state
  if (usdcLoading && !usdcBalance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground">Loading wallet...</div>
      </div>
    )
  }

  return (
    <WalletPageView
      creditsBalance={credits}
      usdcBalance={usdcBalance}
      walletAddress={pkpAddress || ''}
      onCopyAddress={handleCopyAddress}
    />
  )
}
