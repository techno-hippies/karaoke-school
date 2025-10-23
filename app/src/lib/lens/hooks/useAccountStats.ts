/**
 * useAccountStats Hook
 * Fetch follower/following counts for a Lens account
 *
 * Uses Lens SDK's built-in follower/following queries
 */

import { useState, useEffect } from 'react'
import type { EvmAddress } from '@lens-protocol/client'
import { fetchAccount } from '@lens-protocol/client/actions'
import { evmAddress } from '@lens-protocol/client'
import { lensClient } from '../client'

export interface AccountStats {
  followers: number
  following: number
}

export interface UseAccountStatsResult {
  followers: number
  following: number
  isLoading: boolean
  error: Error | null
}

/**
 * Fetch account stats (followers/following counts)
 *
 * @param accountAddress - Lens account address (not PKP address)
 * @returns Account stats with loading/error state
 *
 * @example
 * ```tsx
 * const { followers, following, isLoading } = useAccountStats(lensAccount?.address)
 * ```
 */
export function useAccountStats(accountAddress: string | undefined): UseAccountStatsResult {
  const [stats, setStats] = useState<AccountStats>({ followers: 0, following: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!accountAddress) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadStats() {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch account with stats
        const result = await fetchAccount(lensClient as any, {
          address: evmAddress(accountAddress as EvmAddress),
        })

        if (result.isErr()) {
          throw new Error(`Failed to fetch account: ${result.error.message}`)
        }

        if (cancelled) return

        const account = result.value

        // TODO: Extract actual follower/following counts from account object
        // Lens SDK should expose this via account.stats or similar
        // For now, scaffold with defaults until we verify the exact API
        setStats({
          followers: 0, // account.stats?.followers || 0
          following: 0, // account.stats?.following || 0
        })

        console.log('[useAccountStats] Account data:', account)
        console.log('[useAccountStats] TODO: Extract stats.followers and stats.following from account object')

      } catch (err) {
        if (cancelled) return
        console.error('[useAccountStats] Error:', err)
        setError(err as Error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [accountAddress])

  return {
    ...stats,
    isLoading,
    error,
  }
}
