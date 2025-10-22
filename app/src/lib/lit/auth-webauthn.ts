/**
 * WebAuthn Authentication
 * Register and authenticate with WebAuthn passkeys
 */

import { WebAuthnAuthenticator } from '@lit-protocol/auth'
import { getLitClient } from './client'
import { LIT_WEBAUTHN_CONFIG } from './config'
import { saveSession } from './storage'
import type { RegisterResult, AuthData, PKPInfo } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Register new WebAuthn credential and mint PKP
 * This is for NEW users creating an account
 *
 * Signatures required: 2
 * - WebAuthn registration challenge
 * - PKP minting transaction
 */
export async function registerWithWebAuthn(): Promise<RegisterResult> {
  if (IS_DEV) console.log('[LitWebAuthn] Starting registration...')

  try {
    // Register and mint PKP - matches working demo exactly
    const result = await WebAuthnAuthenticator.registerAndMintPKP({
      authServiceBaseUrl: LIT_WEBAUTHN_CONFIG.authServiceUrl,
      scopes: ['sign-anything'],
    }) as { pkpInfo: any; webAuthnPublicKey: string; authData?: any }

    if (IS_DEV) {
      console.log('[LitWebAuthn] Registration successful:', {
        ethAddress: result.pkpInfo.ethAddress,
        publicKey: result.pkpInfo.pubkey.slice(0, 20) + '...',
        hasAuthData: !!result.authData,
      })
    }

    // Extract PKP info
    const pkpInfo: PKPInfo = {
      publicKey: result.pkpInfo.pubkey,
      ethAddress: result.pkpInfo.ethAddress as `0x${string}`,
      tokenId: result.pkpInfo.tokenId.toString(),
    }

    // Extract authData - should be included in registration with stable 8.0.2
    if (!result.authData) {
      throw new Error('Registration did not return authData. This should not happen with stable Lit SDK 8.0.2.')
    }

    const authData: AuthData = {
      authMethodType: result.authData.authMethodType,
      authMethodId: result.authData.authMethodId,
      accessToken: result.authData.accessToken,
    }

    if (IS_DEV) console.log('[LitWebAuthn] Using authData from registration')

    // Save session
    saveSession(pkpInfo, authData)

    return {
      pkpInfo,
      authData,
      webAuthnPublicKey: result.webAuthnPublicKey || '',
    }
  } catch (error) {
    console.error('[LitWebAuthn] Registration failed:', error)
    throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Authenticate with existing WebAuthn credential
 * This is for RETURNING users signing in
 *
 * Signatures required: 1
 * - WebAuthn authentication challenge
 */
export async function authenticateWithWebAuthn(): Promise<{ pkpInfo: PKPInfo; authData: AuthData }> {
  if (IS_DEV) console.log('[LitWebAuthn] Starting authentication...')

  try {
    // Authenticate with WebAuthn
    const authData = await WebAuthnAuthenticator.authenticate()

    if (IS_DEV) {
      console.log('[LitWebAuthn] Authentication successful:', {
        authMethodType: authData.authMethodType,
        authMethodId: authData.authMethodId.slice(0, 20) + '...',
      })
    }

    // Get PKP for this credential
    const litClient = await getLitClient()

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
      throw new Error('No PKP found for this credential. Please register first.')
    }

    const pkp = pkpsResult.pkps[0]

    const pkpInfo: PKPInfo = {
      publicKey: pkp.pubkey,
      ethAddress: pkp.ethAddress as `0x${string}`,
      tokenId: pkp.tokenId.toString(),
    }

    if (IS_DEV) {
      console.log('[LitWebAuthn] PKP found:', {
        ethAddress: pkpInfo.ethAddress,
        publicKey: pkpInfo.publicKey.slice(0, 20) + '...',
      })
    }

    // Save session
    saveSession(pkpInfo, {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
      accessToken: authData.accessToken,
    })

    return {
      pkpInfo,
      authData: {
        authMethodType: authData.authMethodType,
        authMethodId: authData.authMethodId,
        accessToken: authData.accessToken,
      },
    }
  } catch (error) {
    console.error('[LitWebAuthn] Authentication failed:', error)

    // Check if error is due to no credential found
    if (error instanceof Error && error.message.includes('credential')) {
      throw new Error('No passkey found. Please create an account first.')
    }

    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if user has existing WebAuthn credential
 * Note: This is NOT recommended as it requires an extra signature
 * Instead, use two separate buttons (Register / Sign In)
 */
export async function hasExistingCredential(): Promise<boolean> {
  try {
    await WebAuthnAuthenticator.authenticate()
    return true
  } catch {
    return false
  }
}
