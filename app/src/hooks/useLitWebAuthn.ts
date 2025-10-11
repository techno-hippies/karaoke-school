/**
 * Lit WebAuthn Hook
 * React hook for WebAuthn registration and authentication
 */

import { useState, useCallback } from 'react'
import {
  registerWithWebAuthn,
  authenticateWithWebAuthn,
  getAuthStatus,
  clearSession,
  clearAuthContext,
} from '@/lib/lit-webauthn'
import type { PKPInfo, AuthData } from '@/lib/lit-webauthn'

export interface UseLitWebAuthnResult {
  // State
  isRegistering: boolean
  isAuthenticating: boolean
  error: Error | null

  // Actions
  register: () => Promise<{ pkpInfo: PKPInfo; authData: AuthData } | null>
  authenticate: () => Promise<{ pkpInfo: PKPInfo; authData: AuthData } | null>
  logout: () => void

  // Utilities
  clearError: () => void
}

/**
 * Hook for WebAuthn authentication flow
 * Handles registration (create account) and authentication (sign in)
 */
export function useLitWebAuthn(): UseLitWebAuthnResult {
  const [isRegistering, setIsRegistering] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Register new user with WebAuthn
   * Creates passkey + mints PKP (2 signatures)
   */
  const register = useCallback(async () => {
    setIsRegistering(true)
    setError(null)

    try {
      const result = await registerWithWebAuthn()

      console.log('[useLitWebAuthn] Registration successful:', {
        address: result.pkpInfo.ethAddress,
      })

      return {
        pkpInfo: result.pkpInfo,
        authData: result.authData,
      }
    } catch (err) {
      console.error('[useLitWebAuthn] Registration failed:', err)
      const error = err instanceof Error ? err : new Error('Registration failed')
      setError(error)
      return null
    } finally {
      setIsRegistering(false)
    }
  }, [])

  /**
   * Authenticate existing user with WebAuthn
   * Signs in with passkey (1 signature)
   */
  const authenticate = useCallback(async () => {
    setIsAuthenticating(true)
    setError(null)

    try {
      const result = await authenticateWithWebAuthn()

      console.log('[useLitWebAuthn] Authentication successful:', {
        address: result.pkpInfo.ethAddress,
      })

      return result
    } catch (err) {
      console.error('[useLitWebAuthn] Authentication failed:', err)
      const error = err instanceof Error ? err : new Error('Authentication failed')
      setError(error)
      return null
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  /**
   * Logout user
   * Clears session and auth context
   */
  const logout = useCallback(() => {
    console.log('[useLitWebAuthn] Logging out...')
    clearSession()
    clearAuthContext()
    setError(null)
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isRegistering,
    isAuthenticating,
    error,
    register,
    authenticate,
    logout,
    clearError,
  }
}

/**
 * Check if user has existing session
 */
export function useAuthStatus() {
  const [status] = useState(() => getAuthStatus())
  return status
}
