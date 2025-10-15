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
 *
 * Refactored Architecture:
 * - Credits managed by CreditsContext (separate concern)
 * - Capabilities computed by useAuthCapabilities hook
 * - Auth flows extracted to auth-services
 */

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import { usePKPWallet, type UsePKPWalletResult } from '@/hooks/usePKPWallet'
import { useLensSession, useLensAccount } from '@/lib/lens/hooks'
import { useAuthCapabilities } from '@/hooks/useAuthCapabilities'
import { CreditsProvider, useCredits } from '@/contexts/CreditsContext'
import {
  getExistingAccounts,
  createLensAccount,
} from '@/lib/lens/auth'
import {
  registerWithPasskeyFlow,
  signInWithPasskeyFlow,
  loginLensStandalone,
} from '@/lib/auth/auth-services'
import type { PKPInfo, PKPAuthContext } from '@/lib/lit-webauthn'
import type { AuthCapabilities } from '@/features/post-flow/types'

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

  // Credits & Capabilities
  credits: number
  capabilities: AuthCapabilities

  // Overall state
  isAuthenticating: boolean
  authError: Error | null
  authStep: 'idle' | 'webauthn' | 'session' | 'social' | 'complete'
  authMode: 'register' | 'login' | null
  authStatus: string
  lensSetupStatus: 'pending' | 'complete' | 'failed'
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
  ensureLensAccount: () => Promise<boolean>

  // Reset
  reset: () => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Auth Provider Core Component
 * Contains all auth logic, wrapped by CreditsProvider
 */
