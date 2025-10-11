/**
 * Authentication Flow
 * Separate flows for register (create account) and login (sign in)
 */

import { WebAuthnAuthenticator } from '@lit-protocol/auth'
import { getLitClient, getAuthManager } from './client'
import { LIT_WEBAUTHN_CONFIG } from './config'
import { saveSession } from './storage'
import { createPKPAuthContext } from './auth-pkp'
import type { PKPInfo, AuthData, PKPAuthContext } from './types'

const AUTH_SERVICE_URL = LIT_WEBAUTHN_CONFIG.authServiceUrl

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  authContext: PKPAuthContext
  isNewUser: boolean
}

/**
 * Register new user: WebAuthn → Mint PKP → Auth Context
 * For users creating a new account
 */
export async function registerUser(
  onStatusUpdate: (status: string) => void
): Promise<AuthFlowResult> {
  onStatusUpdate('Initializing Lit Protocol...')
  const litClient = await getLitClient()

  // Register new WebAuthn credential and mint PKP
  onStatusUpdate('Please create a passkey using your device...')
  const registerResult = await WebAuthnAuthenticator.registerAndMintPKP({
    authServiceBaseUrl: AUTH_SERVICE_URL,
    scopes: ['sign-anything'],
  })

  console.log('✅ Registered new credential and minted PKP')

  const pkpInfo = registerResult.pkpInfo
  let authData = registerResult.authData

  // If authData not included, authenticate with the newly created credential
  if (!authData) {
    onStatusUpdate('Authenticating with your new passkey...')
    authData = await WebAuthnAuthenticator.authenticate({
      authServiceBaseUrl: AUTH_SERVICE_URL,
    })
    console.log('✅ Authenticated with new credential')
  }

  // Create auth context (session signature)
  onStatusUpdate('Creating secure session...')
  const authManager = await getAuthManager()

  const authContext = await authManager.createPkpAuthContext({
    authData: authData,
    pkpPublicKey: pkpInfo.pubkey,
    authConfig: {
      resources: [
        ['pkp-signing', '*'],
        ['lit-action-execution', '*'],
      ],
      expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      statement: 'Karaoke School',
      domain: window.location.origin,
    },
    litClient: litClient,
  })

  console.log('✅ Auth context created')

  // Convert to our types
  const result: AuthFlowResult = {
    pkpInfo: {
      publicKey: pkpInfo.pubkey,
      ethAddress: pkpInfo.ethAddress as `0x${string}`,
      tokenId: pkpInfo.tokenId.toString(),
    },
    authData: {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
      accessToken: authData.accessToken,
    },
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
  onStatusUpdate('Initializing Lit Protocol...')
  const litClient = await getLitClient()

  // Authenticate with existing WebAuthn credential
  onStatusUpdate('Please authenticate with your device...')
  const authData = await WebAuthnAuthenticator.authenticate({
    authServiceBaseUrl: AUTH_SERVICE_URL,
  })

  console.log('✅ Authenticated with existing credential')

  // Get PKP for this credential
  onStatusUpdate('Fetching your account...')
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
  console.log('✅ PKP found:', pkpInfo.ethAddress)

  // Create auth context (session signature)
  onStatusUpdate('Creating secure session...')
  const authManager = await getAuthManager()

  const authContext = await authManager.createPkpAuthContext({
    authData: authData,
    pkpPublicKey: pkpInfo.pubkey,
    authConfig: {
      resources: [
        ['pkp-signing', '*'],
        ['lit-action-execution', '*'],
      ],
      expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      statement: 'Karaoke School',
      domain: window.location.origin,
    },
    litClient: litClient,
  })

  console.log('✅ Auth context created')

  // Convert to our types
  const result: AuthFlowResult = {
    pkpInfo: {
      publicKey: pkpInfo.pubkey,
      ethAddress: pkpInfo.ethAddress as `0x${string}`,
      tokenId: pkpInfo.tokenId.toString(),
    },
    authData: {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
      accessToken: authData.accessToken,
    },
    authContext,
    isNewUser: false,
  }

  // Save session
  saveSession(result.pkpInfo, result.authData)

  return result
}

/**
 * Unified authentication flow (backwards compat)
 * Auto-detects new vs returning users
 */
export async function authenticateUser(
  onStatusUpdate: (status: string) => void
): Promise<AuthFlowResult> {
  try {
    // Try login first
    return await loginUser(onStatusUpdate)
  } catch (error) {
    // If login fails, try register
    console.log('Login failed, attempting registration...')
    return await registerUser(onStatusUpdate)
  }
}
