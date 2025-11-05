import { WalletPageView } from '@/components/wallet/WalletPageView'
import { useAuth } from '@/contexts/AuthContext'
import { usePKPBalances } from '@/hooks/usePKPBalances'

/**
 * WalletPage - Container component for wallet page
 * Handles wallet data fetching and state management
 */
export function WalletPage() {
  const { pkpAddress, lensAccount, isPKPReady } = useAuth()
  const { balances, error } = usePKPBalances()

  // Get username from lens account if available
  const currentUsername = lensAccount?.username?.localName || undefined

  const handleCopyAddress = async () => {
    if (!pkpAddress) return
    
    try {
      await navigator.clipboard.writeText(pkpAddress)
      console.log('PKP address copied to clipboard')
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  const handleCheckUsernameAvailability = async (username: string): Promise<boolean> => {
    // TODO: Check against Lens Protocol
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    // Mock: some usernames are taken
    const takenUsernames = ['alice', 'bob', 'charlie', 'test', 'admin', 'karaoke']
    return !takenUsernames.includes(username.toLowerCase())
  }

  const handlePurchaseUsername = async (username: string): Promise<boolean> => {
    // TODO: Implement username purchase with Lens Protocol
    console.log('Purchasing username:', username)

    // Simulate purchase
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log(`Username @${username} purchased successfully!`)

    return true
  }

  // Show loading state when PKP is not ready
  if (!isPKPReady) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Connecting to your PKP Wallet</h2>
          <p className="text-muted-foreground">Please sign in to view your balances.</p>
        </div>
      </div>
    )
  }

  // Show error state if balance fetching failed
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4 text-destructive">Error Loading Balances</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <WalletPageView
      tokens={balances}
      walletAddress={pkpAddress || ''}
      currentUsername={currentUsername}
      onCopyAddress={handleCopyAddress}
      onCheckUsernameAvailability={handleCheckUsernameAvailability}
      onPurchaseUsername={handlePurchaseUsername}
    />
  )
}
