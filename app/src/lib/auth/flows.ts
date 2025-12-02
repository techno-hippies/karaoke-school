// src/lib/auth/flows.ts

import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import { account as accountMetadata } from '@lens-protocol/metadata'
import { StorageClient } from '@lens-chain/storage-client'

import i18n from '@/lib/i18n'
import type { PKPInfo, AuthData } from '@/lib/lit'
import {
  loginAsOnboardingUser,
  loginAsAccountOwner,
  getExistingAccounts,
} from '@/lib/lens/auth'
import {
  createAccountInCustomNamespace,
  validateUsernameFormat,
} from '@/lib/lens/account-creation'

// 🔁 NEW: dynamic loaders for Lit + Lit auth-flow
type LitModule = typeof import('@/lib/lit')
type LitAuthFlowModule = typeof import('@/lib/lit/auth-flow')

function loadLit(): Promise<LitModule> {
  return import('@/lib/lit')
}

function loadLitAuthFlow(): Promise<LitAuthFlowModule> {
  return import('@/lib/lit/auth-flow')
}

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  pkpAuthContext: import('@/lib/lit').PKPAuthContext
  walletClient: WalletClient
  lensSession: SessionClient
  lensAccount: Account
  lensSetupStatus: 'complete' | 'failed'
}

export type StatusCallback = (status: string) => void

// ---------------- connectLensSession stays the same ----------------

async function connectLensSession(
  walletClient: WalletClient,
  address: Address,
  username: string | undefined,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account }> {
  console.log('[Auth Flow] ===== Starting connectLensSession =====')
  console.log('[Auth Flow] PKP Address:', address)

  statusCallback(i18n.t('auth.finishingSetup'))

  try {
    console.log('[Auth Flow] Step 1: Checking for existing accounts...')
    const existingAccounts = await getExistingAccounts(address)
    console.log('[Auth Flow] Found', existingAccounts.length, 'existing account(s)')
    const hasAccount = existingAccounts.length > 0

    let session: SessionClient
    let account: Account

    if (hasAccount) {
      console.log('[Auth Flow] Path: EXISTING ACCOUNT - Logging in as ACCOUNT_OWNER')
      account = existingAccounts[0].account
      console.log('[Auth Flow] Account address:', account.address)

      session = await loginAsAccountOwner(walletClient, address, account.address)
      console.log('[Auth Flow] ✓ Logged in as ACCOUNT_OWNER:', account.address)
    } else {
      console.log('[Auth Flow] Path: NEW ACCOUNT - Creating account with username:', username)

      if (!username) {
        throw new Error('Username is required to create a new account')
      }

      const validationError = validateUsernameFormat(username)
      if (validationError) {
        throw new Error(validationError)
      }

      console.log('[Auth Flow] Step 2a: Logging in as ONBOARDING_USER...')
      session = await loginAsOnboardingUser(walletClient, address)
      console.log('[Auth Flow] ✓ Logged in as ONBOARDING_USER')

      console.log('[Auth Flow] Step 2b: Creating account metadata...')
      const displayName = username
      const metadata = accountMetadata({
        name: displayName,
        bio: username,
      })
      console.log('[Auth Flow] Metadata name:', displayName)

      console.log('[Auth Flow] Step 2c: Uploading metadata to storage...')
      const storageClient = StorageClient.create()
      const uploadResult = await storageClient.uploadAsJson(metadata)
      console.log('[Auth Flow] ✓ Metadata uploaded:', uploadResult.uri)

      console.log('[Auth Flow] Step 3: Creating account on-chain...')

      console.log('[Auth Flow] Creating account with username in custom namespace:', username)
      account = await createAccountInCustomNamespace(
        session,
        walletClient,
        username,
        uploadResult.uri
      )
      console.log('[Auth Flow] ✓ Account created with username:', account.username?.localName)

      console.log('[Auth Flow] ✓ Account created:', account.address)
      console.log('[Auth Flow] Account owner:', account.owner)
      console.log('[Auth Flow] Account username:', account.username?.localName || 'none')
    }

    console.log('[Auth Flow] ===== connectLensSession COMPLETE =====')
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

// ---------------- Register flow (Lit now dynamic) ----------------

export async function registerWithPasskeyFlow(
  username: string | undefined,
  statusCallback: StatusCallback
): Promise<AuthFlowResult> {
  statusCallback(i18n.t('auth.settingUp'))

  // WebAuthn + PKP mint
  const { registerUser } = await loadLitAuthFlow()
  const result = await registerUser(username, (status) => {
    statusCallback(status)
  })

  // PKP wallet client
  statusCallback(i18n.t('auth.almostDone'))
  const { createPKPAuthContext, createPKPWalletClient } = await loadLit()
  const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
  const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

  // Lens account / session
  statusCallback(i18n.t('auth.finishingSetup'))
  const lensResult = await connectLensSession(
    walletClient,
    result.pkpInfo.ethAddress,
    username,
    statusCallback
  )

  statusCallback(i18n.t('auth.allSet'))

  return {
    pkpInfo: result.pkpInfo,
    authData: result.authData,
    pkpAuthContext,
    walletClient,
    lensSession: lensResult.session,
    lensAccount: lensResult.account,
    lensSetupStatus: 'complete',
  }
}

// ---------------- Sign-in flow (Lit now dynamic) ----------------

export async function signInWithPasskeyFlow(
  statusCallback: StatusCallback
): Promise<AuthFlowResult> {
  statusCallback(i18n.t('auth.settingUp'))

  const { loginUser } = await loadLitAuthFlow()
  const result = await loginUser((status) => {
    statusCallback(status)
  })

  statusCallback(i18n.t('auth.almostDone'))
  const { createPKPAuthContext, createPKPWalletClient } = await loadLit()
  const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
  const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

  statusCallback(i18n.t('auth.finishingSetup'))
  const lensResult = await connectLensSession(
    walletClient,
    result.pkpInfo.ethAddress,
    undefined,
    statusCallback
  )

  statusCallback(i18n.t('auth.allSet'))

  return {
    pkpInfo: result.pkpInfo,
    authData: result.authData,
    pkpAuthContext,
    walletClient,
    lensSession: lensResult.session,
    lensAccount: lensResult.account,
    lensSetupStatus: 'complete',
  }
}

// ---------------- Standalone Lens login (unchanged) ----------------

export async function loginLensStandalone(
  walletClient: WalletClient,
  address: Address,
  username: string | undefined,
  statusCallback: StatusCallback
): Promise<{ session: SessionClient; account: Account }> {
  return connectLensSession(walletClient, address, username, statusCallback)
}
