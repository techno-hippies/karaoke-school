/**
 * Lens Account Creation - Custom Namespace (kschool2/*)
 * Implements 3-step flow for creating accounts in the kschool2 custom namespace
 *
 * Flow:
 * 1. Create account (no username)
 * 2. Switch to account owner role
 * 3. Create username in kschool2 custom namespace
 */

import type { SessionClient, Account } from '@lens-protocol/client'
import type { WalletClient, Address, Hex } from 'viem'
import { fetchAccount } from '@lens-protocol/client/actions'
import { nonNullable } from '@lens-protocol/client'
import { createLensGraphQLClient, executeQuery } from './graphql-client'
import {
  CREATE_ACCOUNT_MUTATION,
  CREATE_USERNAME_MUTATION,
  CAN_CREATE_USERNAME_QUERY,
  type CreateAccountResponse,
  type CreateUsernameResponse,
  type CanCreateUsernameResponse,
  type RawTransaction,
} from './mutations'
import { switchToAccountOwner } from './auth'
import { LENS_CUSTOM_NAMESPACE } from './config'

const IS_DEV = import.meta.env.DEV

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
  if (IS_DEV) console.log('[Account Creation] Waiting for account to be indexed...')

  for (let i = 0; i < maxRetries; i++) {
    if (IS_DEV) console.log(`[Account Creation] Retry ${i + 1}/${maxRetries}: Fetching account...`)
    await new Promise(resolve => setTimeout(resolve, delayMs))

    const accountResult = await fetchAccount(sessionClient, { txHash }).map(nonNullable)

    if (accountResult.isOk()) {
      if (IS_DEV) console.log('[Account Creation] ✓ Account fetched:', accountResult.value.address)
      return accountResult.value
    }
  }

  throw new Error(`Account not indexed after ${maxRetries} retries. TX: ${txHash}`)
}

/**
 * Create account in global lens/* namespace (2-step flow)
 *
 * Step 1: Create account without username
 * Step 2: Switch to account owner
 * Step 3: Create username in global lens/* namespace
 *
 * @param sessionClient - Authenticated Lens session (ONBOARDING_USER role)
 * @param walletClient - PKP wallet client for signing transactions
 * @param username - Username to register in global lens/* namespace
 * @param metadataUri - Grove metadata URI for account
 * @returns Created account with username
 */
