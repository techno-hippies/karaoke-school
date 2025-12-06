/**
 * Session Persistence
 * Manages localStorage for PKP and auth data
 */

import { LIT_WEBAUTHN_CONFIG } from './config'
import type { SessionData, PKPInfo, AuthData, AuthStatus } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Save session to localStorage
 */
export function saveSession(pkpInfo: PKPInfo, authData: AuthData): void {
  const expiresAt = Date.now() + LIT_WEBAUTHN_CONFIG.sessionExpirationMs

  const session: SessionData = {
    pkpInfo,
    authData,
    expiresAt,
  }

  try {
    localStorage.setItem(
      LIT_WEBAUTHN_CONFIG.storageKeys.session,
      JSON.stringify(session)
    )

    if (IS_DEV) {
      console.log('[LitWebAuthn] Session saved:', {
        address: pkpInfo.ethAddress,
        expiresAt: new Date(expiresAt).toISOString(),
      })
    }
  } catch (error) {
    console.error('[LitWebAuthn] Failed to save session:', error)
  }
}

/**
 * Load session from localStorage
 */
export function loadSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(LIT_WEBAUTHN_CONFIG.storageKeys.session)

    if (!stored) {
      if (IS_DEV) console.log('[LitWebAuthn] No session found')
      return null
    }

    const session: SessionData = JSON.parse(stored)

    // Check if expired
    if (Date.now() >= session.expiresAt) {
      if (IS_DEV) console.log('[LitWebAuthn] Session expired')
      clearSession()
      return null
    }

    if (IS_DEV) {
      console.log('[LitWebAuthn] Session loaded:', {
        address: session.pkpInfo.ethAddress,
        expiresAt: new Date(session.expiresAt).toISOString(),
      })
    }

    return session
  } catch (error) {
    console.error('[LitWebAuthn] Failed to load session:', error)
    clearSession()
    return null
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(LIT_WEBAUTHN_CONFIG.storageKeys.session)

    // Also clear auth manager storage to prevent stale PKP data
    const authManagerKey = `lit-auth:${LIT_WEBAUTHN_CONFIG.networkName}:karaoke-school`
    localStorage.removeItem(authManagerKey)

    if (IS_DEV) console.log('[LitWebAuthn] Session cleared')
  } catch (error) {
    console.error('[LitWebAuthn] Failed to clear session:', error)
  }
}

/**
 * Get authentication status
 */
export function getAuthStatus(): AuthStatus {
  const session = loadSession()

  return {
    isAuthenticated: session !== null,
    pkpInfo: session?.pkpInfo || null,
    authData: session?.authData || null,
    expiresAt: session?.expiresAt || null,
  }
}
