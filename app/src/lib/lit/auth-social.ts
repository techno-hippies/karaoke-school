/**
 * Social Authentication (Google/Discord)
 *
 * Uses Lit Protocol's GoogleAuthenticator and DiscordAuthenticator
 * to authenticate users via OAuth and mint/retrieve PKPs.
 */

import { GoogleAuthenticator, DiscordAuthenticator } from '@lit-protocol/auth'
import { getLitClient, getAuthManager } from './client'
import { saveSession } from './storage'
import { LIT_LOGIN_SERVER_URL } from './constants'
import { LIT_WEBAUTHN_CONFIG } from './config'
import type { PKPInfo, AuthData, PKPAuthContext } from './types'

const IS_DEV = import.meta.env.DEV

export interface SocialAuthResult {
  pkpInfo: PKPInfo
  authContext: PKPAuthContext
  authData: AuthData
}

export interface SocialAuthOptions {
  // Reserved for future options
}

/**
 * Authenticate with Google OAuth
 *
 * Auto-detects whether user has an existing PKP:
 * - If PKP exists: returns it (sign in)
 * - If no PKP: mints new one (create account)
 */
export async function authGoogle(
  onStatusUpdate: (status: string) => void,
  _options?: SocialAuthOptions
): Promise<SocialAuthResult> {
  onStatusUpdate('auth.openingGoogle')

  try {
    // Step 1: Authenticate with Google via Lit Login Server
    if (IS_DEV) console.log('[SocialAuth] Starting Google authentication...')
    const authData = await GoogleAuthenticator.authenticate(LIT_LOGIN_SERVER_URL)

    if (IS_DEV) console.log('[SocialAuth] Google auth successful, authMethodType:', authData.authMethodType)

    const litClient = await getLitClient()
    const authManager = getAuthManager()
    let pkpInfo: PKPInfo

    // Step 2: Check for existing PKP
    onStatusUpdate('auth.fetchingAccount')
    if (IS_DEV) console.log('[SocialAuth] Checking for existing PKP...')

    const result = await litClient.viewPKPsByAuthData({
      authData: {
        authMethodType: authData.authMethodType,
        authMethodId: authData.authMethodId,
      },
      pagination: {
        limit: 5,
        offset: 0,
      },
    })

    if (result?.pkps && result.pkps.length > 0) {
      // Existing user - use their PKP
      const foundPkp = result.pkps[0]
      pkpInfo = {
        publicKey: foundPkp.pubkey,
        ethAddress: foundPkp.ethAddress as `0x${string}`,
        tokenId: foundPkp.tokenId.toString(),
      }
      if (IS_DEV) console.log('[SocialAuth] Found existing PKP:', pkpInfo.ethAddress)
    } else {
      // New user - mint PKP
      onStatusUpdate('auth.creatingAccount')
      if (IS_DEV) console.log('[SocialAuth] Minting new PKP for Google user...')

      const mintResult = await litClient.authService.mintWithAuth({
        authData: authData,
        authServiceBaseUrl: LIT_WEBAUTHN_CONFIG.authServiceUrl,
        scopes: ['sign-anything'],
      })

      if (IS_DEV) console.log('[SocialAuth] Google mint result:', mintResult)

      // mintWithAuth returns { data: { pubkey, ethAddress, tokenId }, txHash, _raw }
      const pkpData = (mintResult as any).data || (mintResult as any).pkp || (mintResult as any).pkpInfo || mintResult

      pkpInfo = {
        publicKey: pkpData.pubkey,
        ethAddress: pkpData.ethAddress as `0x${string}`,
        tokenId: pkpData.tokenId?.toString() || '0',
      }

      if (IS_DEV) console.log('[SocialAuth] Minted new PKP:', pkpInfo.ethAddress)
    }

    // Step 3: Create auth context (session signature)
    onStatusUpdate('auth.almostDone')
    if (IS_DEV) console.log('[SocialAuth] Creating auth context...')

    const authDataTyped: AuthData = {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
      accessToken: authData.accessToken,
    }

    const authContext = await authManager.createPkpAuthContext({
      authData: authData,
      pkpPublicKey: pkpInfo.publicKey,
      authConfig: {
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        statement: 'Execute Lit Actions, sign transactions, and decrypt content',
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        resources: [
          ['lit-action-execution', '*'],
          ['pkp-signing', '*'],
          ['access-control-condition-decryption', '*'],
        ],
      },
      litClient: litClient,
    })

    if (IS_DEV) console.log('[SocialAuth] Auth context created')

    // Save session
    saveSession(pkpInfo, authDataTyped)

    return {
      pkpInfo,
      authContext,
      authData: authDataTyped,
    }
  } catch (error) {
    console.error('[SocialAuth] Google authentication failed:', error)

    // Re-throw with user-friendly message
    if (error instanceof Error) {
      if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
        throw new Error('Google sign-in was cancelled.')
      }
      if (error.message.includes('popup')) {
        throw new Error('Google sign-in popup was blocked. Please allow popups and try again.')
      }
    }
    throw error
  }
}

