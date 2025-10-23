/**
 * Lens Account Creation - Custom Namespace Support
 * Implements 2-step flow for creating accounts in custom namespaces with payment rules
 *
 * Flow:
 * 1. Create account (no username)
 * 2. Switch to account owner role
 * 3. Create username in custom namespace (with rulesSubject for payment validation)
 */

import type { SessionClient, Account } from '@lens-protocol/client'
import type { WalletClient, Address, Hex } from 'viem'
import { fetchAccount } from '@lens-protocol/client/actions'
import { nonNullable } from '@lens-protocol/client'
import { createLensGraphQLClient, executeMutation, executeQuery } from './graphql-client'
import {
  CREATE_ACCOUNT_MUTATION,
  CREATE_USERNAME_MUTATION,
  ACCOUNT_QUERY,
  CAN_CREATE_USERNAME_QUERY,
  type CreateAccountResponse,
  type CreateUsernameResponse,
  type AccountResponse,
  type CanCreateUsernameResponse,
  type RawTransaction,
} from './mutations'
import { LENS_CUSTOM_NAMESPACE } from './client'
import { switchToAccountOwner } from './auth'

/**
 * Send raw transaction using wallet client
 */
async function sendRawTransaction(
  walletClient: WalletClient,
  raw: RawTransaction
): Promise<Hex> {
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account!,
    chain: walletClient.chain || undefined,
    to: raw.to as Address,
    data: raw.data as Hex,
    value: BigInt(raw.value || '0'),
    gas: BigInt(raw.gasLimit),
    maxPriorityFeePerGas: BigInt(raw.maxPriorityFeePerGas || '0'),
    maxFeePerGas: BigInt(raw.maxFeePerGas || '0'),
  })

  return txHash
}

/**
 * Wait for transaction with retry logic
 */
async function waitForAccountIndexing(
  sessionClient: SessionClient,
  txHash: Hex,
  maxRetries: number = 10,
  delayMs: number = 2000
): Promise<Account> {
  console.log('[Account Creation] Waiting for account to be indexed...')

  for (let i = 0; i < maxRetries; i++) {
    console.log(`[Account Creation] Retry ${i + 1}/${maxRetries}: Fetching account...`)
    await new Promise(resolve => setTimeout(resolve, delayMs))

    const accountResult = await fetchAccount(sessionClient, { txHash }).map(nonNullable)

    if (accountResult.isOk()) {
      console.log('[Account Creation] ✓ Account fetched:', accountResult.value.address)
      return accountResult.value
    }
  }

  throw new Error(`Account not indexed after ${maxRetries} retries. TX: ${txHash}`)
}

/**
 * Create account in custom namespace (2-step flow)
 *
 * Step 1: Create account without username
 * Step 2: Switch to account owner
 * Step 3: Create username in custom namespace
 *
 * @param sessionClient - Authenticated Lens session (ONBOARDING_USER role)
 * @param walletClient - PKP wallet client for signing transactions
 * @param username - Username to register in custom namespace
 * @param metadataUri - Grove metadata URI for account
 * @returns Created account with username
 */
