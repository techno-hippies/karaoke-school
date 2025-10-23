/**
 * Lens Protocol Hooks
 * React hooks for Lens authentication and accounts
 */

import { useState, useEffect } from 'react'
import type { SessionClient, Account } from '@lens-protocol/client'
import { resumeLensSession } from './auth'

/**
 * Hook to manage Lens session state
 */
export function useLensSession() {
  const [sessionClient, setSessionClient] = useState<SessionClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Try to resume session on mount
  useEffect(() => {
    resumeLensSession()
      .then(setSessionClient)
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [])

  return {
    sessionClient,
    setSessionClient,
    isAuthenticated: !!sessionClient,
    isLoading,
    error,
  }
}

/**
 * Hook to track current Lens account
 */
export function useLensAccount() {
  const [account, setAccount] = useState<Account | null>(null)

  return {
    account,
    setAccount,
    hasAccount: !!account,
  }
}

// Re-export specialized hooks
export { useAccountStats } from './hooks/useAccountStats'
export { useAccountPosts } from './hooks/useAccountPosts'
export type { AccountStats, UseAccountStatsResult } from './hooks/useAccountStats'
export type { LensPost, UseAccountPostsResult } from './hooks/useAccountPosts'