export async function createAccountInCustomNamespace(
  sessionClient: SessionClient,
  walletClient: WalletClient,
  username: string,
  metadataUri: string
): Promise<Account> {
  if (IS_DEV) {
    console.log('[Account Creation] ===== Starting global namespace account creation =====')
    console.log('[Account Creation] Username:', username)
    console.log('[Account Creation] Metadata URI:', metadataUri)
  }

  // Use SessionClient's internal urql client which is already authenticated
  const urqlClient = (sessionClient as any).urql
  if (!urqlClient) {
    throw new Error('SessionClient does not have urql client')
  }

  if (IS_DEV) console.log('[Account Creation] Using SessionClient authenticated urql client')

  // Helper to execute mutations using SessionClient's urql
  const executeMutationWithSession = async <T,>(mutation: string, variables: any): Promise<T> => {
    const result = await urqlClient.mutation(mutation, variables).toPromise()
    if (result.error) {
      if (IS_DEV) console.error('[Account Creation] Mutation error:', result.error)
      throw new Error(result.error.message || 'Mutation failed')
    }
    return result.data as T
  }

  // ============ STEP 1: Create Account (No Username) ============
  if (IS_DEV) console.log('[Account Creation] Step 1/3: Creating account without username...')

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
    if (IS_DEV) console.log('[Account Creation] ✓ Sponsored transaction, hash:', accountTxHash)
  } else if (createAccountData.raw) {
    // Self-funded transaction - need to sign and send
    if (IS_DEV) {
      console.log('[Account Creation] Self-funded transaction required')
      console.log('[Account Creation] Reason:', createAccountData.reason)
    }

    accountTxHash = await sendRawTransaction(walletClient, createAccountData.raw)
    if (IS_DEV) console.log('[Account Creation] ✓ Transaction sent:', accountTxHash)
  } else if (createAccountData.reason) {
    // Transaction will fail
    throw new Error(`Account creation will fail: ${createAccountData.reason}`)
  } else {
    throw new Error('Unexpected response from createAccount mutation')
  }

  // Wait for account to be indexed
  const account = await waitForAccountIndexing(sessionClient, accountTxHash)
  if (IS_DEV) console.log('[Account Creation] ✓ Account created:', account.address)

  // ============ STEP 2: Switch to Account Owner ============
  if (IS_DEV) console.log('[Account Creation] Step 2/3: Switching to account owner role...')

  await switchToAccountOwner(sessionClient, account.address)
  if (IS_DEV) console.log('[Account Creation] ✓ Switched to ACCOUNT_OWNER')

  // ============ STEP 3: Create Username in Custom Namespace ============
  if (IS_DEV) {
    console.log('[Account Creation] Step 3/3: Creating username in kschool2 custom namespace...')
    console.log('[Account Creation] Namespace address:', LENS_CUSTOM_NAMESPACE)
    console.log('[Account Creation] Username to create:', username)
  }

  let createUsernameResult: { createUsername: CreateUsernameResponse }
  try {
    createUsernameResult = await executeMutationWithSession<{ createUsername: CreateUsernameResponse }>(
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
    if (IS_DEV) console.log('[Account Creation] Username mutation response:', JSON.stringify(createUsernameResult, null, 2))
  } catch (mutationError) {
    if (IS_DEV) console.error('[Account Creation] Username mutation failed:', mutationError)
    throw mutationError
  }

  const createUsernameData = createUsernameResult.createUsername
  if (IS_DEV) console.log('[Account Creation] createUsernameData:', JSON.stringify(createUsernameData, null, 2))

  // Handle transaction response
  let usernameTxHash: Hex

  if (createUsernameData.hash) {
    // Direct hash response (fully sponsored without signature)
    usernameTxHash = createUsernameData.hash as Hex
    if (IS_DEV) console.log('[Account Creation] ✓ Username created, hash:', usernameTxHash)
  } else if (createUsernameData.sponsoredReason === 'REQUIRES_SIGNATURE' && createUsernameData.typedData) {
    // Sponsored with typedData - sign and broadcast via Lens API (gasless!)
    if (IS_DEV) {
      console.log('[Account Creation] Sponsored transaction with typedData')
      console.log('[Account Creation] Signing typedData and broadcasting via Lens API...')
    }

    // Sign the typed data with PKP
    if (!walletClient.account) {
      throw new Error('Wallet client account not available')
    }
    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: {
        ...createUsernameData.typedData.domain,
        chainId: BigInt(createUsernameData.typedData.domain.chainId),
        verifyingContract: createUsernameData.typedData.domain.verifyingContract as `0x${string}`,
      },
      types: createUsernameData.typedData.types,
      primaryType: 'CreateUsername',
      message: createUsernameData.typedData.value,
    })

    // Broadcast via Lens API (gasless - no PKP funds needed!)
    // Note: executeTypedData may not be available on SessionClient, using raw broadcast
    const broadcastResult = await (sessionClient as any).executeTypedData({
      id: createUsernameData.id,
      signature,
    })

    if (broadcastResult.isOk()) {
      usernameTxHash = broadcastResult.value as Hex
      if (IS_DEV) console.log('[Account Creation] ✓ Transaction broadcast via Lens API:', usernameTxHash)
    } else {
      throw new Error(`Broadcast failed: ${broadcastResult.error?.message}`)
    }
  } else if (createUsernameData.sponsoredReason === 'REQUIRES_SIGNATURE' && createUsernameData.raw) {
    // Sponsored with raw only (fallback - requires PKP to have funds)
    if (IS_DEV) {
      console.log('[Account Creation] ⚠️  Sponsored transaction returns raw only (not typedData)')
      console.log('[Account Creation] This requires PKP to have gas funds - registration will likely fail')
      console.log('[Account Creation] Reason:', createUsernameData.reason)
    }

    throw new Error(
      'Username creation returned raw transaction instead of typedData. ' +
      'This requires the PKP wallet to have gas funds, which is not supported. ' +
      'Please contact support.'
    )
  } else if (createUsernameData.sponsoredReason !== undefined && !createUsernameData.raw) {
    // Fully sponsored without signature - will poll in waitForUsernameIndexing below
    if (IS_DEV) console.log('[Account Creation] ✓ Fully sponsored username creation (no signature needed)')
    usernameTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
  } else if (createUsernameData.raw) {
    // Self-funded transaction (payment required for short usernames)
    const paymentValue = BigInt(createUsernameData.raw.value || '0')

    if (IS_DEV) {
      if (paymentValue > 0n) {
        console.log('[Account Creation] Payment required:', paymentValue.toString(), 'wei')
      } else {
        console.log('[Account Creation] Free username (6+ characters)')
      }
      console.log('[Account Creation] Reason:', createUsernameData.reason)
    }

    usernameTxHash = await sendRawTransaction(walletClient, createUsernameData.raw)
    if (IS_DEV) console.log('[Account Creation] ✓ Transaction sent:', usernameTxHash)
  } else if (createUsernameData.reason) {
    // Transaction will fail
    throw new Error(`Username creation will fail: ${createUsernameData.reason}`)
  } else {
    throw new Error('Unexpected response from createUsername mutation')
  }

  // Username transaction succeeded - return optimistically
  // Don't wait for indexing - the tx hash proves it will be indexed eventually
  if (IS_DEV) {
    console.log('[Account Creation] ✓ Username transaction confirmed on-chain')
    console.log('[Account Creation] Returning account optimistically (indexing happens in background)')
  }

  // Construct account with the expected username
  const optimisticAccount = {
    ...account,
    username: {
      localName: username,
      value: `kschool2/${username}`,
      namespace: { address: LENS_CUSTOM_NAMESPACE },
    },
  } as Account

  if (IS_DEV) {
    console.log('[Account Creation] ===== Account creation complete =====')
    console.log('[Account Creation] Address:', optimisticAccount.address)
    console.log('[Account Creation] Owner:', optimisticAccount.owner)
    console.log('[Account Creation] Username:', username)
  }

  return optimisticAccount
}

/**
 * Check if username can be created in global lens/* namespace
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
          // namespace omitted = global lens/* namespace
        },
      }
    )

    const response = result.canCreateUsername

    if (IS_DEV) console.log('[Account Creation] canCreateUsername response:', response)

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
    if (IS_DEV) console.error('[Account Creation] Username availability check failed:', error)
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