function AuthProviderCore({ children, pkpWallet }: { children: ReactNode; pkpWallet: UsePKPWalletResult }) {
  // Layer 1: Lit WebAuthn + PKP (passed as prop to avoid duplicate hook call)

  // Layer 2: Lens Protocol
  const { sessionClient, setSessionClient } = useLensSession()
  const { account, setAccount } = useLensAccount()

  // Overall state
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [authStep, setAuthStep] = useState<AuthState['authStep']>('idle')
  const [authMode, setAuthMode] = useState<AuthState['authMode']>(null)
  const [authStatus, setAuthStatus] = useState<string>('')
  const [lensSetupStatus, setLensSetupStatus] = useState<'pending' | 'complete' | 'failed'>('pending')

  /**
   * Auto-restore Lens session if PKP is ready
   */
  useEffect(() => {
    const restoreSession = async () => {
      // If PKP is ready and we have a Lens session, auto-restore account
      if (pkpWallet.isConnected && sessionClient && pkpWallet.address) {
        try {
          const existingAccounts = await getExistingAccounts(pkpWallet.address)

          if (existingAccounts.length > 0 && !account) {
            setAccount(existingAccounts[0])
            setAuthStep('complete')
            setLensSetupStatus('complete')
          } else if (existingAccounts.length === 0) {
            setLensSetupStatus('failed')
            // Don't block - user can still use PKP features
          }
        } catch (error) {
          console.error('[Auth] Session restore error (non-critical):', error)
          setLensSetupStatus('failed')
          // Don't block - user can still use PKP features
        }
      }
    }

    restoreSession()
  }, [pkpWallet.isConnected, pkpWallet.address, sessionClient, account])

  /**
   * Register with passkey (create new account)
   * Uses extracted auth service for cleaner flow
   */
  const registerWithPasskey = useCallback(async () => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthMode('register')
    setAuthStep('webauthn')

    try {
      // Use extracted registration service
      const result = await registerWithPasskeyFlow((status) => {
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

      // Initialize PKP wallet (for context state)
      pkpWallet.initialize(result.pkpInfo, result.authData)

      // Set Lens state from result
      if (result.lensSession) {
        setSessionClient(result.lensSession)
      }
      if (result.lensAccount) {
        setAccount(result.lensAccount)
      }
      setLensSetupStatus(result.lensSetupStatus)

      setAuthStep('complete')
      setAuthMode(null)
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
  }, [pkpWallet, setSessionClient, setAccount])

  /**
   * Sign in with passkey (existing account)
   * Uses extracted auth service for cleaner flow
   */
  const signInWithPasskey = useCallback(async () => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthMode('login')
    setAuthStep('webauthn')

    try {
      // Use extracted login service
      const result = await signInWithPasskeyFlow((status) => {
        setAuthStatus(status)
        // Update step based on status message
        if (status.includes('authenticate') || status.includes('device') || status.includes('sign in')) {
          setAuthStep('webauthn')
        } else if (status.includes('wallet') || status.includes('Restoring')) {
          setAuthStep('session')
        } else if (status.includes('social') || status.includes('Lens')) {
          setAuthStep('social')
        }
      })

      // Initialize PKP wallet (for context state)
      pkpWallet.initialize(result.pkpInfo, result.authData)

      // Set Lens state from result
      if (result.lensSession) {
        setSessionClient(result.lensSession)
      }
      if (result.lensAccount) {
        setAccount(result.lensAccount)
      }
      setLensSetupStatus(result.lensSetupStatus)

      setAuthStep('complete')
      setAuthMode(null)
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
  }, [pkpWallet, setSessionClient, setAccount])

  /**
   * Login to Lens Protocol
   * Uses PKP as signer (standalone - for just-in-time Lens connection)
   */
  const loginLens = useCallback(async (walletClient?: WalletClient, address?: Address) => {
    const client = walletClient || pkpWallet.walletClient
    const addr = address || pkpWallet.address

    if (!client || !addr) {
      throw new Error('PKP wallet not ready')
    }

    try {
      setIsAuthenticating(true)
      setAuthStep('social')
      setAuthError(null)

      // Use extracted Lens login service
      const result = await loginLensStandalone(client, addr, (status) => {
        setAuthStatus(status)
      })

      setSessionClient(result.session)
      if (result.account) {
        setAccount(result.account)
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
  }, [pkpWallet.walletClient, pkpWallet.address, setSessionClient, setAccount])

  /**
   * Create Lens account with username
   * Uses PKP to sign transaction
   */
  const createLensAccountWithUsername = useCallback(async (username: string, metadataUri: string) => {
    if (!sessionClient || !pkpWallet.walletClient) {
      throw new Error('Not ready to create account')
    }

    try {
      setIsAuthenticating(true)
      setAuthError(null)

      // Create account (gas sponsored by Lens app)
      const newAccount = await createLensAccount(
        sessionClient,
        pkpWallet.walletClient,
        username,
        metadataUri
      )

      setAccount(newAccount)
    } catch (error) {
      console.error('[Auth] Create Lens account error:', error)
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }, [sessionClient, pkpWallet.walletClient, setAccount])

  /**
   * Refresh Lens account
   * Check for newly created accounts
   */
  const refreshLensAccount = useCallback(async () => {
    if (!pkpWallet.address) {
      throw new Error('PKP wallet not connected')
    }

    try {
      setIsAuthenticating(true)
      setAuthError(null)

      const existingAccounts = await getExistingAccounts(pkpWallet.address)

      if (existingAccounts.length > 0) {
        setAccount(existingAccounts[0])
        setLensSetupStatus('complete')
      }
    } catch (error) {
      console.error('[Auth] Refresh account error:', error)
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }, [pkpWallet.address, setAccount])

  /**
   * Ensure Lens account is set up (just-in-time)
   * Can be called when user attempts social features
   * Returns true if account ready, false if setup needed
   */
  const ensureLensAccount = useCallback(async (): Promise<boolean> => {
    if (!pkpWallet.isConnected || !pkpWallet.address) {
      throw new Error('PKP wallet not connected')
    }

    // Already have account
    if (account) {
      return true
    }

    try {
      // Check if session exists
      if (!sessionClient) {
        await loginLens()
      }

      // Check if account exists
      const existingAccounts = await getExistingAccounts(pkpWallet.address)

      if (existingAccounts.length > 0) {
        setAccount(existingAccounts[0])
        setLensSetupStatus('complete')
        return true
      }

      // No account - user needs to create one
      setLensSetupStatus('failed')
      return false
    } catch (error) {
      console.error('[Auth] Ensure Lens account error:', error)
      setLensSetupStatus('failed')
      return false
    }
  }, [pkpWallet.isConnected, pkpWallet.address, account, sessionClient, loginLens, setAccount])

  /**
   * Logout and reset all auth state
   */
  const logout = useCallback(() => {
    pkpWallet.reset()
    setSessionClient(null)
    setAccount(null)
    setAuthStep('idle')
    setAuthMode(null)
    setAuthError(null)
    setAuthStatus('')
  }, [pkpWallet, setSessionClient, setAccount])

  /**
   * Reset (alias for logout)
   */
  const reset = logout

  // Get credits from CreditsContext (injected by wrapper)
  const { credits } = useCredits()

  // Compute capabilities using extracted hook
  const capabilities = useAuthCapabilities({
    isPKPReady: pkpWallet.isConnected,
    pkpAuthContext: pkpWallet.authContext,
    hasLensSession: !!sessionClient,
    hasLensAccount: !!account,
    credits,
  })

  const value: AuthContextType = useMemo(() => ({
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

    // Credits & Capabilities
    credits,
    capabilities,

    // Overall State
    isAuthenticating: isAuthenticating || pkpWallet.isInitializing,
    authError: authError || pkpWallet.error,
    authStep,
    authMode,
    authStatus,
    lensSetupStatus,

    // Actions
    registerWithPasskey,
    signInWithPasskey,
    logout,
    loginLens,
    createLensAccountWithUsername,
    refreshLensAccount,
    ensureLensAccount,
    reset,
  }), [
    pkpWallet.pkpInfo,
    pkpWallet.address,
    pkpWallet.walletClient,
    pkpWallet.authContext,
    pkpWallet.isConnected,
    pkpWallet.isInitializing,
    pkpWallet.error,
    sessionClient,
    account,
    credits,
    capabilities,
    isAuthenticating,
    authError,
    authStep,
    authMode,
    authStatus,
    lensSetupStatus,
    registerWithPasskey,
    signInWithPasskey,
    logout,
    loginLens,
    createLensAccountWithUsername,
    refreshLensAccount,
    ensureLensAccount,
    reset,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Main Auth Provider with Credits integration
 * Wraps AuthProviderCore with CreditsProvider
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const pkpWallet = usePKPWallet()

  return (
    <CreditsProvider pkpAddress={pkpWallet.address} isConnected={pkpWallet.isConnected}>
      <AuthProviderCore pkpWallet={pkpWallet}>{children}</AuthProviderCore>
    </CreditsProvider>
  )
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
