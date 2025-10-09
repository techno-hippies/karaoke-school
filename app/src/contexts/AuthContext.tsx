/**
 * Unified Authentication Context
 * Orchestrates Particle (wallet), Lens (social), and Lit (compute) authentication
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import { useParticleWallet } from '@/lib/particle/hooks'
import { useLensSession, useLensAccount } from '@/lib/lens/hooks'
import {
  loginAsOnboardingUser,
  getExistingAccounts,
  createLensAccount,
  switchToAccountOwner,
} from '@/lib/lens/auth'
import { initializeLitSessionWithWallet } from '@/lib/lit/client'

const IS_DEV = import.meta.env.DEV

/**
 * Authentication State
 */
interface AuthState {
  // Particle (Layer 1: Wallet)
  walletAddress: Address | null
  walletClient: WalletClient | null
  isWalletConnected: boolean
  
  // Lens (Layer 2: Social Identity)
  lensSession: SessionClient | null
  lensAccount: Account | null
  hasLensAccount: boolean

  // Overall state
  isAuthenticating: boolean
  authError: Error | null
  authStep: 'idle' | 'wallet' | 'lens' | 'complete'
}

/**
 * Authentication Actions
 */
interface AuthActions {
  // Wallet
  connectWallet: () => void
  disconnectWallet: () => void

  // Lens
  loginLens: () => Promise<void>
  createLensAccountWithUsername: (username: string, metadataUri: string) => Promise<void>
  refreshLensAccount: () => Promise<void>

  // Full flow
  authenticate: () => Promise<void>

  // Reset
  reset: () => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Layer 1: Particle Wallet
  const particleWallet = useParticleWallet()
  
  // Layer 2: Lens Protocol
  const { sessionClient, setSessionClient, isLoading: isLensLoading } = useLensSession()
  const { account, setAccount } = useLensAccount()

  // Overall state
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [authStep, setAuthStep] = useState<AuthState['authStep']>('idle')

  /**
   * Auto-restore session on mount
   * Lens SDK handles session persistence via localStorage
   */
  useEffect(() => {
    const restoreSession = async () => {
      if (IS_DEV) {
        console.log('[Auth] Restoring session:', {
          wallet: particleWallet.isConnected,
          lens: !!sessionClient,
          address: particleWallet.address,
        })
      }

      // If wallet is connected and we have a Lens session, auto-restore account
      if (particleWallet.isConnected && sessionClient && particleWallet.address) {
        try {
          // Check for existing accounts
          const existingAccounts = await getExistingAccounts(particleWallet.address)

          if (existingAccounts.length > 0 && !account) {
            if (IS_DEV) console.log('[Auth] Restored Lens account')
            setAccount(existingAccounts[0])
          }
        } catch (error) {
          console.error('[Auth] Session restore error:', error)
        }
      }
    }

    restoreSession()
  }, [particleWallet.isConnected, particleWallet.address, particleWallet.walletClient, sessionClient, account])

  /**
   * Step 1: Connect wallet (Particle) - Just open the modal
   */
  const connectWallet = () => {
    setAuthStep('wallet')
    setAuthError(null)
    // Just open the modal - don't wait for connection
    particleWallet.connect()
  }

  /**
   * Step 2: Login to Lens
   */
  const loginLens = async () => {
    if (!particleWallet.walletClient || !particleWallet.address) {
      throw new Error('Wallet not connected')
    }

    try {
      setAuthStep('lens')
      setAuthError(null)

      // Login as onboarding user (Account Manager mode)
      const session = await loginAsOnboardingUser(
        particleWallet.walletClient,
        particleWallet.address
      )

      console.log('[AuthContext] loginLens - session received:', session)
      setSessionClient(session)
      console.log('[AuthContext] loginLens - after setSessionClient')

      // Check for existing accounts
      const existingAccounts = await getExistingAccounts(particleWallet.address)
      console.log('[AuthContext] loginLens - existing accounts:', existingAccounts)

      if (existingAccounts.length > 0) {
        // Set the first account (stay in Account Manager mode for gas sponsorship)
        setAccount(existingAccounts[0])
        console.log('[AuthContext] loginLens - set account:', existingAccounts[0])
      }
      // If no accounts exist, user will need to create one later
    } catch (error) {
      console.error('[AuthContext] loginLens error:', error)
      setAuthError(error as Error)
      throw error
    }
  }

  /**
   * Step 3: Create Lens account with username
   */
  const createLensAccountWithUsername = async (username: string, metadataUri: string) => {
    if (!sessionClient || !particleWallet.walletClient) {
      throw new Error('Not ready to create account')
    }

    try {
      setIsAuthenticating(true)
      setAuthError(null)

      console.log('[AuthContext] Creating account with:', { username, metadataUri })

      // Create account (gas will be sponsored if configured in Lens dashboard)
      const newAccount = await createLensAccount(
        sessionClient,
        particleWallet.walletClient,
        username,
        metadataUri
      )

      console.log('[AuthContext] Account created:', newAccount)

      // Stay in Account Manager mode (don't switch to owner)
      // This allows app to sponsor gas for all user actions
      setAccount(newAccount)
    } catch (error) {
      console.error('[AuthContext] Create account error:', error)
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Refresh Lens account - check for newly created accounts
   */
  const refreshLensAccount = async () => {
    if (!particleWallet.address) {
      throw new Error('Wallet not connected')
    }

    try {
      setIsAuthenticating(true)
      setAuthError(null)

      console.log('[AuthContext] Refreshing account for:', particleWallet.address)

      // Check for existing accounts
      const existingAccounts = await getExistingAccounts(particleWallet.address)
      console.log('[AuthContext] Found accounts:', existingAccounts)

      if (existingAccounts.length > 0) {
        const firstAccount = existingAccounts[0]
        setAccount(firstAccount)
        console.log('[AuthContext] Account set:', firstAccount)
        console.log('[AuthContext] Account.account:', firstAccount.account)
        console.log('[AuthContext] Username:', firstAccount.account?.username)
      } else {
        console.log('[AuthContext] No accounts found')
      }
    } catch (error) {
      console.error('[AuthContext] Refresh account error:', error)
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Note: Lit is initialized lazily on first use (not part of auth flow)
   */

  /**
   * Full authentication flow
   */
  const authenticate = async () => {
    setIsAuthenticating(true)
    setAuthError(null)

    try {
      // Step 1: Connect wallet
      if (!particleWallet.isConnected) {
        await connectWallet()
      }

      // Step 2: Login to Lens
      if (!sessionClient) {
        await loginLens()
      }

      setAuthStep('complete')
    } catch (error) {
      setAuthError(error as Error)
      setAuthStep('idle')
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Disconnect and reset all auth state
   */
  const reset = () => {
    particleWallet.disconnect()
    setSessionClient(null)
    setAccount(null)
    setAuthStep('idle')
    setAuthError(null)
  }

  const value: AuthContextType = {
    // State
    walletAddress: particleWallet.address || null,
    walletClient: particleWallet.walletClient || null,
    isWalletConnected: particleWallet.isConnected,
    lensSession: sessionClient,
    lensAccount: account,
    hasLensAccount: !!account,
    isAuthenticating: isAuthenticating || particleWallet.isConnecting || isLensLoading,
    authError,
    authStep,

    // Actions
    connectWallet,
    disconnectWallet: particleWallet.disconnect,
    loginLens,
    createLensAccountWithUsername,
    refreshLensAccount,
    authenticate,
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
