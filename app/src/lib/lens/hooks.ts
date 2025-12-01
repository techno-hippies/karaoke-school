/**
 * Lens Protocol Hooks
 * React hooks for Lens authentication and accounts
 */

import { useState } from 'react'
import type { Account } from '@lens-protocol/client'

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
