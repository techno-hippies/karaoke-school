import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

export interface SubscriptionLockData {
  unlockLockAddress?: Address
  unlockChainId?: number
}

/**
 * Fetch subscription lock address for a creator from the subgraph
 * Queries for encrypted clips by spotifyTrackId and extracts the Unlock lock address
 *
 * @param spotifyTrackIds - Array of Spotify track IDs belonging to the creator
 * @returns Lock address and chain ID if available
 */
export function useCreatorSubscriptionLock(spotifyTrackIds?: string[]) {
  return useQuery({
    queryKey: ['creator-subscription-lock', spotifyTrackIds],
    queryFn: async () => {
      if (!spotifyTrackIds || spotifyTrackIds.length === 0) {
        return { unlockLockAddress: undefined, unlockChainId: undefined }
      }

      const SUBGRAPH_ENDPOINT = 'http://localhost:8000/subgraphs/name/subgraph-0'

      // Query for the first encrypted clip by any of the creator's tracks
      const response = await fetch(SUBGRAPH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetCreatorSubscriptionLock($spotifyTrackIds: [String!]!) {
              clips(
                first: 1
                where: {
                  spotifyTrackId_in: $spotifyTrackIds
                  unlockLockAddress_not: null
                }
                orderBy: registeredAt
                orderDirection: desc
              ) {
                id
                unlockLockAddress
                unlockChainId
                encryptedFullUri
              }
            }
          `,
          variables: {
            spotifyTrackIds
          }
        })
      })

      const result = await response.json()

      if (result.errors) {
        console.error('[useCreatorSubscriptionLock] GraphQL error:', result.errors)
        return { unlockLockAddress: undefined, unlockChainId: undefined }
      }

      const clips = result.data?.clips || []

      if (clips.length === 0) {
        console.log('[useCreatorSubscriptionLock] No encrypted clips found for creator')
        return { unlockLockAddress: undefined, unlockChainId: undefined }
      }

      const clip = clips[0]
      console.log('[useCreatorSubscriptionLock] Found subscription lock:', {
        unlockLockAddress: clip.unlockLockAddress,
        unlockChainId: clip.unlockChainId
      })

      return {
        unlockLockAddress: clip.unlockLockAddress as Address | undefined,
        unlockChainId: clip.unlockChainId as number | undefined
      }
    },
    enabled: !!(spotifyTrackIds && spotifyTrackIds.length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}
