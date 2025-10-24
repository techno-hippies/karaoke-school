/**
 * Follow Hook
 * Manages following/unfollowing accounts on Lens
 */

import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { followAccount, unfollowAccount } from '@/lib/lens/follow'
import { evmAddress } from '@lens-protocol/react'
import type { EvmAddress } from '@lens-protocol/react'
import { lensClient } from '@/lib/lens/client'
import { fetchAccount } from '@lens-protocol/client/actions'

interface UseFollowOptions {
  /**
   * Target account address to follow/unfollow
   */
  targetAccountAddress: string

  /**
   * Whether to automatically fetch follow status on mount
   * @default true
   */
  enabled?: boolean
}

interface UseFollowReturn {
  /** Whether the current user is following the target account */
  isFollowing: boolean

  /** Whether the current user can follow this account */
  canFollow: boolean

  /** Follow the target account */
  follow: () => Promise<void>

  /** Unfollow the target account */
  unfollow: () => Promise<void>

  /** Whether a follow/unfollow operation is in progress */
  isLoading: boolean

  /** Error from follow/unfollow operation */
  error: Error | null
}

/**
 * Hook for following/unfollowing accounts
 *
 * @example
 * ```tsx
 * const { isFollowing, canFollow, follow, unfollow, isLoading } = useFollow({
 *   targetAccountAddress: '0x1234...'
 * })
 * ```
 */
export function useFollow({
  targetAccountAddress,
}: UseFollowOptions): UseFollowReturn {
  const { lensSession, pkpWalletClient, hasLensAccount } = useAuth()
  const queryClient = useQueryClient()
  const [localIsFollowing, setLocalIsFollowing] = useState(false)

  // Fetch target account with operations field to check follow status
  // Only fetch if we have a valid address
  const hasValidAddress = !!(targetAccountAddress && targetAccountAddress.length > 0)

  // Fetch account with operations using Lens client directly
  const { data: accountResult } = useQuery({
    queryKey: ['account', targetAccountAddress, hasLensAccount],
    queryFn: async () => {
      if (!hasValidAddress) return null

      // Use session client when available for operations, otherwise use public client
      const client = lensSession || lensClient
      const result = await fetchAccount(client as any, {
        address: evmAddress(targetAccountAddress as EvmAddress),
      })

      if (result.isErr()) {
        console.error('[useFollow] fetchAccount error:', result.error)
        return null
      }

      return result.value
    },
    enabled: hasValidAddress,
    staleTime: 30000,
    // Refetch when hasLensAccount changes (when session becomes available)
  })

  const targetAccount = accountResult

  // Extract follow status from account operations
  const isFollowing = targetAccount?.operations?.isFollowedByMe ?? localIsFollowing
  const canFollow = !!(hasLensAccount && hasValidAddress && targetAccount?.operations?.canFollow?.__typename === 'AccountFollowOperationValidationPassed')

  // Update local state when server state changes
  useEffect(() => {
    if (targetAccount?.operations?.isFollowedByMe !== undefined) {
      setLocalIsFollowing(targetAccount.operations.isFollowedByMe)
    }
  }, [targetAccount?.operations?.isFollowedByMe])

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!lensSession || !pkpWalletClient) {
        throw new Error('Not authenticated')
      }

      const result = await followAccount(
        lensSession as any,
        pkpWalletClient,
        targetAccountAddress
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to follow account')
      }
    },
    onMutate: async () => {
      // Optimistic update
      setLocalIsFollowing(true)
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data (silent refresh)
      queryClient.invalidateQueries({ queryKey: ['account', targetAccountAddress] })
      queryClient.invalidateQueries({ queryKey: ['followers', targetAccountAddress] })
      queryClient.invalidateQueries({ queryKey: ['following'] })
    },
    onError: () => {
      // Rollback optimistic update
      setLocalIsFollowing(false)
    },
  })

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!lensSession || !pkpWalletClient) {
        throw new Error('Not authenticated')
      }

      const result = await unfollowAccount(
        lensSession as any,
        pkpWalletClient,
        targetAccountAddress
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to unfollow account')
      }
    },
    onMutate: async () => {
      // Optimistic update
      setLocalIsFollowing(false)
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data (silent refresh)
      queryClient.invalidateQueries({ queryKey: ['account', targetAccountAddress] })
      queryClient.invalidateQueries({ queryKey: ['followers', targetAccountAddress] })
      queryClient.invalidateQueries({ queryKey: ['following'] })
    },
    onError: () => {
      // Rollback optimistic update
      setLocalIsFollowing(true)
    },
  })

  const follow = useCallback(async () => {
    if (!canFollow) return
    await followMutation.mutateAsync()
  }, [canFollow, followMutation])

  const unfollow = useCallback(async () => {
    await unfollowMutation.mutateAsync()
  }, [unfollowMutation])

  // Smart toggle function - follows if not following, unfollows if following
  const toggle = useCallback(async () => {
    if (isFollowing) {
      await unfollow()
    } else {
      await follow()
    }
  }, [isFollowing, follow, unfollow])

  return {
    isFollowing,
    canFollow,
    follow: toggle, // Use toggle as the main action
    unfollow,
    isLoading: followMutation.isPending || unfollowMutation.isPending,
    error: followMutation.error || unfollowMutation.error,
  }
}
