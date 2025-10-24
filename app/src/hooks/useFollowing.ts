/**
 * Following Hook
 * Fetches the list of accounts that a given account is following
 */

import { useQuery } from '@tanstack/react-query'
import { lensClient } from '@/lib/lens/client'
import { getFollowing, type Following } from '@/lib/lens/follow'

interface UseFollowingOptions {
  /**
   * Account address to fetch following for
   */
  accountAddress: string | undefined

  /**
   * Optional graph address (defaults to app graph)
   */
  graphAddress?: string

  /**
   * Whether to enable the query
   * @default true
   */
  enabled?: boolean
}

interface UseFollowingReturn {
  /** List of accounts being followed */
  following: Following[]

  /** Total count of following */
  count: number

  /** Whether the query is loading */
  isLoading: boolean

  /** Error from the query */
  error: Error | null

  /** Refetch the following list */
  refetch: () => void
}

/**
 * Hook for fetching accounts that a given account is following
 *
 * @example
 * ```tsx
 * const { following, count, isLoading } = useFollowing({
 *   accountAddress: '0x1234...'
 * })
 * ```
 */
export function useFollowing({
  accountAddress,
  graphAddress,
  enabled = true,
}: UseFollowingOptions): UseFollowingReturn {
  const query = useQuery({
    queryKey: ['following', accountAddress, graphAddress],
    queryFn: async () => {
      if (!accountAddress) {
        throw new Error('Account address is required')
      }

      return await getFollowing(lensClient as any, accountAddress, graphAddress)
    },
    enabled: enabled && !!accountAddress,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  return {
    following: (query.data?.items ?? []) as Following[],
    count: query.data?.items?.length ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
