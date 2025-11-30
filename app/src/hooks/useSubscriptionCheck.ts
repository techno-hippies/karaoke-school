/**
 * useSubscriptionCheck
 *
 * Simple hook to check if user has an active subscription (NFT) for an artist.
 * Used as fallback when v2 encryption metadata is not available.
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { useAuth } from '@/contexts/AuthContext'
import { ARTIST_SUBSCRIPTION_LOCKS } from '@/lib/contracts/addresses'

interface UseSubscriptionCheckResult {
  hasSubscription: boolean
  isLoading: boolean
  error?: string
}

/**
 * Check if user has subscription for an artist
 *
 * @param artistSlug - Artist slug (e.g., 'queen', 'britney-spears')
 * @param recheckTrigger - Increment to force re-check after purchase
 */
export function useSubscriptionCheck(
  artistSlug?: string,
  recheckTrigger?: number
): UseSubscriptionCheckResult {
  const { pkpInfo } = useAuth()
  const [hasSubscription, setHasSubscription] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    // Reset state
    setHasSubscription(false)
    setError(undefined)

    if (!artistSlug || !pkpInfo?.ethAddress) {
      console.log('[useSubscriptionCheck] Missing artistSlug or pkpInfo:', { artistSlug, pkpInfo: !!pkpInfo })
      return
    }

    const lockConfig = ARTIST_SUBSCRIPTION_LOCKS[artistSlug.toLowerCase()]
    if (!lockConfig) {
      console.log('[useSubscriptionCheck] No lock configured for artist:', artistSlug)
      return
    }

    const checkSubscription = async () => {
      setIsLoading(true)
      console.log('[useSubscriptionCheck] Checking subscription for:', {
        artistSlug,
        lockAddress: lockConfig.lockAddress,
        userAddress: pkpInfo.ethAddress,
      })

      try {
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        })

        const balance = await publicClient.readContract({
          address: lockConfig.lockAddress,
          abi: [
            {
              inputs: [{ name: '_owner', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ] as const,
          functionName: 'balanceOf',
          args: [pkpInfo.ethAddress as Address],
        } as any)

        console.log('[useSubscriptionCheck] NFT balance:', (balance as bigint).toString())
        setHasSubscription((balance as bigint) > 0n)
      } catch (err) {
        console.error('[useSubscriptionCheck] Error checking subscription:', err)
        setError(err instanceof Error ? err.message : 'Failed to check subscription')
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [artistSlug, pkpInfo?.ethAddress, recheckTrigger])

  return { hasSubscription, isLoading, error }
}
