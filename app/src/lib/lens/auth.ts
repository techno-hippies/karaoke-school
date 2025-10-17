/**
 * Lens Authentication Helpers
 * Handle Lens Protocol authentication flow
 */

import { signMessageWith } from '@lens-protocol/client/viem'
import { handleOperationWith } from '@lens-protocol/client/viem'
import {
  createAccountWithUsername,
  createAccount,
  fetchAccount,
  fetchAccountsAvailable
} from '@lens-protocol/client/actions'
import { evmAddress, nonNullable, uri } from '@lens-protocol/client'
import type { SessionClient, Account } from '@lens-protocol/client'
import type { WalletClient, Address } from 'viem'
import { lensClient, LENS_APP_ADDRESS } from './config'

/**
 * Step 1a: Login as Onboarding User (for users without accounts)
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
 * Step 1b: Login as Account Owner (for users with existing accounts)
 */
export async function loginAsAccountOwner(
  walletClient: WalletClient,
  walletAddress: Address,
  accountAddress: Address
) {
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
  console.log('[Lens Auth] Starting account creation with:', { username, metadataUri })

  // Step 1: Create account operation
  console.log('[Lens Auth] Step 1: Creating account with username...')
  const createResult = await createAccountWithUsername(sessionClient, {
    username: { localName: username },
    metadataUri: uri(metadataUri),
  })

  if (createResult.isErr()) {
    console.error('[Lens Auth] Step 1 FAILED - Account creation error:', createResult.error)
    throw new Error(`Failed to create account operation: ${createResult.error.message}`)
  }
  console.log('[Lens Auth] Step 1 SUCCESS - Account operation created')

  // Step 2: Handle operation (sign transaction)
  console.log('[Lens Auth] Step 2: Signing transaction...')
  const handleResult = await handleOperationWith(walletClient)(createResult.value)

  if (handleResult.isErr()) {
    console.error('[Lens Auth] Step 2 FAILED - Transaction signing error:', handleResult.error)
    throw new Error(`Failed to sign transaction: ${handleResult.error.message}`)
  }
  console.log('[Lens Auth] Step 2 SUCCESS - Transaction signed, txHash:', handleResult.value)

  // Step 3: Wait for transaction (with timeout handling)
  console.log('[Lens Auth] Step 3: Waiting for transaction confirmation...')
  const txHash = handleResult.value
  const txResult = await sessionClient.waitForTransaction(txHash)

  if (txResult.isErr()) {
    console.warn('[Lens Auth] Step 3 WARNING - Indexer timeout, but transaction may have succeeded')
    console.warn('[Lens Auth] Transaction hash:', txHash)

    // Don't fail yet - try to fetch account with retries
    console.log('[Lens Auth] Step 4: Attempting to fetch account with retries...')

    // Retry fetching account up to 10 times with 2 second delays
    let accountResult
    for (let i = 0; i < 10; i++) {
      console.log(`[Lens Auth] Retry ${i + 1}/10: Fetching account...`)
      await new Promise(resolve => setTimeout(resolve, 2000))

      accountResult = await fetchAccount(sessionClient, { txHash }).map(nonNullable)

      if (accountResult.isOk()) {
        console.log('[Lens Auth] Step 4 SUCCESS - Account fetched:', accountResult.value)
        return accountResult.value
      }
    }

    // If all retries failed
    console.error('[Lens Auth] Step 4 FAILED - Could not fetch account after retries')
    throw new Error(`Transaction submitted but account not indexed yet. Please refresh and check your profile. TX: ${txHash}`)
  }

  console.log('[Lens Auth] Step 3 SUCCESS - Transaction confirmed:', txResult.value)

  // Step 4: Fetch created account
  console.log('[Lens Auth] Step 4: Fetching created account...')
  const accountResult = await fetchAccount(sessionClient, { txHash: txResult.value }).map(nonNullable)

  if (accountResult.isErr()) {
    console.error('[Lens Auth] Step 4 FAILED - Fetch account error:', accountResult.error)
    throw new Error(`Failed to fetch account: ${accountResult.error.message}`)
  }
  console.log('[Lens Auth] Step 4 SUCCESS - Account fetched:', accountResult.value)

  return accountResult.value
}

/**
 * Step 3b: Create new Lens account WITHOUT username (minimal account)
 * This allows immediate access to social features without requiring username selection
 * Username can be added later via createUsername action
 */
export async function createLensAccountWithoutUsername(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  metadataUri: string
): Promise<Account> {
  console.log('[Lens Auth] Starting account creation WITHOUT username:', { metadataUri })

  // Step 1: Create account operation (no username)
  console.log('[Lens Auth] Step 1: Creating minimal account...')
  const createResult = await createAccount(sessionClient, {
    metadataUri: uri(metadataUri),
  })

  if (createResult.isErr()) {
    console.error('[Lens Auth] Step 1 FAILED - Account creation error:', createResult.error)
    throw new Error(`Failed to create account operation: ${createResult.error.message}`)
  }
  console.log('[Lens Auth] Step 1 SUCCESS - Account operation created')

  // Step 2: Handle operation (sign transaction)
  console.log('[Lens Auth] Step 2: Signing transaction...')
  const handleResult = await handleOperationWith(walletClient)(createResult.value)

  if (handleResult.isErr()) {
    console.error('[Lens Auth] Step 2 FAILED - Transaction signing error:', handleResult.error)
    throw new Error(`Failed to sign transaction: ${handleResult.error.message}`)
  }
  console.log('[Lens Auth] Step 2 SUCCESS - Transaction signed, txHash:', handleResult.value)

  // Step 3: Wait for transaction (with timeout handling)
  console.log('[Lens Auth] Step 3: Waiting for transaction confirmation...')
  const txHash = handleResult.value
  const txResult = await sessionClient.waitForTransaction(txHash)

  if (txResult.isErr()) {
    console.warn('[Lens Auth] Step 3 WARNING - Indexer timeout, but transaction may have succeeded')
    console.warn('[Lens Auth] Transaction hash:', txHash)

    // Don't fail yet - try to fetch account with retries
    console.log('[Lens Auth] Step 4: Attempting to fetch account with retries...')

    // Retry fetching account up to 10 times with 2 second delays
    let accountResult
    for (let i = 0; i < 10; i++) {
      console.log(`[Lens Auth] Retry ${i + 1}/10: Fetching account...`)
      await new Promise(resolve => setTimeout(resolve, 2000))

      accountResult = await fetchAccount(sessionClient, { txHash }).map(nonNullable)

      if (accountResult.isOk()) {
        console.log('[Lens Auth] Step 4 SUCCESS - Account fetched:', accountResult.value)
        return accountResult.value
      }
    }

    // If all retries failed
    console.error('[Lens Auth] Step 4 FAILED - Could not fetch account after retries')
    throw new Error(`Transaction submitted but account not indexed yet. Please refresh. TX: ${txHash}`)
  }

  console.log('[Lens Auth] Step 3 SUCCESS - Transaction confirmed:', txResult.value)

  // Step 4: Fetch created account
  console.log('[Lens Auth] Step 4: Fetching created account...')
  const accountResult = await fetchAccount(sessionClient, { txHash: txResult.value }).map(nonNullable)

  if (accountResult.isErr()) {
    console.error('[Lens Auth] Step 4 FAILED - Fetch account error:', accountResult.error)
    throw new Error(`Failed to fetch account: ${accountResult.error.message}`)
  }
  console.log('[Lens Auth] Step 4 SUCCESS - Account fetched:', accountResult.value)

  return accountResult.value
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
