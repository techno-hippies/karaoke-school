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
import { registerUser, loginUser } from '@/lib/lit-webauthn/auth-flow'
import { createPKPWalletClient, createPKPAuthContext } from '@/lib/lit-webauthn'
import type { PKPInfo, AuthData } from '@/lib/lit-webauthn'
import { loginAsOnboardingUser, getExistingAccounts } from '@/lib/lens/auth'

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  walletClient: WalletClient
  lensSession: SessionClient | null
  lensAccount: Account | null
  lensSetupStatus: 'complete' | 'failed'
}

export type StatusCallback = (status: string) => void

/**
 * Login to Lens Protocol
 * Uses PKP wallet as signer
 * Returns session client and existing account (if any)
 */
async function connectLensSession(
  walletClient: WalletClient,
  address: Address,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account | null }> {
  statusCallback('Connecting to Lens Protocol...')

  // Login as onboarding user (Account Manager mode)
  const session = await loginAsOnboardingUser(walletClient, address)

  statusCallback('Checking for existing Lens account...')

  // Check for existing accounts
  const existingAccounts = await getExistingAccounts(address)
  const account = existingAccounts.length > 0 ? existingAccounts[0] : null

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

  // Step 3: Auto-connect Lens (non-critical)
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'complete' | 'failed' = 'failed'

  try {
    statusCallback('Account created! Connecting social...')
    const lensResult = await connectLensSession(walletClient, result.pkpInfo.ethAddress, statusCallback)
    lensSession = lensResult.session
    lensAccount = lensResult.account
    lensSetupStatus = 'complete'
  } catch (lensError) {
    console.warn('[Auth] Lens connection failed (non-critical):', lensError)
    // Don't throw - PKP still works for search/browse
  }

  statusCallback('All set!')

  return {
    pkpInfo: result.pkpInfo,
    authData: result.authData,
    walletClient,
    lensSession,
    lensAccount,
    lensSetupStatus,
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

  // Step 3: Auto-connect Lens (non-critical)
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'complete' | 'failed' = 'failed'

  try {
    statusCallback('Welcome back! Connecting social...')
    const lensResult = await connectLensSession(walletClient, result.pkpInfo.ethAddress, statusCallback)
    lensSession = lensResult.session
    lensAccount = lensResult.account
    lensSetupStatus = 'complete'
  } catch (lensError) {
    console.warn('[Auth] Lens connection failed (non-critical):', lensError)
    // Don't throw - PKP still works for search/browse
  }

  statusCallback('All set!')

  return {
    pkpInfo: result.pkpInfo,
    authData: result.authData,
    walletClient,
    lensSession,
    lensAccount,
    lensSetupStatus,
  }
}

/**
 * Standalone Lens login (for use when PKP is already initialized)
 * Used for just-in-time Lens connection
 */
export async function loginLensStandalone(
  walletClient: WalletClient,
  address: Address,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account | null }> {
  return connectLensSession(walletClient, address, statusCallback)
}
