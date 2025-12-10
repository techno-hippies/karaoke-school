/**
 * Authentication Flows
 * Orchestrates Lit Protocol (PKP) + Lens Protocol authentication
 */

const IS_DEV = import.meta.env.DEV

import type { WalletClient, Address } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import {
  registerUser,
  loginUser,
  createPKPWalletClient,
  createPKPAuthContext,
  type PKPInfo,
  type AuthData,
  type PKPAuthContext,
} from '@/lib/lit'
import {
  loginAsOnboardingUser,
  loginAsAccountOwner,
  getExistingAccounts,
  createAccountWithoutUsername,
  resumeLensSession,
} from '@/lib/lens'

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  pkpAuthContext: PKPAuthContext
  walletClient: WalletClient
  lensSession: SessionClient | null
  lensAccount: Account | null
  lensSetupStatus: 'pending' | 'complete' | 'failed'
}

/**
 * Generate default metadata URI for new accounts
 */
function generateDefaultMetadataUri(): string {
  // For now, use a simple placeholder
  // In production, this would upload to Grove/IPFS
  return 'https://api.grove.storage/default-account-metadata'
}

/**
 * Register new user with passkey (WebAuthn)
 * 1. Register WebAuthn credential + mint PKP
 * 2. Create PKP wallet client
 * 3. Setup Lens account (without username - can be claimed later)
 */
export async function registerWithPasskeyFlow(
  onStatus?: (statusKey: string) => void
): Promise<AuthFlowResult> {
  const updateStatus = (statusKey: string) => {
    if (IS_DEV) {
      console.log('[AuthFlow]', statusKey)
    }
    onStatus?.(statusKey)
  }

  // Step 1: Register with WebAuthn
  updateStatus('auth.creatingPasskeyWallet')

  let registrationResult
  try {
    registrationResult = await registerUser(updateStatus)
  } catch (error: any) {
    // Handle WebAuthn attestation parsing errors (browser compatibility issue)
    if (error?.message?.includes('Attestation response') ||
        error?.message?.includes('WebAuthn registration')) {
      console.error('[AuthFlow] WebAuthn registration failed:', error)
      throw new Error(
        'Passkey creation failed. This may be a browser compatibility issue. ' +
        'Please try: 1) Using Chrome browser, 2) Using incognito mode, or 3) A different device.'
      )
    }
    throw error
  }

  const { pkpInfo, authData, authContext } = registrationResult

  // Step 2: Create wallet client
  updateStatus('auth.settingUpWallet')
  const walletClient = await createPKPWalletClient(pkpInfo, authContext)
  const walletAddress = walletClient.account?.address as Address

  // Step 3: Setup Lens (without username)
  updateStatus('auth.settingUpLensProfile')
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'pending' | 'complete' | 'failed' = 'pending'

  try {
    // Check for existing accounts
    const existingAccounts = await getExistingAccounts(walletAddress)

    if (existingAccounts.length > 0) {
      // Login to existing account
      updateStatus('auth.foundExistingLens')
      const firstAccount = existingAccounts[0]
      lensSession = await loginAsAccountOwner(walletClient, walletAddress, firstAccount.account.address)
      lensAccount = firstAccount.account
      lensSetupStatus = 'complete'
    } else {
      // Create new account without username
      updateStatus('auth.creatingNewLensAccount')
      lensSession = await loginAsOnboardingUser(walletClient, walletAddress)
      const metadataUri = generateDefaultMetadataUri()
      lensAccount = await createAccountWithoutUsername(lensSession, walletClient, metadataUri)
      lensSetupStatus = 'complete'
    }
  } catch (lensError) {
    console.error('[AuthFlow] Lens setup failed:', lensError)
    lensSetupStatus = 'failed'
    // Don't throw - user can still use the app without Lens
  }

  updateStatus('auth.complete')

  return {
    pkpInfo,
    authData,
    pkpAuthContext: authContext,
    walletClient,
    lensSession,
    lensAccount,
    lensSetupStatus,
  }
}

/**
 * Sign in existing user with passkey (WebAuthn)
 * 1. Authenticate with existing WebAuthn credential
 * 2. Get PKP for this credential
 * 3. Create PKP wallet client
 * 4. Resume or create Lens session
 */
