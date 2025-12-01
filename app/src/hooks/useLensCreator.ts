/**
 * Lens Creator Hooks
 * React hooks for fetching creator accounts and posts from Lens Protocol V3
 */

import { useAccount, usePosts, evmAddress } from '@lens-protocol/react'
import type { Account, Post, EvmAddress } from '@lens-protocol/react'

/**
 * Fetch Lens account by username
 * @param username - Local name (e.g., "idazeile" for "lens/idazeile")
 * @param namespace - Optional namespace address. If omitted, uses global lens/* namespace.
 * @returns Account data with loading/error states
 *
 * Note: By default, queries the global lens/* namespace (namespace parameter omitted).
 * Pass a namespace address to query custom namespaces.
 */
export function useLensAccount(username: string | undefined, namespace?: string) {
  const isAddress = !!username && /^0x[a-fA-F0-9]{40}$/.test(username)

  // Build request: prefer address lookup when URL param is an EVM address (e.g., post links)
  // Otherwise fall back to username (localName) with optional namespace.
  const usernameParam = !isAddress && username ? {
    localName: username,
    ...(namespace ? { namespace } : {}),
  } : undefined

  const addressParam = isAddress && username ? evmAddress(username as EvmAddress) : undefined

  return useAccount({
    ...(addressParam ? { address: addressParam } : {}),
    ...(usernameParam ? { username: usernameParam } : {}),
  })
}

/**
 * Fetch posts by creator's account address
 * Filters for posts authored by the given address
 * @param accountAddress - EVM address of the creator's account
 * @returns Posts data with loading/error states
 */
export function useLensCreatorPosts(accountAddress: string | undefined) {
  // usePosts expects an object with filter. Pass undefined filter if no address yet.
  return usePosts({
    filter: accountAddress ? {
      authors: [evmAddress(accountAddress as EvmAddress)],
    } : undefined,
  })
}

/**
 * Combined hook for creator profile data
 * Fetches both account and posts in a single hook
 * @param username - Local name of the creator (e.g., "idazeile" for "lens/idazeile")
 * @param namespace - Optional namespace address. If omitted, uses global lens/* namespace.
 * @returns Combined account and posts data
 *
 * Note: By default, all creators use the global lens/* namespace.
 * Pass a namespace address to query custom namespace creators.
 */
export function useLensCreator(username: string | undefined, namespace?: string) {
  const accountQuery = useLensAccount(username, namespace)
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
 * Export types for convenience
 */
export type { Account, Post }
