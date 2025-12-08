/**
 * Authentication Flow
 * Separate flows for register (create account) and login (sign in)
 */

import { WebAuthnAuthenticator } from '@lit-protocol/auth'
import i18n from '../i18n'
import { getLitClient } from './client'
import { LIT_WEBAUTHN_CONFIG } from './config'
import { saveSession } from './storage'
import { createPKPAuthContext } from './auth-pkp'
import type { PKPInfo, AuthData, PKPAuthContext } from './types'

const AUTH_SERVICE_URL = LIT_WEBAUTHN_CONFIG.authServiceUrl
const IS_DEV = import.meta.env.DEV

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  authContext: PKPAuthContext
  isNewUser: boolean
}

/**
 * Register new user: WebAuthn → Mint PKP → Auth Context
 * For users creating a new account
 *
 * @param onStatusUpdate - Callback for status updates
 */
export async function registerUser(
  onStatusUpdate: (status: string) => void
): Promise<AuthFlowResult> {
  onStatusUpdate(i18n.t('auth.settingUp'))
  await getLitClient()

  // Register new WebAuthn credential and mint PKP
  // Passkey name is auto-generated (shows in device's passkey manager)
  onStatusUpdate(i18n.t('auth.createPasskey'))
  const registerResult = await WebAuthnAuthenticator.registerAndMintPKP({
    username: `kschool-${Date.now()}`,
    authServiceBaseUrl: AUTH_SERVICE_URL,
    scopes: ['sign-anything'],
  })

  if (IS_DEV) console.log('✅ Registered new credential and minted PKP')

  const pkpInfo = registerResult.pkpInfo

  // SDK v8: registerAndMintPKP only returns { pkpInfo, webAuthnPublicKey }
  // We must call authenticate() separately to get authData
  onStatusUpdate(i18n.t('auth.verifyingPasskey'))
  const authData = await WebAuthnAuthenticator.authenticate()
  if (IS_DEV) console.log('✅ Authenticated with new credential')

  // Create auth context (session signature)
  onStatusUpdate(i18n.t('auth.almostDone'))

  // Convert PKP info to our types first
  const pkpInfoTyped: PKPInfo = {
    publicKey: pkpInfo.pubkey,
    ethAddress: pkpInfo.ethAddress as `0x${string}`,
    tokenId: pkpInfo.tokenId.toString(),
  }

  const authDataTyped: AuthData = {
    authMethodType: authData.authMethodType,
    authMethodId: authData.authMethodId,
    accessToken: authData.accessToken,
  }

  // Use centralized auth context creation
  const authContext = await createPKPAuthContext(pkpInfoTyped, authDataTyped)

  if (IS_DEV) console.log('✅ Auth context created')

  // Build result
  const result: AuthFlowResult = {
    pkpInfo: pkpInfoTyped,
    authData: authDataTyped,
    authContext,
    isNewUser: true,
  }

  // Save session
  saveSession(result.pkpInfo, result.authData)

  return result
}

/**
 * Login existing user: Authenticate WebAuthn → Get PKP → Auth Context
 * For users who already have an account
 */
export async function loginUser(
  onStatusUpdate: (status: string) => void
): Promise<AuthFlowResult> {
  onStatusUpdate(i18n.t('auth.settingUp'))
  const litClient = await getLitClient()

  // Authenticate with existing WebAuthn credential
  onStatusUpdate(i18n.t('auth.authenticateDevice'))
  const authData = await WebAuthnAuthenticator.authenticate()

  if (IS_DEV) console.log('✅ Authenticated with existing credential')

  // Get PKP for this credential
  onStatusUpdate(i18n.t('auth.fetchingAccount'))
  const pkpsResult = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
    },
    pagination: {
      limit: 5,
      offset: 0,
    },
  })

  if (!pkpsResult || !pkpsResult.pkps || pkpsResult.pkps.length === 0) {
    throw new Error('No account found. Please create a new account instead.')
  }

  const pkpInfo = pkpsResult.pkps[0]
  if (IS_DEV) console.log('✅ PKP found:', pkpInfo.ethAddress)

  // Create auth context (session signature)
  onStatusUpdate(i18n.t('auth.almostDone'))

  // Convert PKP info to our types first
  const pkpInfoTyped: PKPInfo = {
    publicKey: pkpInfo.pubkey,
    ethAddress: pkpInfo.ethAddress as `0x${string}`,
    tokenId: pkpInfo.tokenId.toString(),
  }

  const authDataTyped: AuthData = {
    authMethodType: authData.authMethodType,
    authMethodId: authData.authMethodId,
    accessToken: authData.accessToken,
  }

  // Use centralized auth context creation
  const authContext = await createPKPAuthContext(pkpInfoTyped, authDataTyped)

  if (IS_DEV) console.log('✅ Auth context created')

  // Build result
  const result: AuthFlowResult = {
    pkpInfo: pkpInfoTyped,
    authData: authDataTyped,
    authContext,
    isNewUser: false,
  }

  // Save session
  saveSession(result.pkpInfo, result.authData)

  return result
}
