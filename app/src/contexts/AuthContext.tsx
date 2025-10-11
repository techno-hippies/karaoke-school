/**
 * Unified Authentication Context (Lit WebAuthn + Lens)
 * Orchestrates Lit WebAuthn (wallet) and Lens (social) authentication
 *
 * Auth Flow:
 * 1. User creates account (2 signatures: WebAuthn + PKP mint) OR signs in (1 signature)
 * 2. PKP wallet is initialized with auth context
 * 3. User logs into Lens using PKP as signer
 * 4. User creates Lens account if needed (PKP signs transaction)
 *
 * Benefits:
 * - Zero signatures for Lit Actions (PKP auth context persists)
 * - Native biometric auth (Face ID, Touch ID, Windows Hello)
 * - No wallet extensions needed
 * - Session persistence
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import { usePKPWallet } from '@/hooks/usePKPWallet'
import { useLensSession, useLensAccount } from '@/lib/lens/hooks'
import {
  loginAsOnboardingUser,
  getExistingAccounts,
  createLensAccount,
} from '@/lib/lens/auth'
import { authenticateUser, registerUser, loginUser } from '@/lib/lit-webauthn/auth-flow'
import { createPKPWalletClient, createPKPAuthContext } from '@/lib/lit-webauthn'
import type { PKPInfo, PKPAuthContext } from '@/lib/lit-webauthn'

const IS_DEV = import.meta.env.DEV

/**
 * Authentication State
 */
interface AuthState {
  // Lit WebAuthn (Layer 1: Identity + Wallet)
  pkpInfo: PKPInfo | null
  pkpAddress: Address | null
  pkpWalletClient: WalletClient | null
  pkpAuthContext: PKPAuthContext | null
  isPKPReady: boolean

  // Lens (Layer 2: Social Identity)
  lensSession: SessionClient | null
  lensAccount: Account | null
  hasLensAccount: boolean

  // Overall state
  isAuthenticating: boolean
  authError: Error | null
  authStep: 'idle' | 'webauthn' | 'session' | 'social' | 'complete'
  authMode: 'register' | 'login' | null
  authStatus: string
}

/**
 * Authentication Actions
 */
interface AuthActions {
  // WebAuthn (replaces wallet connection)
  registerWithPasskey: () => Promise<void>
  signInWithPasskey: () => Promise<void>
  logout: () => void

  // Lens
  loginLens: () => Promise<void>
  createLensAccountWithUsername: (username: string, metadataUri: string) => Promise<void>
  refreshLensAccount: () => Promise<void>

  // Reset
  reset: () => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Layer 1: Lit WebAuthn + PKP
  const pkpWallet = usePKPWallet()

  // Layer 2: Lens Protocol
  const { sessionClient, setSessionClient } = useLensSession()
  const { account, setAccount } = useLensAccount()

  // Overall state
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [authStep, setAuthStep] = useState<AuthState['authStep']>('idle')
  const [authMode, setAuthMode] = useState<AuthState['authMode']>(null)
  const [authStatus, setAuthStatus] = useState<string>('')

  /**
   * Auto-restore Lens session if PKP is ready
   */
  useEffect(() => {
    const restoreSession = async () => {
      if (IS_DEV) {
        console.log('[Auth] Checking for existing session:', {
          pkpReady: pkpWallet.isConnected,
          pkpAddress: pkpWallet.address,
          lensSession: !!sessionClient,
        })
      }

      // If PKP is ready and we have a Lens session, auto-restore account
      if (pkpWallet.isConnected && sessionClient && pkpWallet.address) {
        try {
          const existingAccounts = await getExistingAccounts(pkpWallet.address)

          if (existingAccounts.length > 0 && !account) {
            if (IS_DEV) console.log('[Auth] Restored Lens account')
            setAccount(existingAccounts[0])
            setAuthStep('complete')
          }
        } catch (error) {
          console.error('[Auth] Session restore error:', error)
        }
      }
    }

    restoreSession()
  }, [pkpWallet.isConnected, pkpWallet.address, sessionClient, account])

  /**
   * Register with passkey (create new account)
   */
  const registerWithPasskey = async () => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthMode('register')
    setAuthStep('webauthn')
    setAuthStatus('Starting registration...')

    try {
      if (IS_DEV) console.log('[Auth] Starting registration flow...')

      // Use register flow with status callback
      const result = await registerUser((status) => {
        setAuthStatus(status)
        // Update step based on status message
        if (status.includes('passkey')) {
          setAuthStep('webauthn')
        } else if (status.includes('session')) {
          setAuthStep('session')
        }
      })

      if (IS_DEV) {
        console.log('[Auth] Registration complete:', {
          address: result.pkpInfo.ethAddress,
        })
      }

      // Create PKP wallet client for immediate use
      const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
      const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

      // Initialize PKP wallet (for context state)
      pkpWallet.initialize(result.pkpInfo, result.authData)

      setAuthStatus('Account created! Connecting social...')

      // Auto-connect social account (second signature)
      await loginLens(walletClient, result.pkpInfo.ethAddress)

      setAuthStep('complete')
      setAuthStatus('All set!')
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
  }

