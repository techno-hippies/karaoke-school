/**
 * Lens Account Management
 * Handle Lens Protocol authentication and account creation
 */

import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem'
import {
  createAccountWithUsername,
  fetchAccount,
  fetchAccountsAvailable,
} from '@lens-protocol/client/actions'
import { evmAddress, nonNullable, uri } from '@lens-protocol/client'
import type { SessionClient, Account } from '@lens-protocol/client'
import type { WalletClient, Address } from 'viem'
import { lensClient, LENS_APP_ADDRESS } from './client'

/**
 * Login as Onboarding User (for users without accounts)
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
    signMessage: signMessageWith(walletClient as any),
  })

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`)
  }

  return authenticated.value as unknown as SessionClient
}

/**
 * Login as Account Owner (for users with existing accounts)
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
    signMessage: signMessageWith(walletClient as any),
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
  const result = await fetchAccountsAvailable(lensClient as any, {
    managedBy: evmAddress(walletAddress),
    includeOwned: true,
  })

  if (result.isErr()) {
    throw new Error(`Failed to fetch accounts: ${result.error.message}`)
  }

  return result.value.items
}

/**
 * Create new Lens account with username
 */
export async function createLensAccount(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  username: string,
  metadataUri: string
): Promise<Account> {
  console.log('[Lens] Starting account creation with:', { username, metadataUri })

  // Step 1: Create account operation
  console.log('[Lens] Step 1: Creating account with username...')
  const createResult = await createAccountWithUsername(sessionClient, {
    username: { localName: username },
    metadataUri: uri(metadataUri),
  })

  if (createResult.isErr()) {
    console.error('[Lens] Step 1 FAILED - Account creation error:', createResult.error)
    throw new Error(`Failed to create account operation: ${createResult.error.message}`)
  }
  console.log('[Lens] Step 1 SUCCESS - Account operation created')

  // Step 2: Handle operation (sign transaction)
  console.log('[Lens] Step 2: Signing transaction...')
  const handleResult = await handleOperationWith(walletClient as any)(createResult.value)

  if (handleResult.isErr()) {
    console.error('[Lens] Step 2 FAILED - Transaction signing error:', handleResult.error)
    throw new Error(`Failed to sign transaction: ${handleResult.error.message}`)
  }
  console.log('[Lens] Step 2 SUCCESS - Transaction signed, txHash:', handleResult.value)

  // Step 3: Wait for transaction (with timeout handling)
  console.log('[Lens] Step 3: Waiting for transaction confirmation...')
  const txHash = handleResult.value
  const txResult = await sessionClient.waitForTransaction(txHash)

  if (txResult.isErr()) {
    console.warn('[Lens] Step 3 WARNING - Indexer timeout, but transaction may have succeeded')
    console.warn('[Lens] Transaction hash:', txHash)

    // Don't fail yet - try to fetch account with retries
    console.log('[Lens] Step 4: Attempting to fetch account with retries...')

    // Retry fetching account up to 10 times with 2 second delays
    let accountResult
    for (let i = 0; i < 10; i++) {
      console.log(`[Lens] Retry ${i + 1}/10: Fetching account...`)
      await new Promise(resolve => setTimeout(resolve, 2000))

      accountResult = await fetchAccount(sessionClient, { txHash }).map(nonNullable)

      if (accountResult.isOk()) {
        console.log('[Lens] Step 4 SUCCESS - Account fetched:', accountResult.value)
        return accountResult.value
      }
    }

    // If all retries failed
    console.error('[Lens] Step 4 FAILED - Could not fetch account after retries')
    throw new Error(`Transaction submitted but account not indexed yet. Please refresh and check your profile. TX: ${txHash}`)
  }

  console.log('[Lens] Step 3 SUCCESS - Transaction confirmed:', txResult.value)

  // Step 4: Fetch created account
  console.log('[Lens] Step 4: Fetching created account...')
  const accountResult = await fetchAccount(sessionClient, { txHash: txResult.value }).map(nonNullable)

  if (accountResult.isErr()) {
    console.error('[Lens] Step 4 FAILED - Fetch account error:', accountResult.error)
    throw new Error(`Failed to fetch account: ${accountResult.error.message}`)
  }
  console.log('[Lens] Step 4 SUCCESS - Account fetched:', accountResult.value)

  return accountResult.value
}

