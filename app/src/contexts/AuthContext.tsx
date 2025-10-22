/**
 * Authentication Context
 * Manages PKP (Lit Protocol) + Lens (Social) authentication state
 *
 * Benefits:
 * - Zero signatures for Lit Actions (PKP auth context persists)
 * - Native biometric auth (Face ID, Touch ID, Windows Hello)
 * - No wallet extensions needed
 * - Session persistence across page reloads
 */

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import {
  createPKPWalletClient,
  createPKPAuthContext,
  getCachedAuthContext,
  getAuthStatus,
  clearSession,
} from '@/lib/lit'
import type { PKPInfo, AuthData, PKPAuthContext } from '@/lib/lit'
import { registerWithPasskeyFlow, signInWithPasskeyFlow } from '@/lib/auth/flows'
import { getExistingAccounts, resumeLensSession } from '@/lib/lens/auth'

/**
 * Authentication State
 */
interface AuthState {
  // PKP (Layer 1: Identity + Wallet)
  pkpInfo: PKPInfo | null
  pkpAddress: Address | null
  pkpWalletClient: WalletClient | null
  pkpAuthContext: PKPAuthContext | null
  authData: AuthData | null
  isPKPReady: boolean

  // Lens (Layer 2: Social Identity)
  lensSession: SessionClient | null
  lensAccount: Account | null
  hasLensAccount: boolean

  // Flow state
  isAuthenticating: boolean
  authError: Error | null
  authStep: 'idle' | 'username' | 'webauthn' | 'session' | 'social' | 'complete'
  authMode: 'register' | 'login' | null
  authStatus: string
  lensSetupStatus: 'pending' | 'complete' | 'failed'
}

/**
 * Authentication Actions
 */
interface AuthActions {
  // Main auth flows
  register: (username?: string) => Promise<void>
  signIn: () => Promise<void>
  logout: () => void

