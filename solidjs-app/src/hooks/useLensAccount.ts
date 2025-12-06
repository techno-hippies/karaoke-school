/**
 * Hook to fetch a Lens account by username handle
 */

import { createResource } from 'solid-js'
import { GraphQLClient } from 'graphql-request'
import { ACCOUNT_QUERY, type AccountResponse } from '@/lib/lens/mutations'
import { LENS_CUSTOM_NAMESPACE } from '@/lib/lens/config'

const LENS_GRAPHQL_ENDPOINT =
  import.meta.env.VITE_LENS_ENVIRONMENT === 'mainnet'
    ? 'https://api.lens.xyz/graphql'
    : 'https://api.testnet.lens.xyz/graphql'

const graphqlClient = new GraphQLClient(LENS_GRAPHQL_ENDPOINT)

export interface LensAccountData {
  address: string
  owner: string
  username?: string
  localName?: string
  displayName?: string
  bio?: string
  avatarUrl?: string
  coverPictureUrl?: string
}

interface UseLensAccountResult {
  account: () => LensAccountData | null
  isLoading: () => boolean
  error: () => Error | null
  refetch: () => void
}

/**
 * Fetch a Lens account by username handle (e.g., "scarlett-ks")
 *
 * @param handle - The username handle (without @)
 * @returns Account data, loading state, and error
 */
export function useLensAccount(handle: () => string | undefined): UseLensAccountResult {
  const fetchAccount = async (username: string | undefined): Promise<LensAccountData | null> => {
    if (!username) return null

    try {
      const result = await graphqlClient.request<{ account: AccountResponse | null }>(
        ACCOUNT_QUERY,
        {
          request: {
            username: {
              localName: username.replace('kschool2/', ''),
              namespace: LENS_CUSTOM_NAMESPACE,
            },
          },
        }
      )

      if (!result.account) {
        return null
      }

      const acc = result.account
      return {
        address: acc.address,
        owner: acc.owner,
        username: acc.username?.localName,
        localName: acc.username?.localName,
        displayName: acc.metadata?.name || acc.username?.localName,
        bio: acc.metadata?.bio,
        avatarUrl: acc.metadata?.picture,
        coverPictureUrl: acc.metadata?.coverPicture,
      }
    } catch (err) {
      console.error('[useLensAccount] Error fetching account:', err)
      throw err
    }
  }

  const [resource, { refetch }] = createResource(handle, fetchAccount)

  return {
    account: () => resource() ?? null,
    isLoading: () => resource.loading,
    error: () => resource.error ?? null,
    refetch,
  }
}

/**
 * Fetch a Lens account by address
 *
 * @param address - The account address
 * @returns Account data, loading state, and error
 */
export function useLensAccountByAddress(address: () => string | undefined): UseLensAccountResult {
  const fetchAccount = async (addr: string | undefined): Promise<LensAccountData | null> => {
    if (!addr) return null

    try {
      const result = await graphqlClient.request<{ account: AccountResponse | null }>(
        ACCOUNT_QUERY,
        {
          request: {
            address: addr,
          },
        }
      )

      if (!result.account) {
        return null
      }

      const acc = result.account
      return {
        address: acc.address,
        owner: acc.owner,
        username: acc.username?.localName,
        localName: acc.username?.localName,
        displayName: acc.metadata?.name || acc.username?.localName,
        bio: acc.metadata?.bio,
        avatarUrl: acc.metadata?.picture,
        coverPictureUrl: acc.metadata?.coverPicture,
      }
    } catch (err) {
      console.error('[useLensAccountByAddress] Error fetching account:', err)
      throw err
    }
  }

  const [resource, { refetch }] = createResource(address, fetchAccount)

  return {
    account: () => resource() ?? null,
    isLoading: () => resource.loading,
    error: () => resource.error ?? null,
    refetch,
  }
}
