/**
 * Followers Hook
 * Fetches the list of followers for an account
 */

import { useQuery } from '@tanstack/react-query'
import { lensClient } from '@/lib/lens/client'
import { getFollowers, type Follower } from '@/lib/lens/follow'

interface UseFollowersOptions {
  /**
   * Account address to fetch followers for
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

interface UseFollowersReturn {
  /** List of followers */
  followers: Follower[]

  /** Total count of followers */
  count: number

  /** Whether the query is loading */
  isLoading: boolean

  /** Error from the query */
  error: Error | null

  /** Refetch the followers list */
  refetch: () => void
}

/**
 * Hook for fetching followers of an account
 *
 * @example
 * ```tsx
 * const { followers, count, isLoading } = useFollowers({
 *   accountAddress: '0x1234...'
 * })
 * ```
 */
export function useFollowers({
  accountAddress,
  graphAddress,
  enabled = true,
}: UseFollowersOptions): UseFollowersReturn {
  const query = useQuery({
    queryKey: ['followers', accountAddress, graphAddress],
    queryFn: async () => {
      if (!accountAddress) {
        throw new Error('Account address is required')
      }

      return await getFollowers(lensClient as any, accountAddress, graphAddress)
    },
    enabled: enabled && !!accountAddress,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  return {
    followers: (query.data?.items ?? []) as Follower[],
    count: query.data?.items?.length ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
