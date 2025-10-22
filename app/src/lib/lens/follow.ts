/**
 * Lens Follow Operations
 * Handle following and unfollowing accounts
 */

import { follow, unfollow } from '@lens-protocol/client/actions'
import { handleOperationWith } from '@lens-protocol/client/viem'
import { evmAddress } from '@lens-protocol/client'
import type { SessionClient, Account, EvmAddress } from '@lens-protocol/client'
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
    console.log('[Lens Follow] Starting follow operation for:', targetAccountAddress)

    // Step 1: Create follow operation
    const followResult = await follow(sessionClient, {
      account: evmAddress(targetAccountAddress as EvmAddress),
    })

    if (followResult.isErr()) {
      console.error('[Lens Follow] Follow operation failed:', followResult.error)
      return {
        success: false,
        error: followResult.error.message,
      }
    }

    console.log('[Lens Follow] Follow operation created, signing transaction...')

    // Step 2: Handle transaction
    const txResult = await handleOperationWith(walletClient as any)(followResult.value)

    if (txResult.isErr()) {
      console.error('[Lens Follow] Transaction failed:', txResult.error)
      return {
        success: false,
        error: txResult.error.message,
      }
    }

    console.log('[Lens Follow] Transaction submitted:', txResult.value)

    // Step 3: Wait for confirmation
    const confirmation = await sessionClient.waitForTransaction(txResult.value)

    if (confirmation.isErr()) {
      // Transaction may still succeed even if indexer times out
      console.warn('[Lens Follow] Indexer timeout, but transaction may have succeeded')
      return {
        success: true, // Optimistically assume success
      }
    }

    console.log('[Lens Follow] Follow operation completed successfully')
    return { success: true }
  } catch (error) {
    console.error('[Lens Follow] Unexpected error:', error)
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
    console.log('[Lens Unfollow] Starting unfollow operation for:', targetAccountAddress)

    // Step 1: Create unfollow operation
    const unfollowResult = await unfollow(sessionClient, {
      account: evmAddress(targetAccountAddress as EvmAddress),
    })

    if (unfollowResult.isErr()) {
      console.error('[Lens Unfollow] Unfollow operation failed:', unfollowResult.error)
      return {
        success: false,
        error: unfollowResult.error.message,
      }
    }

    console.log('[Lens Unfollow] Unfollow operation created, signing transaction...')

    // Step 2: Handle transaction
    const txResult = await handleOperationWith(walletClient as any)(unfollowResult.value)

    if (txResult.isErr()) {
      console.error('[Lens Unfollow] Transaction failed:', txResult.error)
      return {
        success: false,
        error: txResult.error.message,
      }
    }

    console.log('[Lens Unfollow] Transaction submitted:', txResult.value)

    // Step 3: Wait for confirmation
    const confirmation = await sessionClient.waitForTransaction(txResult.value)

    if (confirmation.isErr()) {
      // Transaction may still succeed even if indexer times out
      console.warn('[Lens Unfollow] Indexer timeout, but transaction may have succeeded')
      return {
        success: true, // Optimistically assume success
      }
    }

    console.log('[Lens Unfollow] Unfollow operation completed successfully')
    return { success: true }
  } catch (error) {
    console.error('[Lens Unfollow] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if a logged-in account can follow a target account
 * Uses the account.operations.canFollow field
 */
export function canFollowAccount(account: Account | null): boolean {
  if (!account?.operations?.canFollow) {
    return false
  }

  return account.operations.canFollow.__typename === 'AccountFollowOperationValidationPassed'
}

/**
 * Check if the logged-in account is following the target account
 */
export function isFollowingAccount(account: Account | null): boolean {
  return account?.operations?.isFollowedByMe ?? false
}