/**
 * Authenticate with Discord OAuth
 *
 * Auto-detects whether user has an existing PKP:
 * - If PKP exists: returns it (sign in)
 * - If no PKP: mints new one (create account)
 */
export async function authDiscord(
  onStatusUpdate: (status: string) => void,
  _options?: SocialAuthOptions
): Promise<SocialAuthResult> {
  onStatusUpdate('auth.openingDiscord')

  try {
    // Step 1: Authenticate with Discord via Lit Login Server
    if (IS_DEV) console.log('[SocialAuth] Starting Discord authentication...')
    const authData = await DiscordAuthenticator.authenticate(LIT_LOGIN_SERVER_URL)

    if (IS_DEV) console.log('[SocialAuth] Discord auth successful, authMethodType:', authData.authMethodType)

    const litClient = await getLitClient()
    const authManager = getAuthManager()
    let pkpInfo: PKPInfo

    // Step 2: Check for existing PKP
    onStatusUpdate('auth.fetchingAccount')
    if (IS_DEV) console.log('[SocialAuth] Checking for existing PKP...')

    const result = await litClient.viewPKPsByAuthData({
      authData: {
        authMethodType: authData.authMethodType,
        authMethodId: authData.authMethodId,
      },
      pagination: {
        limit: 5,
        offset: 0,
      },
    })

    if (result?.pkps && result.pkps.length > 0) {
      // Existing user - use their PKP
      const foundPkp = result.pkps[0]
      pkpInfo = {
        publicKey: foundPkp.pubkey,
        ethAddress: foundPkp.ethAddress as `0x${string}`,
        tokenId: foundPkp.tokenId.toString(),
      }
      if (IS_DEV) console.log('[SocialAuth] Found existing PKP:', pkpInfo.ethAddress)
    } else {
      // New user - mint PKP
      onStatusUpdate('auth.creatingAccount')
      if (IS_DEV) console.log('[SocialAuth] Minting new PKP for Discord user...')

      const mintResult = await litClient.authService.mintWithAuth({
        authData: authData,
        authServiceBaseUrl: LIT_WEBAUTHN_CONFIG.authServiceUrl,
        scopes: ['sign-anything'],
      })

      if (IS_DEV) console.log('[SocialAuth] Discord mint result:', mintResult)

      // mintWithAuth returns { data: { pubkey, ethAddress, tokenId }, txHash, _raw }
      const pkpData = (mintResult as any).data || (mintResult as any).pkp || (mintResult as any).pkpInfo || mintResult

      pkpInfo = {
        publicKey: pkpData.pubkey,
        ethAddress: pkpData.ethAddress as `0x${string}`,
        tokenId: pkpData.tokenId?.toString() || '0',
      }

      if (IS_DEV) console.log('[SocialAuth] Minted new PKP:', pkpInfo.ethAddress)
    }

    // Step 3: Create auth context (session signature)
    onStatusUpdate('auth.almostDone')
    if (IS_DEV) console.log('[SocialAuth] Creating auth context...')

    const authDataTyped: AuthData = {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
      accessToken: authData.accessToken,
    }

    const authContext = await authManager.createPkpAuthContext({
      authData: authData,
      pkpPublicKey: pkpInfo.publicKey,
      authConfig: {
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        statement: 'Execute Lit Actions, sign transactions, and decrypt content',
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        resources: [
          ['lit-action-execution', '*'],
          ['pkp-signing', '*'],
          ['access-control-condition-decryption', '*'],
        ],
      },
      litClient: litClient,
    })

    if (IS_DEV) console.log('[SocialAuth] Auth context created')

    // Save session
    saveSession(pkpInfo, authDataTyped)

    return {
      pkpInfo,
      authContext,
      authData: authDataTyped,
    }
  } catch (error) {
    console.error('[SocialAuth] Discord authentication failed:', error)

    // Re-throw with user-friendly message
    if (error instanceof Error) {
      if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
        throw new Error('Discord sign-in was cancelled.')
      }
      if (error.message.includes('popup')) {
        throw new Error('Discord sign-in popup was blocked. Please allow popups and try again.')
      }
    }
    throw error
  }
}

