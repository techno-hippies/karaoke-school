import { useMemo } from 'react'
import type { Address } from 'viem'
import { ARTIST_SUBSCRIPTION_LOCKS } from '@/lib/contracts/addresses'

export interface SubscriptionLockData {
  unlockLockAddress?: Address
  unlockChainId?: number
}

/**
 * Get subscription lock address for an artist
 * Uses static config mapping artist slugs to their Unlock Protocol lock addresses
 *
 * @param artistSlug - The artist's slug (e.g., 'queen', 'britney-spears')
 * @returns Lock address and chain ID if available
 */
export function useCreatorSubscriptionLock(artistSlug?: string) {
  return useMemo(() => {
    if (!artistSlug) {
      return {
        data: { unlockLockAddress: undefined, unlockChainId: undefined },
        isLoading: false,
      }
    }

    const lockConfig = ARTIST_SUBSCRIPTION_LOCKS[artistSlug.toLowerCase()]

    if (!lockConfig) {
      console.log('[useCreatorSubscriptionLock] No subscription lock configured for artist:', artistSlug)
      return {
        data: { unlockLockAddress: undefined, unlockChainId: undefined },
        isLoading: false,
      }
    }

    console.log('[useCreatorSubscriptionLock] Found subscription lock for', artistSlug, ':', {
      unlockLockAddress: lockConfig.lockAddress,
      unlockChainId: lockConfig.chainId,
    })

    return {
      data: {
        unlockLockAddress: lockConfig.lockAddress as Address,
        unlockChainId: lockConfig.chainId,
      },
      isLoading: false,
    }
  }, [artistSlug])
}
