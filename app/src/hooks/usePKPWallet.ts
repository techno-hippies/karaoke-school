/**
 * PKP Wallet Hook
 * React hook for PKP wallet management
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { Address, WalletClient } from 'viem'
import {
  createPKPWalletClient,
  createPKPAuthContext,
  getCachedAuthContext,
  getAuthStatus,
} from '@/lib/lit-webauthn'
import type { PKPInfo, AuthData, PKPAuthContext } from '@/lib/lit-webauthn'

export interface UsePKPWalletResult {
  // State
  address: Address | null
  walletClient: WalletClient | null
  authContext: PKPAuthContext | null
  isConnected: boolean
  isInitializing: boolean
  error: Error | null

  // PKP Info
  pkpInfo: PKPInfo | null
  authData: AuthData | null

  // Methods
  initialize: (pkpInfo: PKPInfo, authData: AuthData) => Promise<void>
  reset: () => void
}

/**
 * Hook for PKP wallet management
 * Creates viem WalletClient backed by PKP for signing
 */
export function usePKPWallet(): UsePKPWalletResult {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)
  const [authContext, setAuthContext] = useState<PKPAuthContext | null>(null)
  const [pkpInfo, setPkpInfo] = useState<PKPInfo | null>(null)
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Derived state
  const address = walletClient?.account?.address || null
  const isConnected = !!walletClient && !!authContext

  /**
   * Initialize PKP wallet with auth data
   * Creates auth context and wallet client
   */
  const initialize = useCallback(async (info: PKPInfo, data: AuthData) => {
    setIsInitializing(true)
    setError(null)

    try {
      console.log('[usePKPWallet] Initializing PKP wallet:', info.ethAddress)

      // Check for cached auth context first
      let context = getCachedAuthContext(info.publicKey)

      // Create new auth context if not cached
      if (!context) {
        console.log('[usePKPWallet] Creating PKP auth context...')
        context = await createPKPAuthContext(info, data)
      }

      // Create wallet client
      console.log('[usePKPWallet] Creating wallet client...')
      const client = await createPKPWalletClient(info, context)

      // Set state
      setAuthContext(context)
      setWalletClient(client)
      setPkpInfo(info)
      setAuthData(data)

      console.log('[usePKPWallet] PKP wallet initialized:', {
        address: info.ethAddress,
      })
    } catch (err) {
      console.error('[usePKPWallet] Initialization failed:', err)
      const error = err instanceof Error ? err : new Error('Failed to initialize PKP wallet')
      setError(error)
      throw error
    } finally {
      setIsInitializing(false)
    }
  }, [])

  /**
   * Reset wallet state
   */
  const reset = useCallback(() => {
    console.log('[usePKPWallet] Resetting wallet...')
    setWalletClient(null)
    setAuthContext(null)
    setPkpInfo(null)
    setAuthData(null)
    setError(null)
  }, [])

  /**
   * Auto-initialize from stored session on mount (only once)
   * Uses both ref (for normal case) and isInitializing (for strict mode double-invoke)
   */
  const hasAutoInitializedRef = useRef(false)

  useEffect(() => {
    const autoInitialize = async () => {
      // Check if already initialized, currently initializing, or auto-init already attempted
      // isInitializing check prevents race condition in React Strict Mode
      if (walletClient || isInitializing || hasAutoInitializedRef.current) return

      // Mark as attempted (prevents multiple runs)
      hasAutoInitializedRef.current = true

      // Check for stored session
      const status = getAuthStatus()

      if (status.isAuthenticated && status.pkpInfo && status.authData) {
        console.log('[usePKPWallet] Auto-initializing from stored session...')
        try {
          await initialize(status.pkpInfo, status.authData)
        } catch (error) {
          console.error('[usePKPWallet] Auto-initialization failed:', error)

          // Check if this is a stale session error (blockhash validation)
          if (error instanceof Error && error.message.includes('Invalid blockhash')) {
            console.log('[usePKPWallet] Clearing stale session data due to blockhash error')
            const { clearSession } = await import('@/lib/lit-webauthn/storage')
            clearSession()
          }

          // Don't throw - user can manually sign in
        }
      }
    }

    autoInitialize()
  }, [walletClient, isInitializing, initialize])

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    address,
    walletClient,
    authContext,
    isConnected,
    isInitializing,
    error,
    pkpInfo,
    authData,
    initialize,
    reset,
  }), [address, walletClient, authContext, isConnected, isInitializing, error, pkpInfo, authData, initialize, reset])
}

/**
 * Check if PKP wallet is ready for transactions
 */
export function usePKPWalletReady() {
  const { isConnected, walletClient } = usePKPWallet()
  return isConnected && !!walletClient
}
