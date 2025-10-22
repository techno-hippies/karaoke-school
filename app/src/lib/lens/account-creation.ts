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

  // Get GraphQL client (will use session client's auth)
  // Note: We'll extract the access token from the session if needed
  const gqlClient = createLensGraphQLClient()

  // ============ STEP 1: Create Account (No Username) ============
  console.log('[Account Creation] Step 1/3: Creating account without username...')

  const createAccountResult = await executeMutation<{ createAccount: CreateAccountResponse }>(
    gqlClient,
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

  // ============ STEP 3: Create Username in Custom Namespace ============
  console.log('[Account Creation] Step 3/3: Creating username in custom namespace...')

  const createUsernameResult = await executeMutation<{ createUsername: CreateUsernameResponse }>(
    gqlClient,
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
    // Direct hash response
    usernameTxHash = createUsernameData.hash as Hex
    console.log('[Account Creation] ✓ Username created, hash:', usernameTxHash)
  } else if (createUsernameData.sponsoredReason !== undefined) {
    // Sponsored transaction (gas paid by protocol)
    console.log('[Account Creation] ✓ Sponsored username creation')
    console.log('[Account Creation] Reason:', createUsernameData.reason)
    console.log('[Account Creation] Sponsored reason:', createUsernameData.sponsoredReason)

    if (createUsernameData.raw) {
      // Requires signature
      usernameTxHash = await sendRawTransaction(walletClient, createUsernameData.raw)
      console.log('[Account Creation] ✓ Transaction sent:', usernameTxHash)
    } else {
      // Fully sponsored - poll for username
      console.log('[Account Creation] Polling for username assignment...')
      await waitForUsernameAssignment(gqlClient, account.address, username)
      usernameTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
    }
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
  gqlClient: ReturnType<typeof createLensGraphQLClient>,
  accountAddress: Address,
  expectedUsername: string,
  maxRetries: number = 30,
  delayMs: number = 2000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    console.log(`[Account Creation] Checking username ${i + 1}/${maxRetries}...`)
    await new Promise(resolve => setTimeout(resolve, delayMs))

    try {
      const accountResult = await executeQuery<{ account: AccountResponse }>(
        gqlClient,
        ACCOUNT_QUERY,
        {
          request: { address: accountAddress },
        }
      )

      if (accountResult.account?.username?.localName === expectedUsername) {
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
 * Returns payment amount if required (in wei)
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
          username: {
            localName: username,
            namespace: LENS_CUSTOM_NAMESPACE,
          },
        },
      }
    )

    const response = result.canCreateUsername

    // Check if username can be created
    if (response.canCreate) {
      return {
        available: true,
        paymentRequired: false,
      }
    }

    // Check for payment rule
    const paymentRule = response.unsatisfiedRules?.find(rule => 'config' in rule)
    if (paymentRule && 'config' in paymentRule) {
      const paymentAmount = BigInt(paymentRule.config?.price || '0')

      return {
        available: true,
        paymentRequired: paymentAmount > 0n,
        paymentAmount,
        reason: `Username requires payment: ${paymentAmount.toString()} wei`,
      }
    }

    // Other validation failures (too short, invalid chars, etc.)
    return {
      available: false,
      paymentRequired: false,
      reason: response.reason || 'Username validation failed',
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