  /**
   * Sign in with passkey (existing account)
   */
  const signInWithPasskey = async () => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthMode('login')
    setAuthStep('webauthn')
    setAuthStatus('Starting sign in...')

    try {
      if (IS_DEV) console.log('[Auth] Starting login flow...')

      // Use login flow with status callback
      const result = await loginUser((status) => {
        setAuthStatus(status)
        // Update step based on status message
        if (status.includes('authenticate') || status.includes('device')) {
          setAuthStep('webauthn')
        } else if (status.includes('account') || status.includes('Fetching')) {
          setAuthStep('webauthn')
        } else if (status.includes('session')) {
          setAuthStep('session')
        }
      })

      if (IS_DEV) {
        console.log('[Auth] Login complete:', {
          address: result.pkpInfo.ethAddress,
        })
      }

      // Create PKP wallet client for immediate use
      const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
      const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

      // Initialize PKP wallet (for context state)
      pkpWallet.initialize(result.pkpInfo, result.authData)

      setAuthStatus('Welcome back! Connecting social...')

      // Auto-connect social account (second signature)
      await loginLens(walletClient, result.pkpInfo.ethAddress)

      setAuthStep('complete')
      setAuthStatus('All set!')
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
  }

  /**
   * Login to Lens Protocol
   * Uses PKP as signer
   */
  const loginLens = async (walletClient?: WalletClient, address?: Address) => {
    const client = walletClient || pkpWallet.walletClient
    const addr = address || pkpWallet.address

    if (!client || !addr) {
      throw new Error('PKP wallet not ready')
    }

    try {
      setIsAuthenticating(true)
      setAuthStep('social')
      setAuthError(null)
      setAuthStatus('Connecting to Lens Protocol...')

      if (IS_DEV) console.log('[Auth] Logging into Lens...')

      // Login as onboarding user (Account Manager mode)
      const session = await loginAsOnboardingUser(client, addr)

      setSessionClient(session)

      if (IS_DEV) console.log('[Auth] Lens session created')

      setAuthStatus('Finalizing...')

      // Check for existing accounts
      const existingAccounts = await getExistingAccounts(addr)

      if (existingAccounts.length > 0) {
        setAccount(existingAccounts[0])
        if (IS_DEV) console.log('[Auth] Lens account found:', existingAccounts[0].account?.username)
      }

      // Complete regardless of whether they have an account
      // Session is enough for now, account creation can happen later
      setAuthStep('complete')
      setAuthStatus('All set!')
      setAuthMode(null)
    } catch (error) {
      console.error('[Auth] Lens login error:', error)
      setAuthError(error as Error)
      setAuthStatus('')
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Create Lens account with username
   * Uses PKP to sign transaction
   */
  const createLensAccountWithUsername = async (username: string, metadataUri: string) => {
    if (!sessionClient || !pkpWallet.walletClient) {
      throw new Error('Not ready to create account')
    }

    try {
      setIsAuthenticating(true)
      setAuthError(null)

      if (IS_DEV) console.log('[Auth] Creating Lens account:', username)

      // Create account (gas sponsored by Lens app)
      const newAccount = await createLensAccount(
        sessionClient,
        pkpWallet.walletClient,
        username,
        metadataUri
      )

      setAccount(newAccount)

      if (IS_DEV) console.log('[Auth] Lens account created:', username)
    } catch (error) {
      console.error('[Auth] Create Lens account error:', error)
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Refresh Lens account
   * Check for newly created accounts
   */
  const refreshLensAccount = async () => {
    if (!pkpWallet.address) {
      throw new Error('PKP wallet not connected')
    }

    try {
      setIsAuthenticating(true)
      setAuthError(null)

      const existingAccounts = await getExistingAccounts(pkpWallet.address)

      if (existingAccounts.length > 0) {
        setAccount(existingAccounts[0])
        if (IS_DEV) console.log('[Auth] Account refreshed')
      }
    } catch (error) {
      console.error('[Auth] Refresh account error:', error)
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Logout and reset all auth state
   */
  const logout = () => {
    if (IS_DEV) console.log('[Auth] Logging out...')

    pkpWallet.reset()
    setSessionClient(null)
    setAccount(null)
    setAuthStep('idle')
    setAuthMode(null)
    setAuthError(null)
    setAuthStatus('')
  }

  /**
   * Reset (alias for logout)
   */
  const reset = logout

  const value: AuthContextType = {
    // PKP State
    pkpInfo: pkpWallet.pkpInfo,
    pkpAddress: pkpWallet.address,
    pkpWalletClient: pkpWallet.walletClient,
    pkpAuthContext: pkpWallet.authContext,
    isPKPReady: pkpWallet.isConnected,

    // Lens State
    lensSession: sessionClient,
    lensAccount: account,
    hasLensAccount: !!account,

    // Overall State
    isAuthenticating: isAuthenticating || pkpWallet.isInitializing,
    authError: authError || pkpWallet.error,
    authStep,
    authMode,
    authStatus,

    // Actions
    registerWithPasskey,
    signInWithPasskey,
    logout,
    loginLens,
    createLensAccountWithUsername,
    refreshLensAccount,
    reset,
  }

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
