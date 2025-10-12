/**
 * useUSDCBalance
 * Hook to read USDC balance for an address on Base Sepolia
 *
 * Pattern: Uses viem's createPublicClient directly (no wagmi)
 * - Dynamic imports for tree-shaking
 * - Polling with useEffect + setInterval
 * - Same pattern as useContractSongs and AuthContext.loadCredits
 */

import { useState, useEffect } from 'react'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

export interface UseUSDCBalanceResult {
  balance: string
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Read USDC balance for given address
 */
export function useUSDCBalance(address: string | undefined): UseUSDCBalanceResult {
  const [balance, setBalance] = useState<string>('0.00')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadBalance = async () => {
    if (!address) {
      setBalance('0.00')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Dynamic imports (same pattern as AuthContext.loadCredits)
      const { createPublicClient, http, formatUnits } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const data = await publicClient.readContract({
        address: BASE_SEPOLIA_CONTRACTS.usdc,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      })

      // USDC has 6 decimals
      const formatted = formatUnits(data as bigint, 6)
      setBalance(formatted)
    } catch (err) {
      console.error('[useUSDCBalance] Failed to load balance:', err)
      setError(err instanceof Error ? err : new Error('Failed to load balance'))
      setBalance('0.00')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load when address changes + poll every 10 seconds
  useEffect(() => {
    if (!address) return

    loadBalance()
    const interval = setInterval(loadBalance, 10000)
    return () => clearInterval(interval)
  }, [address])

  return {
    balance,
    isLoading,
    error,
    refetch: loadBalance,
  }
}
