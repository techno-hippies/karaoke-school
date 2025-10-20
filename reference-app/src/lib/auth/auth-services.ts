/**
 * Auth Flow Services
 * Extracted auth flow logic from AuthContext for better separation of concerns
 *
 * Responsibilities:
 * - Registration flow (create account with passkey)
 * - Login flow (sign in with existing passkey)
 * - Lens integration during auth flows
 * - Status callbacks for UI updates
 */

import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import { account as accountMetadata } from '@lens-protocol/metadata'
import { StorageClient } from '@lens-chain/storage-client'
import { registerUser, loginUser } from '@/lib/lit-webauthn/auth-flow'
import { createPKPWalletClient, createPKPAuthContext } from '@/lib/lit-webauthn'
import type { PKPInfo, AuthData } from '@/lib/lit-webauthn'
import {
  loginAsOnboardingUser,
  loginAsAccountOwner,
  getExistingAccounts,
  createLensAccount,
  createLensAccountWithoutUsername,
  switchToAccountOwner
} from '@/lib/lens/auth'

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  walletClient: WalletClient
  lensSession: SessionClient
  lensAccount: Account
  lensSetupStatus: 'complete' | 'failed'
}

export type StatusCallback = (status: string) => void

/**
 * Login to Lens Protocol and auto-create account if needed
 * Uses PKP wallet as signer
 * Returns session client and account (creates one if none exists)
 *
 * IMPORTANT: Auto-creates accounts with optional username:
 * - If account exists: Login as ACCOUNT_OWNER (full social features)
 * - If no account: Login as ONBOARDING_USER, create account with metadata, switch to ACCOUNT_OWNER
 * - If username provided: Use in passkey name and account metadata
 * - If no username: Use anonymous defaults
 */
async function connectLensSession(
  walletClient: WalletClient,
  address: Address,
  username: string | undefined,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account }> {
  console.log('[Auth Flow] ===== Starting connectLensSession =====')
  console.log('[Auth Flow] PKP Address:', address)

  statusCallback('Checking for existing Lens account...')

  try {
    // First, check if user has existing accounts
    // We need to do this BEFORE logging in to determine the correct role
    console.log('[Auth Flow] Step 1: Checking for existing accounts...')
    const existingAccounts = await getExistingAccounts(address)
    console.log('[Auth Flow] Found', existingAccounts.length, 'existing account(s)')
    const hasAccount = existingAccounts.length > 0

    let session: SessionClient
    let account: Account

    if (hasAccount) {
      // User has an account - login as ACCOUNT_OWNER for full social features
      console.log('[Auth Flow] Path: EXISTING ACCOUNT - Logging in as ACCOUNT_OWNER')
      statusCallback('Logging in to Lens...')
      account = existingAccounts[0].account
      console.log('[Auth Flow] Account address:', account.address)

      session = await loginAsAccountOwner(walletClient, address, account.address)
      console.log('[Auth Flow] ✓ Logged in as ACCOUNT_OWNER:', account.address)
      console.log('[Auth Flow] Session authenticated:', session.authenticated)
      console.log('[Auth Flow] Session type:', session.type)
    } else {
      // User has no account - auto-create one
      console.log('[Auth Flow] Path: NEW ACCOUNT - Creating account', username ? `with username: ${username}` : 'without username')
      statusCallback('Creating your Lens account...')

      // Step 1: Login as ONBOARDING_USER to create account
      console.log('[Auth Flow] Step 2a: Logging in as ONBOARDING_USER...')
      session = await loginAsOnboardingUser(walletClient, address)
      console.log('[Auth Flow] ✓ Logged in as ONBOARDING_USER')
      console.log('[Auth Flow] Session type:', session.type)

      // Step 2: Create account metadata
      console.log('[Auth Flow] Step 2b: Creating account metadata...')
      statusCallback('Uploading account metadata...')
      const displayName = username || 'Anonymous User'
      const metadata = accountMetadata({
        name: displayName,
        bio: username || 'K-School User',
        // Use username if provided, otherwise use defaults
      })
      console.log('[Auth Flow] Metadata name:', displayName)

      // Upload to storage
      console.log('[Auth Flow] Step 2c: Uploading metadata to storage...')
      const storageClient = StorageClient.create()
      const uploadResult = await storageClient.uploadAsJson(metadata)
      console.log('[Auth Flow] ✓ Metadata uploaded:', uploadResult.uri)

      // Step 3: Create account (with or without username)
      console.log('[Auth Flow] Step 3: Creating account on-chain...')
      statusCallback('Deploying account...')

      if (username) {
        // Create account WITH username
        console.log('[Auth Flow] Creating account with username:', username)
        account = await createLensAccount(
          session,
          walletClient,
          username,
          uploadResult.uri
        )
      } else {
        // Create account WITHOUT username (can add later)
        console.log('[Auth Flow] Creating account without username')
        account = await createLensAccountWithoutUsername(
          session,
          walletClient,
          uploadResult.uri
        )
      }

      console.log('[Auth Flow] ✓ Account created:', account.address)
      console.log('[Auth Flow] Account owner:', account.owner)
      console.log('[Auth Flow] Account username:', account.username?.localName || 'none')

      // Step 4: Switch to ACCOUNT_OWNER role for social features
      console.log('[Auth Flow] Step 4: Switching to ACCOUNT_OWNER role...')
      statusCallback('Activating account...')
      await switchToAccountOwner(session, account.address)
      console.log('[Auth Flow] ✓ Switched to ACCOUNT_OWNER')
      console.log('[Auth Flow] Session type after switch:', session.type)
    }

    console.log('[Auth Flow] ===== connectLensSession COMPLETE =====')
    console.log('[Auth Flow] Final session type:', session.type)
    console.log('[Auth Flow] Final account address:', account.address)

    return { session, account }
  } catch (error) {
    console.error('[Auth Flow] ===== connectLensSession FAILED =====')
    console.error('[Auth Flow] Error:', error)
    console.error('[Auth Flow] Error message:', error instanceof Error ? error.message : 'Unknown')
    console.error('[Auth Flow] Error stack:', error instanceof Error ? error.stack : 'N/A')
    throw error
  }
}

