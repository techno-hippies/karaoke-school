/**
 * useSubscription Hook
 *
 * Manages subscription state for Unlock Protocol locks
 * Similar to useUnlockSong but for creator subscriptions
 *
 * Responsibilities:
 * - Check if user has valid subscription key
 * - Fetch lock pricing info
 * - Handle subscription purchase via PKP
 * - Refresh subscription status after purchase
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PKPAuthContext, PKPInfo } from '@/lib/lit-webauthn/types'
import { checkSubscription, getLockInfo, type LockInfo } from '@/lib/subscriptions/queries'
import { purchaseSubscription } from '@/lib/subscriptions/purchase'
import type { Hash } from 'viem'

export interface SubscriptionPurchaseResult {
  success: boolean
  txHash?: Hash
  keyPrice?: bigint
  error?: string
}

export interface UseSubscriptionOptions {
  lockAddress?: string
  userAddress?: string
  pkpAuthContext?: PKPAuthContext | null
  pkpInfo?: PKPInfo | null
}

export function useSubscription({
  lockAddress,
  userAddress,
  pkpAuthContext,
  pkpInfo,
}: UseSubscriptionOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  // Start as true to prevent subscription panel flash while checking
  const [isLoading, setIsLoading] = useState(true)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Prevent duplicate purchases
  const isPurchasingRef = useRef(false)

  // Check subscription status
  const checkStatus = useCallback(async () => {
    if (!lockAddress || !userAddress) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [hasKey, info] = await Promise.all([
        checkSubscription(lockAddress, userAddress),
        getLockInfo(lockAddress),
      ])

      console.log('[useSubscription] Status check:', {
        lockAddress,
        userAddress,
        hasKey,
        price: info.keyPriceFormatted,
        duration: `${info.durationDays} days`,
      })

      setIsSubscribed(hasKey)
      setLockInfo(info)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check subscription'
      console.error('[useSubscription] ❌ Error checking status:', errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [lockAddress, userAddress])

  // Check status on mount and when dependencies change
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Purchase subscription
  const subscribe = useCallback(async (): Promise<SubscriptionPurchaseResult> => {
    // Guard against duplicate calls
    if (isPurchasingRef.current) {
      console.log('[useSubscription] Already purchasing, skipping...')
      return { success: false, error: 'Already purchasing' }
    }

    if (!lockAddress || !pkpAuthContext || !pkpInfo) {
      const error = 'Missing lock address or PKP auth context'
      console.error('[useSubscription]', error)
      setError(error)
      return { success: false, error }
    }

    isPurchasingRef.current = true
    setIsPurchasing(true)
    setError(null)

    try {
      console.log('[useSubscription] Purchasing subscription...', {
        lockAddress,
        buyer: pkpInfo.ethAddress,
      })

      const result = await purchaseSubscription(lockAddress, pkpAuthContext, pkpInfo)

      console.log('[useSubscription] ✅ Purchase complete!', {
        txHash: result.txHash,
        keyPrice: result.keyPrice.toString(),
      })

      // Wait for indexing, then recheck status
      console.log('[useSubscription] Waiting for indexing...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      const hasKey = await checkSubscription(lockAddress, pkpInfo.ethAddress)
      setIsSubscribed(hasKey)

      if (!hasKey) {
        console.warn('[useSubscription] ⚠️ Purchase succeeded but key not found (may need more time to index)')
      }

      return {
        success: true,
        txHash: result.txHash,
        keyPrice: result.keyPrice,
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to purchase subscription'
      console.error('[useSubscription] ❌ Purchase failed:', errorMsg)
      setError(errorMsg)

      return {
        success: false,
        error: errorMsg,
      }

    } finally {
      isPurchasingRef.current = false
      setIsPurchasing(false)
    }
  }, [lockAddress, pkpAuthContext, pkpInfo])

  // Refresh status (can be called manually)
  const refresh = useCallback(() => {
    checkStatus()
  }, [checkStatus])

  return {
    // Status
    isSubscribed,
    isLoading,
    isPurchasing,
    error,

    // Lock info
    lockInfo,
    keyPrice: lockInfo?.keyPriceFormatted,
    durationDays: lockInfo?.durationDays,

    // Actions
    subscribe,
    refresh,
  }
}
