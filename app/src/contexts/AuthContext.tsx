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
import type { AuthCapabilities } from '@/features/post-flow/types'

const IS_DEV = import.meta.env.DEV

/**
 * Resolve what user can do based on current auth state
 * Returns granular capabilities instead of single isReady flag
 */
function resolveCapabilities(
  isPKPReady: boolean,
  pkpAuthContext: PKPAuthContext | null,
  hasLensSession: boolean,
  hasLensAccount: boolean,
  credits: number
): AuthCapabilities {
  // Tier 1: PKP features
  const hasPKP = isPKPReady && !!pkpAuthContext
  const canBrowse = hasPKP
  const canSearch = hasPKP
  const canMatchSegment = hasPKP

  // Tier 2: Paid features
  const hasCredits = credits > 0
  const canGenerate = hasPKP && hasCredits
  const canUnlock = hasPKP && hasCredits
  const canRecord = hasPKP && hasCredits // Must own segment

  // Tier 3: Social features
  const hasSocial = hasPKP && hasLensAccount
  const canPost = hasSocial
  const canLike = hasSocial
  const canFollow = hasSocial
  const canComment = hasSocial

  // Compute blocking issues
  const blockingIssues: string[] = []
  if (!hasPKP) blockingIssues.push('PKP_REQUIRED')
  if (!hasLensSession && !hasLensAccount) blockingIssues.push('LENS_SESSION_REQUIRED')
  if (hasLensSession && !hasLensAccount) blockingIssues.push('LENS_ACCOUNT_REQUIRED')
  if (credits === 0) blockingIssues.push('CREDITS_REQUIRED')

  return {
    canBrowse,
    canSearch,
    canMatchSegment,
    canGenerate,
    canUnlock,
    canRecord,
    canPost,
    canLike,
    canFollow,
    canComment,
    blockingIssues,
    capabilities: {
      hasPKP,
      hasLensSession,
      hasLensAccount,
      hasCredits,
      creditBalance: credits,
    },
  }
}

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
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Layer 1: Lit WebAuthn + PKP
  const pkpWallet = usePKPWallet()

  // Layer 2: Lens Protocol
  const { sessionClient, setSessionClient } = useLensSession()
  const { account, setAccount } = useLensAccount()

  // Layer 3: Credits
  const [credits, setCredits] = useState<number>(0)

  // Overall state
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [authStep, setAuthStep] = useState<AuthState['authStep']>('idle')
  const [authMode, setAuthMode] = useState<AuthState['authMode']>(null)
  const [authStatus, setAuthStatus] = useState<string>('')
  const [lensSetupStatus, setLensSetupStatus] = useState<'pending' | 'complete' | 'failed'>('pending')

  /**
   * Load credit balance from smart contract
   */
  const loadCredits = async () => {
    if (!pkpWallet.isConnected || !pkpWallet.address) {
      setCredits(0)
      return
    }

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const data = await publicClient.readContract({
        address: contractAddress,
        abi: [{
          name: 'getCredits',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'user', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'getCredits',
        args: [pkpWallet.address],
      })

      setCredits(Number(data))
    } catch (err) {
      console.error('[Auth] Failed to load credits:', err)
      setCredits(0)
    }
  }

  /**
   * Auto-load credits when PKP wallet connects
   */
  useEffect(() => {
    if (pkpWallet.isConnected && pkpWallet.address) {
      loadCredits()
    }
  }, [pkpWallet.isConnected, pkpWallet.address])

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
   */
  const registerWithPasskey = async () => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthMode('register')
    setAuthStep('webauthn')
    setAuthStatus('Starting registration...')

    try {
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

      // Create PKP wallet client for immediate use
      const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
      const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

      // Initialize PKP wallet (for context state)
      pkpWallet.initialize(result.pkpInfo, result.authData)

      setAuthStatus('Account created! Connecting social...')

      // Auto-connect social account (second signature) - NON-CRITICAL
      try {
        await loginLens(walletClient, result.pkpInfo.ethAddress)
        setLensSetupStatus('complete')
      } catch (lensError) {
        console.warn('[Auth] Lens connection failed (non-critical):', lensError)
        setLensSetupStatus('failed')
        // Don't throw - PKP still works for search/browse!
      }

      setAuthStep('complete')
      setAuthStatus('All set!')
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

      // Create PKP wallet client for immediate use
      const pkpAuthContext = await createPKPAuthContext(result.pkpInfo, result.authData)
      const walletClient = await createPKPWalletClient(result.pkpInfo, pkpAuthContext)

      // Initialize PKP wallet (for context state)
      pkpWallet.initialize(result.pkpInfo, result.authData)

      setAuthStatus('Welcome back! Connecting social...')

      // Auto-connect social account (second signature) - NON-CRITICAL
      try {
        await loginLens(walletClient, result.pkpInfo.ethAddress)
        setLensSetupStatus('complete')
      } catch (lensError) {
        console.warn('[Auth] Lens connection failed (non-critical):', lensError)
        setLensSetupStatus('failed')
        // Don't throw - PKP still works for search/browse!
      }

      setAuthStep('complete')
      setAuthStatus('All set!')
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

      // Login as onboarding user (Account Manager mode)
      const session = await loginAsOnboardingUser(client, addr)

      setSessionClient(session)

      setAuthStatus('Finalizing...')

      // Check for existing accounts
      const existingAccounts = await getExistingAccounts(addr)

      if (existingAccounts.length > 0) {
        setAccount(existingAccounts[0])
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
        setLensSetupStatus('complete')
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
   * Ensure Lens account is set up (just-in-time)
   * Can be called when user attempts social features
   * Returns true if account ready, false if setup needed
   */
  const ensureLensAccount = async (): Promise<boolean> => {
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
  }

  /**
   * Logout and reset all auth state
   */
  const logout = () => {
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

  // Compute capabilities based on current state
  const capabilities = resolveCapabilities(
    pkpWallet.isConnected,
    pkpWallet.authContext,
    !!sessionClient,
    !!account,
    credits
  )

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
