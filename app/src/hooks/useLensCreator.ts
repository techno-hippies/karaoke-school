/**
 * Lens Creator Hooks
 * React hooks for fetching creator accounts and posts from Lens Protocol V3
 */

import { useAccount, usePosts, evmAddress } from '@lens-protocol/react'
import type { Account, Post, EvmAddress } from '@lens-protocol/react'

/**
 * Fetch Lens account by username
 * @param username - Local name (e.g., "brookemonk" for "kschool2/brookemonk")
 * @param namespace - Namespace address (defaults to kschool2 custom namespace: "0xa304467aD0C296C2bb11079Bc2748223568D463e")
 * @returns Account data with loading/error states
 *
 * Note: For custom namespaces, account.username field returns null.
 * Must query username separately with namespace parameter.
 */
export function useLensAccount(username: string | undefined, namespace?: string) {
  // Default to kschool2 custom namespace
  const customNamespace = namespace || '0xa304467aD0C296C2bb11079Bc2748223568D463e'

  console.log('[useLensAccount] Called with username:', username, 'namespace:', customNamespace)
  const result = useAccount({
    username: username ? {
      localName: username,
      namespace: customNamespace,
    } : undefined,
  })
  console.log('[useLensAccount] Result:', {
    data: result.data,
    loading: result.loading,
    error: result.error
  })
  if (result.data) {
    console.log('[useLensAccount] Account details:', {
      address: result.data.address,
      username: result.data.username,
      metadata: result.data.metadata,
    })
  }
  return result
}

/**
 * Fetch posts by creator's account address
 * Filters for posts authored by the given address
 * @param accountAddress - EVM address of the creator's account
 * @returns Posts data with loading/error states
 */
export function useLensCreatorPosts(accountAddress: string | undefined) {
  console.log('[useLensCreatorPosts] Called with accountAddress:', accountAddress)

  // usePosts expects an object with filter. Pass undefined filter if no address yet.
  const result = usePosts({
    filter: accountAddress ? {
      authors: [evmAddress(accountAddress as EvmAddress)],
    } : undefined,
  })

  console.log('[useLensCreatorPosts] Result:', { data: result.data, loading: result.loading, error: result.error })
  return result
}

/**
 * Combined hook for creator profile data
 * Fetches both account and posts in a single hook
 * @param username - Local name of the creator (e.g., "brookemonk" for "kschool2/brookemonk")
 * @param namespace - Namespace address (defaults to kschool2: "0xa304467aD0C296C2bb11079Bc2748223568D463e")
 * @returns Combined account and posts data
 *
 * Note: All creators use the kschool2 custom namespace by default.
 */
export function useLensCreator(username: string | undefined, namespace?: string) {
  // Default to kschool2 custom namespace
  const customNamespace = namespace || '0xa304467aD0C296C2bb11079Bc2748223568D463e'

  const accountQuery = useLensAccount(username, customNamespace)
  const postsQuery = useLensCreatorPosts(accountQuery.data?.address)

  return {
    account: accountQuery.data,
    posts: postsQuery.data,
    isLoadingAccount: accountQuery.loading,
    isLoadingPosts: postsQuery.loading,
    accountError: accountQuery.error,
    postsError: postsQuery.error,
    isLoading: accountQuery.loading || postsQuery.loading,
    error: accountQuery.error || postsQuery.error,
  }
}

/**
 * Type guard to check if a post has VideoMetadata
 */
export function isVideoPost(post: Post): boolean {
  return post.metadata?.__typename === 'VideoMetadata'
}

/**
 * Type guard to check if an account is verified
 * Uses account.score as a proxy for verification status
 * @param account - Lens account
 * @param threshold - Score threshold for verification (default: 50)
 */
export function isVerifiedAccount(account: Account, threshold = 50): boolean {
  return (account.score ?? 0) >= threshold
}

/**
 * Export types for convenience
 */
export type { Account, Post }
