/**
 * Lens Follow Operations
 * Handle following and unfollowing accounts
 */

import { follow, unfollow, fetchFollowers, fetchFollowing } from '@lens-protocol/client/actions'
import { handleOperationWith } from '@lens-protocol/client/viem'
import { evmAddress } from '@lens-protocol/client'
import type { SessionClient, Account, EvmAddress, PublicClient, Paginated } from '@lens-protocol/client'
import type { WalletClient } from 'viem'

export interface FollowResult {
  success: boolean
  error?: string
}

/**
 * Follow an account on Lens
 * @param sessionClient Authenticated Lens session
 * @param walletClient Wallet for signing transactions
 * @param targetAccountAddress Address of account to follow
 * @returns Result of follow operation
 */
export async function followAccount(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  targetAccountAddress: string
): Promise<FollowResult> {
  try {
    // Step 1: Create follow operation
    const followResult = await follow(sessionClient, {
      account: evmAddress(targetAccountAddress as EvmAddress),
    })

    if (followResult.isErr()) {
      // Handle "already following" error gracefully
      if (followResult.error.message.includes('already following')) {
        return { success: true } // Already following is success
      }
      return {
        success: false,
        error: followResult.error.message,
      }
    }

    // Step 2: Handle transaction
    const txResult = await handleOperationWith(walletClient as any)(followResult.value)

    if (txResult.isErr()) {
      return {
        success: false,
        error: txResult.error.message,
      }
    }

    // Step 3: Wait for confirmation
    const confirmation = await sessionClient.waitForTransaction(txResult.value)

    if (confirmation.isErr()) {
      // Transaction may still succeed even if indexer times out
      return { success: true } // Optimistically assume success
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Unfollow an account on Lens
 * @param sessionClient Authenticated Lens session
 * @param walletClient Wallet for signing transactions
 * @param targetAccountAddress Address of account to unfollow
 * @returns Result of unfollow operation
 */
export async function unfollowAccount(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  targetAccountAddress: string
): Promise<FollowResult> {
  try {
    // Step 1: Create unfollow operation
    const unfollowResult = await unfollow(sessionClient, {
      account: evmAddress(targetAccountAddress as EvmAddress),
    })

    if (unfollowResult.isErr()) {
      // Handle "not following" error gracefully
      if (unfollowResult.error.message.includes('not following')) {
        return { success: true } // Not following is success
      }
      return {
        success: false,
        error: unfollowResult.error.message,
      }
    }

    // Step 2: Handle transaction
    const txResult = await handleOperationWith(walletClient as any)(unfollowResult.value)

    if (txResult.isErr()) {
      return {
        success: false,
        error: txResult.error.message,
      }
    }

    // Step 3: Wait for confirmation
    const confirmation = await sessionClient.waitForTransaction(txResult.value)

    if (confirmation.isErr()) {
      // Transaction may still succeed even if indexer times out
      return { success: true } // Optimistically assume success
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Follower data (from Lens API)
 */
export interface Follower {
  follower: Account
  followedOn: string
}

/**
 * Following data (from Lens API)
 */
export interface Following {
  following: Account
  followedOn: string
}

/**
 * Fetch followers of an account
 * @param client Lens public or session client
 * @param accountAddress Address of account to fetch followers for
 * @param graphAddress Optional graph address (defaults to app graph)
 * @returns Paginated list of followers
 */
export async function getFollowers(
  client: PublicClient | SessionClient,
  accountAddress: string,
  graphAddress?: string
): Promise<Paginated<Follower>> {
  const result = await fetchFollowers(client as any, {
    account: evmAddress(accountAddress as EvmAddress),
    ...(graphAddress ? { filter: { graphs: [{ graph: evmAddress(graphAddress as EvmAddress) }] } } : {}),
  })

  if (result.isErr()) {
    throw new Error(`Failed to fetch followers: ${result.error.message}`)
  }

  return result.value as unknown as Paginated<Follower>
}

/**
 * Fetch accounts that a given account is following
 * @param client Lens public or session client
 * @param accountAddress Address of account to fetch following for
 * @param graphAddress Optional graph address (defaults to app graph)
 * @returns Paginated list of following
 */
export async function getFollowing(
  client: PublicClient | SessionClient,
  accountAddress: string,
  graphAddress?: string
): Promise<Paginated<Following>> {
  const result = await fetchFollowing(client as any, {
    account: evmAddress(accountAddress as EvmAddress),
    ...(graphAddress ? { filter: { graphs: [{ graph: evmAddress(graphAddress as EvmAddress) }] } } : {}),
  })

  if (result.isErr()) {
    throw new Error(`Failed to fetch following: ${result.error.message}`)
  }

  return result.value as unknown as Paginated<Following>
}