export async function signInWithPasskeyFlow(
  onStatus?: (statusKey: string) => void
): Promise<AuthFlowResult> {
  const updateStatus = (statusKey: string) => {
    if (IS_DEV) {
      console.log('[AuthFlow]', statusKey)
    }
    onStatus?.(statusKey)
  }

  // Step 1: Authenticate with WebAuthn
  updateStatus('auth.authenticatingPasskey')
  const { pkpInfo, authData, authContext } = await loginUser(updateStatus)

  // Step 2: Create wallet client
  updateStatus('auth.settingUpWallet')
  const walletClient = await createPKPWalletClient(pkpInfo, authContext)
  const walletAddress = walletClient.account?.address as Address

  // Step 3: Resume or setup Lens
  updateStatus('auth.connectingToLens')
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'pending' | 'complete' | 'failed' = 'pending'

  try {
    // Try to resume existing session first
    lensSession = await resumeLensSession()

    if (lensSession) {
      updateStatus('auth.lensSessionResumed')
      // TODO: Get account from session
      lensSetupStatus = 'complete'
    } else {
      // No session, check for existing accounts
      const existingAccounts = await getExistingAccounts(walletAddress)
      if (IS_DEV) {
        console.log('[AuthFlow] Existing accounts:', existingAccounts)
      }

      if (existingAccounts.length > 0) {
        updateStatus('auth.connectingToLensAccount')
        const firstAccount = existingAccounts[0]
        if (IS_DEV) {
          console.log('[AuthFlow] First account:', firstAccount)
        }

        // Handle both possible structures: { account: Account } or Account directly
        const accountAddress = firstAccount.account?.address || (firstAccount as any).address
        const account = firstAccount.account || (firstAccount as unknown as Account)

        if (!accountAddress) {
          console.error('[AuthFlow] Could not find account address in:', firstAccount)
          lensSetupStatus = 'pending'
        } else {
          lensSession = await loginAsAccountOwner(walletClient, walletAddress, accountAddress)
          lensAccount = account
          lensSetupStatus = 'complete'
          if (IS_DEV) {
            console.log('[AuthFlow] Lens login successful, account:', lensAccount)
          }
        }
      } else {
        if (IS_DEV) {
          console.log('[AuthFlow] No Lens account found for this wallet')
        }
        lensSetupStatus = 'pending'
      }
    }
  } catch (lensError) {
    console.error('[AuthFlow] Lens connection failed:', lensError)
    lensSetupStatus = 'failed'
    // Don't throw - user can still use the app without Lens
  }

  updateStatus('auth.complete')

  return {
    pkpInfo,
    authData,
    pkpAuthContext: authContext,
    walletClient,
    lensSession,
    lensAccount,
    lensSetupStatus,
  }
}

/**
 * Connect with external EOA wallet (Metamask, Rabby, etc.)
 * Uses relayer API to mint PKP for EOA
 */
export async function connectWithEoaFlow(
  walletClient: WalletClient,
  onStatus?: (statusKey: string) => void
): Promise<AuthFlowResult> {
  const updateStatus = (statusKey: string) => {
    if (IS_DEV) {
      console.log('[AuthFlow]', statusKey)
    }
    onStatus?.(statusKey)
  }

  const { registerWithEoa, loginWithEoa, getExistingPkpForEoa } = await import('@/lib/lit')

  const address = walletClient.account?.address
  if (!address) {
    throw new Error('No wallet address')
  }

  updateStatus('auth.checkingExistingAccount')

  // Check if PKP already exists for this EOA
  const existingPkp = await getExistingPkpForEoa(address)

  let pkpInfo: PKPInfo
  let authData: AuthData

  if (existingPkp) {
    updateStatus('auth.foundExistingSigningIn')
    const result = await loginWithEoa(walletClient)
    pkpInfo = result.pkpInfo
    authData = result.authData
  } else {
    updateStatus('auth.creatingNewWallet')
    const result = await registerWithEoa(walletClient)
    pkpInfo = result.pkpInfo
    authData = result.authData
  }

  // Create auth context and wallet client
  updateStatus('auth.settingUpSession')
  const authContext = await createPKPAuthContext(pkpInfo, authData)
  const pkpWalletClient = await createPKPWalletClient(pkpInfo, authContext)
  const pkpAddress = pkpWalletClient.account?.address as Address

  // Setup Lens (without username)
  updateStatus('auth.settingUpLens')
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'pending' | 'complete' | 'failed' = 'pending'

  try {
    const existingAccounts = await getExistingAccounts(pkpAddress)

    if (existingAccounts.length > 0) {
      const firstAccount = existingAccounts[0]
      lensSession = await loginAsAccountOwner(pkpWalletClient, pkpAddress, firstAccount.account.address)
      lensAccount = firstAccount.account
      lensSetupStatus = 'complete'
    } else {
      // Create new account without username
      lensSession = await loginAsOnboardingUser(pkpWalletClient, pkpAddress)
      const metadataUri = generateDefaultMetadataUri()
      lensAccount = await createAccountWithoutUsername(lensSession, pkpWalletClient, metadataUri)
      lensSetupStatus = 'complete'
    }
  } catch (lensError) {
    console.error('[AuthFlow] Lens setup failed:', lensError)
    lensSetupStatus = 'failed'
  }

  updateStatus('auth.complete')

  return {
    pkpInfo,
    authData,
    pkpAuthContext: authContext,
    walletClient: pkpWalletClient,
    lensSession,
    lensAccount,
    lensSetupStatus,
  }
}

/**
 * Standalone Lens login (when PKP already exists)
 * Used for reconnecting to Lens after session expires or SSO flows
 */
export async function loginLensStandalone(
  walletClient: WalletClient,
  address: string,
  onStatus?: (statusKey: string) => void
): Promise<{ session: SessionClient; account: Account | null }> {
  const updateStatus = (statusKey: string) => {
    if (IS_DEV) {
      console.log('[AuthFlow]', statusKey)
    }
    onStatus?.(statusKey)
  }

  const walletAddress = address as Address

  // Check for existing accounts
  updateStatus('auth.checkingLensAccount')
  const existingAccounts = await getExistingAccounts(walletAddress)

  let session: SessionClient
  let account: Account | null = null

  if (existingAccounts.length > 0) {
    updateStatus('auth.connectingToLensAccount')
    const firstAccount = existingAccounts[0]
    session = await loginAsAccountOwner(walletClient, walletAddress, firstAccount.account.address)
    account = firstAccount.account
  } else {
    // Create new account without username
    updateStatus('auth.creatingNewLensAccount')
    session = await loginAsOnboardingUser(walletClient, walletAddress)
    const metadataUri = generateDefaultMetadataUri()
    account = await createAccountWithoutUsername(session, walletClient, metadataUri)
  }

  return { session, account }
}