/**
 * Create new Lens account WITHOUT username (minimal account)
 * Username can be added later via createUsername action
 */
export async function createLensAccountWithoutUsername(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  metadataUri: string
): Promise<Account> {
  console.log('[Lens] Starting account creation WITHOUT username:', { metadataUri })

  // Step 1: Create account operation (no username)
  console.log('[Lens] Step 1: Creating minimal account...')
  // Note: createAccount function was removed from Lens SDK, using createAccountWithUsername with generated username
  const createResult = await createAccountWithUsername(sessionClient, {
    username: { localName: `user${Math.random().toString(36).slice(2, 10)}` },
    metadataUri: uri(metadataUri),
  })

  if (createResult.isErr()) {
    console.error('[Lens] Step 1 FAILED - Account creation error:', createResult.error)
    throw new Error(`Failed to create account operation: ${createResult.error.message}`)
  }
  console.log('[Lens] Step 1 SUCCESS - Account operation created')

  // Step 2: Handle operation (sign transaction)
  console.log('[Lens] Step 2: Signing transaction...')
  const handleResult = await handleOperationWith(walletClient as any)(createResult.value)

  if (handleResult.isErr()) {
    console.error('[Lens] Step 2 FAILED - Transaction signing error:', handleResult.error)
    throw new Error(`Failed to sign transaction: ${handleResult.error.message}`)
  }
  console.log('[Lens] Step 2 SUCCESS - Transaction signed, txHash:', handleResult.value)

  // Step 3: Wait for transaction (with timeout handling)
  console.log('[Lens] Step 3: Waiting for transaction confirmation...')
  const txHash = handleResult.value
  const txResult = await sessionClient.waitForTransaction(txHash)

  if (txResult.isErr()) {
    console.warn('[Lens] Step 3 WARNING - Indexer timeout, but transaction may have succeeded')
    console.warn('[Lens] Transaction hash:', txHash)

    // Don't fail yet - try to fetch account with retries
    console.log('[Lens] Step 4: Attempting to fetch account with retries...')

    // Retry fetching account up to 10 times with 2 second delays
    let accountResult
    for (let i = 0; i < 10; i++) {
      console.log(`[Lens] Retry ${i + 1}/10: Fetching account...`)
      await new Promise(resolve => setTimeout(resolve, 2000))

      accountResult = await fetchAccount(sessionClient, { txHash }).map(nonNullable)

      if (accountResult.isOk()) {
        console.log('[Lens] Step 4 SUCCESS - Account fetched:', accountResult.value)
        return accountResult.value
      }
    }

    // If all retries failed
    console.error('[Lens] Step 4 FAILED - Could not fetch account after retries')
    throw new Error(`Transaction submitted but account not indexed yet. Please refresh. TX: ${txHash}`)
  }

  console.log('[Lens] Step 3 SUCCESS - Transaction confirmed:', txResult.value)

  // Step 4: Fetch created account
  console.log('[Lens] Step 4: Fetching created account...')
  const accountResult = await fetchAccount(sessionClient, { txHash: txResult.value }).map(nonNullable)

  if (accountResult.isErr()) {
    console.error('[Lens] Step 4 FAILED - Fetch account error:', accountResult.error)
    throw new Error(`Failed to fetch account: ${accountResult.error.message}`)
  }
  console.log('[Lens] Step 4 SUCCESS - Account fetched:', accountResult.value)

  return accountResult.value
}

/**
 * Switch to Account Owner role
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
export async function resumeLensSession(): Promise<SessionClient | null> {
  const resumed = await lensClient.resumeSession()

  if (resumed.isErr()) {
    return null
  }

  return resumed.value as unknown as SessionClient
}