export async function createAccountInCustomNamespace(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  username: string,
  metadataUri: string
): Promise<Account> {
  console.log('[Account Creation] ===== Starting custom namespace account creation =====')
  console.log('[Account Creation] Username:', username)
  console.log('[Account Creation] Metadata URI:', metadataUri)
  console.log('[Account Creation] Custom namespace:', LENS_CUSTOM_NAMESPACE)

  // Use SessionClient's internal urql client which is already authenticated
  const urqlClient = (sessionClient as any).urql
  if (!urqlClient) {
    throw new Error('SessionClient does not have urql client')
  }

  console.log('[Account Creation] Using SessionClient authenticated urql client')

  // Helper to execute mutations using SessionClient's urql
  const executeMutationWithSession = async <T,>(mutation: string, variables: any): Promise<T> => {
    const result = await urqlClient.mutation(mutation, variables).toPromise()
    if (result.error) {
      console.error('[Account Creation] Mutation error:', result.error)
      throw new Error(result.error.message || 'Mutation failed')
    }
    return result.data as T
  }

  // ============ STEP 1: Create Account (No Username) ============
  console.log('[Account Creation] Step 1/3: Creating account without username...')

  const createAccountResult = await executeMutationWithSession<{ createAccount: CreateAccountResponse }>(
    CREATE_ACCOUNT_MUTATION,
    {
      request: {
        metadataUri,
      },
    }
  )

  const createAccountData = createAccountResult.createAccount

  // Handle transaction response
  let accountTxHash: Hex

  if (createAccountData.hash) {
    // Sponsored transaction - already has hash
    accountTxHash = createAccountData.hash as Hex
    console.log('[Account Creation] ✓ Sponsored transaction, hash:', accountTxHash)
  } else if (createAccountData.raw) {
    // Self-funded transaction - need to sign and send
    console.log('[Account Creation] Self-funded transaction required')
    console.log('[Account Creation] Reason:', createAccountData.reason)

    accountTxHash = await sendRawTransaction(walletClient, createAccountData.raw)
    console.log('[Account Creation] ✓ Transaction sent:', accountTxHash)
  } else if (createAccountData.reason) {
    // Transaction will fail
    throw new Error(`Account creation will fail: ${createAccountData.reason}`)
  } else {
    throw new Error('Unexpected response from createAccount mutation')
  }

  // Wait for account to be indexed
  const account = await waitForAccountIndexing(sessionClient, accountTxHash)
  console.log('[Account Creation] ✓ Account created:', account.address)

  // ============ STEP 2: Switch to Account Owner ============
  console.log('[Account Creation] Step 2/3: Switching to account owner role...')

  await switchToAccountOwner(sessionClient, account.address)
  console.log('[Account Creation] ✓ Switched to ACCOUNT_OWNER')
  console.log('[Account Creation] SessionClient urql client updated with new account context')

  // ============ STEP 3: Create Username in Custom Namespace ============
  console.log('[Account Creation] Step 3/3: Creating username in custom namespace...')

  const createUsernameResult = await executeMutationWithSession<{ createUsername: CreateUsernameResponse }>(
    CREATE_USERNAME_MUTATION,
    {
      request: {
        username: {
          localName: username,
          namespace: LENS_CUSTOM_NAMESPACE,
        },
      },
    }
  )

  const createUsernameData = createUsernameResult.createUsername

  // Handle transaction response
  let usernameTxHash: Hex

  if (createUsernameData.hash) {
    // Direct hash response (fully sponsored without signature)
    usernameTxHash = createUsernameData.hash as Hex
    console.log('[Account Creation] ✓ Username created, hash:', usernameTxHash)
  } else if (createUsernameData.sponsoredReason === 'REQUIRES_SIGNATURE' && createUsernameData.raw) {
    // Sponsored transaction requiring signature - submit via backend API
    console.log('[Account Creation] Sponsored transaction requires signature')
    console.log('[Account Creation] Reason:', createUsernameData.reason)
    console.log('[Account Creation] Submitting via sponsorship API...')

    // Call backend API to submit transaction with funded admin wallet
    const apiUrl = import.meta.env.VITE_SPONSORSHIP_API_URL || 'http://localhost:8787'
    const response = await fetch(`${apiUrl}/api/submit-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: account.address,
        operation: 'username',
        raw: createUsernameData.raw,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`API submission failed: ${error.error || response.statusText}`)
    }

    const result = await response.json()
    usernameTxHash = result.txHash
    console.log('[Account Creation] ✓ Transaction submitted by API:', usernameTxHash)
  } else if (createUsernameData.sponsoredReason !== undefined && !createUsernameData.raw) {
    // Fully sponsored without signature - poll for username
    console.log('[Account Creation] ✓ Fully sponsored username creation')
    console.log('[Account Creation] Polling for username assignment...')
    await waitForUsernameAssignment(urqlClient, account.address, username)
    usernameTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
  } else if (createUsernameData.raw) {
    // Self-funded transaction (payment required for short usernames)
    const paymentValue = BigInt(createUsernameData.raw.value || '0')

    if (paymentValue > 0n) {
      console.log('[Account Creation] Payment required:', paymentValue.toString(), 'wei')
    } else {
      console.log('[Account Creation] Free username (6+ characters)')
    }
    console.log('[Account Creation] Reason:', createUsernameData.reason)

    usernameTxHash = await sendRawTransaction(walletClient, createUsernameData.raw)
    console.log('[Account Creation] ✓ Transaction sent:', usernameTxHash)
  } else if (createUsernameData.reason) {
    // Transaction will fail
    throw new Error(`Username creation will fail: ${createUsernameData.reason}`)
  } else {
    throw new Error('Unexpected response from createUsername mutation')
  }

  // Fetch final account with username
  console.log('[Account Creation] Fetching final account state...')
  const finalAccount = await waitForAccountIndexing(sessionClient, usernameTxHash === '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex ? accountTxHash : usernameTxHash)

  console.log('[Account Creation] ===== Account creation complete =====')
  console.log('[Account Creation] Address:', finalAccount.address)
  console.log('[Account Creation] Username:', finalAccount.username?.localName || 'none')

  return finalAccount
}

/**
 * Wait for username to be assigned (for fully sponsored transactions)
 */
async function waitForUsernameAssignment(
  urqlClient: any,
  accountAddress: Address,
  expectedUsername: string,
  maxRetries: number = 30,
  delayMs: number = 2000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    console.log(`[Account Creation] Checking username ${i + 1}/${maxRetries}...`)
    await new Promise(resolve => setTimeout(resolve, delayMs))

    try {
      const result = await urqlClient.query(ACCOUNT_QUERY, {
        request: { address: accountAddress },
      }).toPromise()

      if (result.data?.account?.username?.localName === expectedUsername) {
        console.log('[Account Creation] ✓ Username assigned')
        return
      }
    } catch (error) {
      // Continue polling
    }
  }

  throw new Error('Username assignment timed out')
}

/**
 * Check if username can be created in custom namespace
 *
 * Note: This only checks basic availability, not payment requirements
 * Payment info will be provided when actually creating the username
 */
export async function checkUsernameAvailability(
  username: string
): Promise<{
  available: boolean
  reason?: string
  paymentRequired: boolean
  paymentAmount?: bigint
}> {
  const gqlClient = createLensGraphQLClient()

  try {
    const result = await executeQuery<{ canCreateUsername: CanCreateUsernameResponse }>(
      gqlClient,
      CAN_CREATE_USERNAME_QUERY,
      {
        request: {
          localName: username,
          namespace: LENS_CUSTOM_NAMESPACE,
        },
      }
    )

    const response = result.canCreateUsername

    console.log('[Account Creation] canCreateUsername response:', response)

    // Handle different response types
    switch (response.__typename) {
      case 'NamespaceOperationValidationPassed':
        // Username is available and can be created
        // Note: Payment may still be required for short usernames (checked during actual creation)
        return {
          available: true,
          paymentRequired: false, // We don't know yet, will find out during creation
        }

      case 'NamespaceOperationValidationFailed':
        // Validation failed (too short, invalid chars, etc.)
        return {
          available: false,
          paymentRequired: false,
          reason: response.reason || 'Username validation failed',
        }

      case 'UsernameTaken':
        // Username is already in use
        return {
          available: false,
          paymentRequired: false,
          reason: 'Username is already taken',
        }

      case 'NamespaceOperationValidationUnknown':
        // Validation outcome unknown
        return {
          available: false,
          paymentRequired: false,
          reason: 'Username validation status unknown',
        }

      default:
        return {
          available: false,
          paymentRequired: false,
          reason: 'Unexpected response from API',
        }
    }
  } catch (error) {
    console.error('[Account Creation] Username availability check failed:', error)
    return {
      available: false,
      paymentRequired: false,
      reason: 'Failed to check username availability',
    }
  }
}

/**
 * Validate username format
 * Returns error message if invalid, undefined if valid
 */
export function validateUsernameFormat(username: string): string | undefined {
  if (!username || username.length === 0) {
    return 'Username is required'
  }

  if (username.length < 6) {
    return 'Username must be at least 6 characters'
  }

  if (username.length > 31) {
    return 'Username must be less than 32 characters'
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return 'Username can only contain lowercase letters, numbers, and underscores'
  }

  if (username.startsWith('_') || username.endsWith('_')) {
    return 'Username cannot start or end with underscore'
  }

  return undefined
}
