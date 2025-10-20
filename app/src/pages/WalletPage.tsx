import { WalletPageView, type TokenBalance } from '@/components/wallet/WalletPageView'

/**
 * WalletPage - Container component for wallet page
 * Handles wallet data fetching and state management
 *
 * TODO: Connect to real auth context and balance hooks
 * For now uses mock data
 */
export function WalletPage() {
  // TODO: Replace with real hooks
  // const { pkpAddress, username } = useAuth()
  // const { balances, isLoading } = useTokenBalances(pkpAddress)

  // Mock data for now
  const mockWalletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  const mockUsername = undefined // Set to username string if user has one

  const mockTokens: TokenBalance[] = [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: '1.234',
      network: 'Base',
      usdValue: '2,468.00',
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: '0.567',
      network: 'Ethereum',
      usdValue: '1,134.00',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      balance: '42.50',
      network: 'Base',
      usdValue: '42.50',
    },
  ]

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(mockWalletAddress)
      // TODO: Add toast notification
      console.log('Address copied to clipboard')
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

    // TODO: Add toast notification
    console.log(`Username @${username} purchased successfully!`)

    return true
  }

  return (
    <WalletPageView
      tokens={mockTokens}
      walletAddress={mockWalletAddress}
      currentUsername={mockUsername}
      onCopyAddress={handleCopyAddress}
      onCheckUsernameAvailability={handleCheckUsernameAvailability}
      onPurchaseUsername={handlePurchaseUsername}
    />
  )
}
