/**
 * Authentication Flows
 * Orchestrates Lit Protocol (PKP) + Lens Protocol authentication
 */

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
  createAccountInCustomNamespace,
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
 * 3. Setup Lens account (create new or connect existing)
 */
export async function registerWithPasskeyFlow(
  username?: string,
  onStatus?: (status: string) => void
): Promise<AuthFlowResult> {
  const updateStatus = (status: string) => {
    console.log('[AuthFlow]', status)
    onStatus?.(status)
  }

  // Step 1: Register with WebAuthn
  updateStatus('Creating passkey and wallet...')

  let registrationResult
  try {
    registrationResult = await registerUser(username, updateStatus)
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
  updateStatus('Setting up wallet...')
  const walletClient = await createPKPWalletClient(pkpInfo, authContext)
  const walletAddress = walletClient.account?.address as Address

  // Step 3: Setup Lens
  updateStatus('Setting up Lens profile...')
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'pending' | 'complete' | 'failed' = 'pending'

  try {
    // Check for existing accounts
    const existingAccounts = await getExistingAccounts(walletAddress)

    if (existingAccounts.length > 0) {
      // Login to existing account
      updateStatus('Found existing Lens account, connecting...')
      const firstAccount = existingAccounts[0]
      lensSession = await loginAsAccountOwner(walletClient, walletAddress, firstAccount.account.address)
      lensAccount = firstAccount.account
      lensSetupStatus = 'complete'
    } else if (username) {
      // Create new account with username
      updateStatus('Creating new Lens account...')
      lensSession = await loginAsOnboardingUser(walletClient, walletAddress)

      const metadataUri = generateDefaultMetadataUri()
      lensAccount = await createAccountInCustomNamespace(
        lensSession,
        walletClient,
        username,
        metadataUri
      )
      lensSetupStatus = 'complete'
    } else {
      // No username provided, skip Lens setup
      console.log('[AuthFlow] No username provided, skipping Lens account creation')
      lensSetupStatus = 'pending'
    }
  } catch (lensError) {
    console.error('[AuthFlow] Lens setup failed:', lensError)
    lensSetupStatus = 'failed'
    // Don't throw - user can still use the app without Lens
  }

  updateStatus('Complete!')

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
  onStatus?: (status: string) => void
): Promise<AuthFlowResult> {
  const updateStatus = (status: string) => {
    console.log('[AuthFlow]', status)
    onStatus?.(status)
  }

  // Step 1: Authenticate with WebAuthn
  updateStatus('Authenticating with passkey...')
  const { pkpInfo, authData, authContext } = await loginUser(updateStatus)

  // Step 2: Create wallet client
  updateStatus('Setting up wallet...')
  const walletClient = await createPKPWalletClient(pkpInfo, authContext)
  const walletAddress = walletClient.account?.address as Address

  // Step 3: Resume or setup Lens
  updateStatus('Connecting to Lens...')
  let lensSession: SessionClient | null = null
  let lensAccount: Account | null = null
  let lensSetupStatus: 'pending' | 'complete' | 'failed' = 'pending'

  try {
    // Try to resume existing session first
    lensSession = await resumeLensSession()

    if (lensSession) {
      updateStatus('Lens session resumed!')
      // TODO: Get account from session
      lensSetupStatus = 'complete'
    } else {
      // No session, check for existing accounts
      const existingAccounts = await getExistingAccounts(walletAddress)
      console.log('[AuthFlow] Existing accounts:', existingAccounts)

      if (existingAccounts.length > 0) {
        updateStatus('Connecting to Lens account...')
        const firstAccount = existingAccounts[0]
        console.log('[AuthFlow] First account:', firstAccount)

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
          console.log('[AuthFlow] Lens login successful, account:', lensAccount)
        }
      } else {
        console.log('[AuthFlow] No Lens account found for this wallet')
        lensSetupStatus = 'pending'
      }
    }
  } catch (lensError) {
    console.error('[AuthFlow] Lens connection failed:', lensError)
    lensSetupStatus = 'failed'
    // Don't throw - user can still use the app without Lens
  }

  updateStatus('Complete!')

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
  username?: string,
  onStatus?: (status: string) => void
): Promise<AuthFlowResult> {
  const updateStatus = (status: string) => {
    console.log('[AuthFlow]', status)
    onStatus?.(status)
  }

  const { registerWithEoa, loginWithEoa, getExistingPkpForEoa } = await import('@/lib/lit')

  const address = walletClient.account?.address
  if (!address) {
    throw new Error('No wallet address')
  }

  updateStatus('Checking for existing account...')

  // Check if PKP already exists for this EOA
  const existingPkp = await getExistingPkpForEoa(address)

  let pkpInfo: PKPInfo
  let authData: AuthData

  if (existingPkp) {
    updateStatus('Found existing account, signing in...')
    const result = await loginWithEoa(walletClient)
    pkpInfo = result.pkpInfo
    authData = result.authData
  } else {
    updateStatus('Creating new wallet...')
    const result = await registerWithEoa(walletClient)
    pkpInfo = result.pkpInfo
    authData = result.authData
  }

  // Create auth context and wallet client
  updateStatus('Setting up session...')
  const authContext = await createPKPAuthContext(pkpInfo, authData)
  const pkpWalletClient = await createPKPWalletClient(pkpInfo, authContext)
  const pkpAddress = pkpWalletClient.account?.address as Address

  // Setup Lens
  updateStatus('Setting up Lens...')
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
    } else if (username) {
      lensSession = await loginAsOnboardingUser(pkpWalletClient, pkpAddress)
      const metadataUri = generateDefaultMetadataUri()
      lensAccount = await createAccountInCustomNamespace(lensSession, pkpWalletClient, username, metadataUri)
      lensSetupStatus = 'complete'
    }
  } catch (lensError) {
    console.error('[AuthFlow] Lens setup failed:', lensError)
    lensSetupStatus = 'failed'
  }

  updateStatus('Complete!')

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
 * Used for reconnecting to Lens after session expires
 */
export async function loginLensStandalone(
  walletClient: WalletClient,
  address: string,
  username?: string,
  onStatus?: (status: string) => void
): Promise<{ session: SessionClient; account: Account | null }> {
  const updateStatus = (status: string) => {
    console.log('[AuthFlow]', status)
    onStatus?.(status)
  }

  const walletAddress = address as Address

  // Check for existing accounts
  updateStatus('Checking for Lens account...')
  const existingAccounts = await getExistingAccounts(walletAddress)

  let session: SessionClient
  let account: Account | null = null

  if (existingAccounts.length > 0) {
    updateStatus('Connecting to Lens account...')
    const firstAccount = existingAccounts[0]
    session = await loginAsAccountOwner(walletClient, walletAddress, firstAccount.account.address)
    account = firstAccount.account
  } else if (username) {
    updateStatus('Creating new Lens account...')
    session = await loginAsOnboardingUser(walletClient, walletAddress)
    const metadataUri = generateDefaultMetadataUri()
    account = await createAccountInCustomNamespace(session, walletClient, username, metadataUri)
  } else {
    // Login as onboarding user without creating account
    updateStatus('Connecting to Lens...')
    session = await loginAsOnboardingUser(walletClient, walletAddress)
  }

  return { session, account }
}
