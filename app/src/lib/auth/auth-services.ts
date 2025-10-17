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
 * IMPORTANT: Auto-creates accounts without username to enable immediate social features:
 * - If account exists: Login as ACCOUNT_OWNER (full social features)
 * - If no account: Login as ONBOARDING_USER, create minimal account, switch to ACCOUNT_OWNER
 * - Username can be added later by active users
 */
async function connectLensSession(
  walletClient: WalletClient,
  address: Address,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account }> {
  statusCallback('Checking for existing Lens account...')

  // First, check if user has existing accounts
  // We need to do this BEFORE logging in to determine the correct role
  const existingAccounts = await getExistingAccounts(address)
  const hasAccount = existingAccounts.length > 0

  let session: SessionClient
  let account: Account

  if (hasAccount) {
    // User has an account - login as ACCOUNT_OWNER for full social features
    statusCallback('Logging in to Lens...')
    account = existingAccounts[0].account
    session = await loginAsAccountOwner(walletClient, address, account.address)
    console.log('[Auth] Logged in as ACCOUNT_OWNER:', account.address)
  } else {
    // User has no account - auto-create one without username
    statusCallback('Creating your Lens account...')

    // Step 1: Login as ONBOARDING_USER to create account
    session = await loginAsOnboardingUser(walletClient, address)
    console.log('[Auth] Logged in as ONBOARDING_USER to create account')

    // Step 2: Create minimal metadata (no username required)
    statusCallback('Uploading account metadata...')
    const metadata = accountMetadata({
      name: 'Anonymous User',
      bio: '',
      // Minimal metadata - user can update later
    })

    // Upload to storage
    const storageClient = StorageClient.create()
    const uploadResult = await storageClient.uploadAsJson(metadata)
    console.log('[Auth] Metadata uploaded:', uploadResult.uri)

    // Step 3: Create account without username
    statusCallback('Deploying account...')
    account = await createLensAccountWithoutUsername(
      session,
      walletClient,
      uploadResult.uri
    )
    console.log('[Auth] Account created:', account.address)

    // Step 4: Switch to ACCOUNT_OWNER role for social features
    statusCallback('Activating account...')
    await switchToAccountOwner(session, account.address)
    console.log('[Auth] Switched to ACCOUNT_OWNER')
  }

  return { session, account }
}

/**
 * Register with passkey (create new account)
 * Flow: WebAuthn → PKP mint → PKP wallet → Lens connection
 *
 * @param statusCallback - Callback for status updates
 * @returns Complete auth state including PKP and optional Lens
 */
export async function registerWithPasskeyFlow(
  statusCallback: StatusCallback
): Promise<AuthFlowResult> {
  statusCallback('Starting registration...')

  // Step 1: Register with WebAuthn + mint PKP
  const result = await registerUser((status) => {
    statusCallback(status)
  })

  // Step 2: Create PKP wallet client
  statusCallback('Creating wallet...')
  const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
  const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

  // Step 3: Auto-connect Lens and create account if needed
  statusCallback('Account created! Setting up social features...')
  const lensResult = await connectLensSession(walletClient, result.pkpInfo.ethAddress, statusCallback)

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
  const lensResult = await connectLensSession(walletClient, result.pkpInfo.ethAddress, statusCallback)

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
  return connectLensSession(walletClient, address, statusCallback)
}