  // Flow control
  showUsernameInput: () => void
  resetAuthFlow: () => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Auth Provider
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // PKP Wallet State (inline instead of separate hook)
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)
  const [authContext, setAuthContext] = useState<PKPAuthContext | null>(null)
  const [pkpInfo, setPkpInfo] = useState<PKPInfo | null>(null)
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  // Lens State
  const [sessionClient, setSessionClient] = useState<SessionClient | null>(null)
  const [account, setAccount] = useState<Account | null>(null)

  // Overall state
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [authStep, setAuthStep] = useState<AuthState['authStep']>('idle')
  const [authMode, setAuthMode] = useState<AuthState['authMode']>(null)
  const [authStatus, setAuthStatus] = useState<string>('')
  const [lensSetupStatus, setLensSetupStatus] = useState<'pending' | 'complete' | 'failed'>('pending')

  // Derived state
  const address = walletClient?.account?.address || null
  const isConnected = !!walletClient && !!authContext

  /**
   * Initialize PKP wallet
   */
  const initializePKP = useCallback(async (info: PKPInfo, data: AuthData) => {
    setIsInitializing(true)

    try {
      console.log('[Auth] Initializing PKP wallet:', info.ethAddress)

      // Check for cached auth context first
      let context = getCachedAuthContext(info.publicKey)

      // Create new auth context if not cached
      if (!context) {
        console.log('[Auth] Creating PKP auth context...')
        context = await createPKPAuthContext(info, data)
      }

      // Create wallet client
      console.log('[Auth] Creating wallet client...')
      const client = await createPKPWalletClient(info, context)

      // Set state
      setAuthContext(context)
      setWalletClient(client)
      setPkpInfo(info)
      setAuthData(data)

      console.log('[Auth] ✓ PKP wallet initialized')
    } catch (err) {
      console.error('[Auth] Initialization failed:', err)
      throw err
    } finally {
      setIsInitializing(false)
    }
  }, [])

  /**
   * Auto-initialize from stored session on mount
   */
  const hasAutoInitializedRef = useRef(false)

  useEffect(() => {
    const autoInitialize = async () => {
      if (walletClient || isInitializing || hasAutoInitializedRef.current) return

      hasAutoInitializedRef.current = true

      // Check for stored session
      const status = getAuthStatus()

      if (status.isAuthenticated && status.pkpInfo && status.authData) {
        console.log('[Auth] Auto-initializing from stored session...')
        try {
          await initializePKP(status.pkpInfo, status.authData)

          // Try to restore Lens session
          const lensSession = await resumeLensSession()
          if (lensSession) {
            setSessionClient(lensSession)

            // Try to fetch account
            const accounts = await getExistingAccounts(status.pkpInfo.ethAddress)
            if (accounts.length > 0) {
              setAccount(accounts[0].account)
              setLensSetupStatus('complete')
            }
          }
        } catch (error) {
          console.error('[Auth] Auto-initialization failed:', error)

          // Check if this is a stale session error or network error
          if (error instanceof Error) {
            if (error.message.includes('Invalid blockhash')) {
              console.log('[Auth] Clearing stale session data')
              clearSession()
            } else if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
              console.log('[Auth] Network error during auto-init, keeping PKP session')
              // Don't clear session on network errors - just skip Lens initialization
            }
          }
        }
      }
    }

    autoInitialize()
  }, [walletClient, isInitializing, initializePKP])

  /**
   * Show username input screen
   */
  const showUsernameInput = useCallback(() => {
    setAuthMode('register')
    setAuthStep('username')
    setAuthError(null)
    setAuthStatus('')
    setIsAuthenticating(false)
  }, [])

  /**
   * Reset auth flow
   */
  const resetAuthFlow = useCallback(() => {
    setAuthMode(null)
    setAuthStep('idle')
    setAuthError(null)
    setAuthStatus('')
    setIsAuthenticating(false)
  }, [])

  /**
   * Register with passkey (create new account)
   */
  const register = useCallback(async (username?: string) => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthMode('register')
    setAuthStep('webauthn')

    try {
      const result = await registerWithPasskeyFlow(username, (status) => {
        setAuthStatus(status)
        // Update step based on status message
        if (status.includes('passkey')) {
          setAuthStep('webauthn')
        } else if (status.includes('session') || status.includes('wallet')) {
          setAuthStep('session')
        } else if (status.includes('social') || status.includes('Lens')) {
          setAuthStep('social')
        }
      })

      // Set state from result
      setWalletClient(result.walletClient)
      setPkpInfo(result.pkpInfo)
      setAuthData(result.authData)
      setSessionClient(result.lensSession)
      setAccount(result.lensAccount)
      setLensSetupStatus(result.lensSetupStatus)

      // Complete
      setAuthStep('complete')
      setAuthMode(null)
      setAuthStatus('')
    } catch (error) {
      console.error('[Auth] Registration error:', error)
      setAuthError(error as Error)
      setAuthStep('idle')
      setAuthMode(null)
      setAuthStatus('')
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  /**
   * Sign in with passkey (existing account)
   */
  const signIn = useCallback(async () => {
    setIsAuthenticating(true)
    setAuthMode('login')
    setAuthStep('webauthn')
    setAuthError(null)

    try {
      const result = await signInWithPasskeyFlow((status) => {
        setAuthStatus(status)
        // Update step based on status message
        if (status.includes('authenticate') || status.includes('device')) {
          setAuthStep('webauthn')
        } else if (status.includes('wallet') || status.includes('Restoring')) {
          setAuthStep('session')
        } else if (status.includes('social') || status.includes('Lens')) {
          setAuthStep('social')
        }
      })

      // Set state from result
      setWalletClient(result.walletClient)
      setPkpInfo(result.pkpInfo)
      setAuthData(result.authData)
      setSessionClient(result.lensSession)
      setAccount(result.lensAccount)
      setLensSetupStatus(result.lensSetupStatus)

      // Complete
      setAuthStep('complete')
      setAuthMode(null)
      setAuthStatus('')
    } catch (error) {
      console.error('[Auth] Login error:', error)
      setAuthError(error as Error)
      setAuthStep('idle')
      setAuthMode(null)
      setAuthStatus('')
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  /**
   * Logout
   */
  const logout = useCallback(() => {
    clearSession()
    setWalletClient(null)
    setAuthContext(null)
    setPkpInfo(null)
    setAuthData(null)
    setSessionClient(null)
    setAccount(null)
    setAuthStep('idle')
    setAuthMode(null)
    setAuthError(null)
    setAuthStatus('')
    setLensSetupStatus('pending')
  }, [])

  const value: AuthContextType = useMemo(() => ({
    // PKP State
    pkpInfo,
    pkpAddress: address,
    pkpWalletClient: walletClient,
    pkpAuthContext: authContext,
    authData,
    isPKPReady: isConnected,

    // Lens State
    lensSession: sessionClient,
    lensAccount: account,
    hasLensAccount: !!account,

    // Flow State
    isAuthenticating: isAuthenticating || isInitializing,
    authError,
    authStep,
    authMode,
    authStatus,
    lensSetupStatus,

    // Actions
    register,
    signIn,
    logout,
    showUsernameInput,
    resetAuthFlow,
  }), [
    pkpInfo,
    address,
    walletClient,
    authContext,
    authData,
    isConnected,
    sessionClient,
    account,
    isAuthenticating,
    isInitializing,
    authError,
    authStep,
    authMode,
    authStatus,
    lensSetupStatus,
    register,
    signIn,
    logout,
    showUsernameInput,
    resetAuthFlow,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
