/**
 * Lens Authentication Helpers
 * Handle Lens Protocol authentication flow
 */

import { signMessageWith } from '@lens-protocol/client/viem'
import { handleOperationWith } from '@lens-protocol/client/viem'
import { 
  createAccountWithUsername, 
  fetchAccount,
  fetchAccountsAvailable 
} from '@lens-protocol/client/actions'
import { evmAddress, nonNullable, uri } from '@lens-protocol/client'
import type { SessionClient } from '@lens-protocol/client'
import type { WalletClient, Address } from 'viem'
import { lensClient, LENS_APP_ADDRESS } from './config'

/**
 * Step 1: Login as Onboarding User
 */
export async function loginAsOnboardingUser(
  walletClient: WalletClient,
  walletAddress: Address
) {
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

  return authenticated.value as SessionClient
}

/**
 * Step 2: Check if user has existing Lens accounts
 */
export async function getExistingAccounts(walletAddress: Address) {
  const result = await fetchAccountsAvailable(lensClient, {
    managedBy: evmAddress(walletAddress),
    includeOwned: true,
  })

  if (result.isErr()) {
    throw new Error(`Failed to fetch accounts: ${result.error.message}`)
  }

  return result.value.items
}

/**
 * Step 3: Create new Lens account with username
 */
export async function createLensAccount(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  username: string,
  metadataUri: string
) {
  const result = await createAccountWithUsername(sessionClient, {
    username: { localName: username },
    metadataUri: uri(metadataUri),
  })
    .andThen(handleOperationWith(walletClient))
    .andThen(sessionClient.waitForTransaction)
    .andThen((txHash) => 
      fetchAccount(sessionClient, { txHash }).map(nonNullable)
    )

  if (result.isErr()) {
    throw new Error(`Failed to create account: ${result.error.message}`)
  }

  return result.value
}

/**
 * Step 4: Switch to Account Owner role
 */
export async function switchToAccountOwner(
  sessionClient: SessionClient,
  accountAddress: Address
) {
  const result = await sessionClient.switchAccount({
    account: evmAddress(accountAddress),
  })

  if (result.isErr()) {
    throw new Error(`Failed to switch account: ${result.error.message}`)
  }

  return result.value
}

/**
 * Resume existing session
 */
export async function resumeLensSession() {
  const resumed = await lensClient.resumeSession()
  
  if (resumed.isErr()) {
    return null
  }

  return resumed.value as SessionClient
}