/**
 * Register with passkey (create new account)
 * Flow: WebAuthn → PKP mint → PKP wallet → Lens connection
 *
 * @param username - Optional username for passkey and Lens account
 * @param statusCallback - Callback for status updates
 * @returns Complete auth state including PKP and optional Lens
 */
export async function registerWithPasskeyFlow(
  username: string | undefined,
  statusCallback: StatusCallback
): Promise<AuthFlowResult> {
  statusCallback('Starting registration...')

  // Step 1: Register with WebAuthn + mint PKP (username used for passkey identifier)
  const result = await registerUser(username, (status) => {
    statusCallback(status)
  })

  // Step 2: Create PKP wallet client
  statusCallback('Creating wallet...')
  const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
  const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

  // Step 3: Auto-connect Lens and create account if needed
  statusCallback('Account created! Setting up social features...')
  const lensResult = await connectLensSession(walletClient, result.pkpInfo.ethAddress, username, statusCallback)

  statusCallback('All set!')

  return {
    pkpInfo: result.pkpInfo,
    authData: result.authData,
    walletClient,
    lensSession: lensResult.session,
    lensAccount: lensResult.account,
    lensSetupStatus: 'complete',
  }
}

/**
 * Sign in with passkey (existing account)
 * Flow: WebAuthn authentication → PKP wallet → Lens connection
 *
 * @param statusCallback - Callback for status updates
 * @returns Complete auth state including PKP and optional Lens
 */
export async function signInWithPasskeyFlow(
  statusCallback: StatusCallback
): Promise<AuthFlowResult> {
  statusCallback('Starting sign in...')

  // Step 1: Authenticate with WebAuthn
  const result = await loginUser((status) => {
    statusCallback(status)
  })

  // Step 2: Create PKP wallet client
  statusCallback('Restoring wallet...')
  const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
  const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

  // Step 3: Auto-connect Lens and create account if needed
  statusCallback('Welcome back! Setting up social features...')
  const lensResult = await connectLensSession(walletClient, result.pkpInfo.ethAddress, undefined, statusCallback)

  statusCallback('All set!')

  return {
    pkpInfo: result.pkpInfo,
    authData: result.authData,
    walletClient,
    lensSession: lensResult.session,
    lensAccount: lensResult.account,
    lensSetupStatus: 'complete',
  }
}

/**
 * Standalone Lens login (for use when PKP is already initialized)
 * Used for just-in-time Lens connection
 * Auto-creates account if none exists
 */
export async function loginLensStandalone(
  walletClient: WalletClient,
  address: Address,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account }> {
  return connectLensSession(walletClient, address, undefined, statusCallback)
}
