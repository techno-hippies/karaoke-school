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
import { initializeLitSession } from '@/lib/lit/client'

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
  
  // Lit (Layer 3: Serverless Compute)
  litReady: boolean
  
  // Overall state
  isAuthenticating: boolean
  authError: Error | null
  authStep: 'idle' | 'wallet' | 'lens' | 'lit' | 'complete'
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
  
  // Layer 3: Lit Protocol
  const [litReady, setLitReady] = useState(false)
  
  // Overall state
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<Error | null>(null)
  const [authStep, setAuthStep] = useState<AuthState['authStep']>('idle')

  // Note: Lit initialization happens manually in authenticate() flow
  // We don't auto-initialize when wallet connects

  // Debug: Log particle wallet state changes
  useEffect(() => {
    console.log('[AuthContext] Particle wallet state:', {
      isConnected: particleWallet.isConnected,
      address: particleWallet.address,
      isConnecting: particleWallet.isConnecting,
    })
  }, [particleWallet.isConnected, particleWallet.address, particleWallet.isConnecting])

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
      
      // Check for existing accounts
      const existingAccounts = await getExistingAccounts(particleWallet.address)
      
      if (existingAccounts.length > 0) {
        // User has existing Lens account - login as account owner
        const session = await loginAsOnboardingUser(
          particleWallet.walletClient,
          particleWallet.address
        )
        
        // Switch to first account
        const ownerSession = await switchToAccountOwner(
          session,
          existingAccounts[0].address
        )
        
        setSessionClient(ownerSession)
        setAccount(existingAccounts[0])
      } else {
        // User has no Lens account - login as onboarding user
        const session = await loginAsOnboardingUser(
          particleWallet.walletClient,
          particleWallet.address
        )
        setSessionClient(session)
      }
    } catch (error) {
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
      
      // Create account
      const newAccount = await createLensAccount(
        sessionClient,
        particleWallet.walletClient,
        username,
        metadataUri
      )
      
      // Switch to account owner
      const ownerSession = await switchToAccountOwner(
        sessionClient,
        newAccount.address
      )
      
      setSessionClient(ownerSession)
      setAccount(newAccount)
    } catch (error) {
      setAuthError(error as Error)
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

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

      // Step 3: Initialize Lit (happens automatically via useEffect)
      setAuthStep('lit')
      // Wait for Lit to be ready
      while (!litReady) {
        await new Promise(resolve => setTimeout(resolve, 100))
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
    setLitReady(false)
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
    litReady,
    isAuthenticating: isAuthenticating || particleWallet.isConnecting || isLensLoading,
    authError,
    authStep,
    
    // Actions
    connectWallet,
    disconnectWallet: particleWallet.disconnect,
    loginLens,
    createLensAccountWithUsername,
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
