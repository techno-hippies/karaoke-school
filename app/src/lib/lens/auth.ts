/**
 * Lens Authentication Helpers
 * Handle Lens Protocol authentication flow
 *
 * Note: Account creation with custom namespace is handled in account-creation.ts
 */

import { signMessageWith } from '@lens-protocol/client/viem'
import { fetchAccountsAvailable } from '@lens-protocol/client/actions'
import { evmAddress } from '@lens-protocol/client'
import type { AnyClient, SessionClient } from '@lens-protocol/client'
import type { WalletClient, Address } from 'viem'
import { lensClient, LENS_APP_ADDRESS } from './client'

/**
 * Login as Onboarding User (for users without accounts)
 * Used during account creation flow
 */
export async function loginAsOnboardingUser(
  walletClient: WalletClient,
  walletAddress: Address
): Promise<SessionClient> {
  const authenticated = await lensClient.login({
    onboardingUser: {
      app: LENS_APP_ADDRESS,
      wallet: evmAddress(walletAddress),
    },
    signMessage: signMessageWith(walletClient),
  })

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`)
  }

  return authenticated.value as unknown as SessionClient
}

/**
 * Login as Account Owner (for users with existing accounts)
 * Used for accessing social features
 */
export async function loginAsAccountOwner(
  walletClient: WalletClient,
  walletAddress: Address,
  accountAddress: Address
): Promise<SessionClient> {
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(accountAddress),
      app: LENS_APP_ADDRESS,
      owner: evmAddress(walletAddress),
    },
    signMessage: signMessageWith(walletClient),
  })

  if (authenticated.isErr()) {
    throw new Error(`Lens login as account owner failed: ${authenticated.error.message}`)
  }

  return authenticated.value as unknown as SessionClient
}

/**
 * Check if user has existing Lens accounts
 */
export async function getExistingAccounts(walletAddress: Address) {
  const result = await fetchAccountsAvailable(lensClient as AnyClient, {
    managedBy: evmAddress(walletAddress),
    includeOwned: true,
  })

  if (result.isErr()) {
    throw new Error(`Failed to fetch accounts: ${result.error.message}`)
  }

  return result.value.items
}

/**
 * Switch to Account Owner role
 * Used after account creation to get full account permissions
 */
export async function switchToAccountOwner(
  sessionClient: SessionClient,
  accountAddress: Address
): Promise<void> {
  const result = await sessionClient.switchAccount({
    account: evmAddress(accountAddress),
  })

  if (result.isErr()) {
    throw new Error(`Failed to switch account: ${result.error.message}`)
  }
}

/**
 * Resume existing Lens session
 */
export async function resumeLensSession(): Promise<SessionClient | null> {
  const resumed = await lensClient.resumeSession()

  if (resumed.isErr()) {
    return null
  }

  return resumed.value as unknown as SessionClient
}
