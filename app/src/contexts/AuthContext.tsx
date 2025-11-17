// src/contexts/AuthContext.tsx

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'

import type { PKPInfo, AuthData, PKPAuthContext } from '@/lib/lit'
import { LIT_SESSION_STORAGE_KEY } from '@/lib/lit/constants'
import { getExistingAccounts, resumeLensSession } from '@/lib/lens/auth'

// ---------------- Types ----------------

interface AuthState {
  pkpInfo: PKPInfo | null
  pkpAddress: Address | null
  pkpWalletClient: WalletClient | null
  pkpAuthContext: PKPAuthContext | null
  authData: AuthData | null
  isPKPReady: boolean

  lensSession: SessionClient | null
  lensAccount: Account | null
  hasLensAccount: boolean

  isAuthenticating: boolean
  authError: Error | null
  authStep: 'idle' | 'username' | 'webauthn' | 'session' | 'social' | 'complete'
  authMode: 'register' | 'login' | null
  authStatus: string
  lensSetupStatus: 'pending' | 'complete' | 'failed'
}

interface AuthActions {
  register: (username?: string) => Promise<void>
  signIn: () => Promise<void>
  logout: () => void

  showUsernameInput: () => void
  resetAuthFlow: () => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

// ---------------- Dynamic loaders ----------------

type LitModule = typeof import('@/lib/lit')
type AuthFlowsModule = typeof import('@/lib/auth/flows')

let litPromise: Promise<LitModule> | null = null
let authFlowsPromise: Promise<AuthFlowsModule> | null = null

function loadLit(): Promise<LitModule> {
  if (!litPromise) {
    litPromise = import('@/lib/lit')
  }
  return litPromise
}

function loadAuthFlows(): Promise<AuthFlowsModule> {
  if (!authFlowsPromise) {
    authFlowsPromise = import('@/lib/auth/flows')
  }
  return authFlowsPromise
}

/**
 * Defensive check for "likely valid" session in localStorage
 * WITHOUT importing Lit.
 */
function hasLikelyValidStoredSession(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const raw = window.localStorage.getItem(LIT_SESSION_STORAGE_KEY)
    if (!raw) return false

    const session = JSON.parse(raw)

    if (!session || typeof session !== 'object') {
      window.localStorage.removeItem(LIT_SESSION_STORAGE_KEY)
      return false
    }

    if (!session.expiresAt || typeof session.expiresAt !== 'number') {
      window.localStorage.removeItem(LIT_SESSION_STORAGE_KEY)
      return false
    }

    if (Date.now() >= session.expiresAt) {
      window.localStorage.removeItem(LIT_SESSION_STORAGE_KEY)
      return false
    }

    if (!session.pkpInfo || typeof session.pkpInfo !== 'object') {
      window.localStorage.removeItem(LIT_SESSION_STORAGE_KEY)
      return false
    }

    return true
  } catch (error) {
    console.warn('[Auth] localStorage check failed:', error)
    try {
      window.localStorage.removeItem(LIT_SESSION_STORAGE_KEY)
    } catch {
      // ignore
    }
    return false
  }
}

/**
 * Auth Provider
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // PKP Wallet State
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
  const [lensSetupStatus, setLensSetupStatus] =
    useState<'pending' | 'complete' | 'failed'>('pending')

  const address = walletClient?.account?.address || null
  const isConnected = !!walletClient && !!authContext

  // --------- Initialize PKP using Lit (lazy) ---------

  const initializePKP = useCallback(async (info: PKPInfo, data: AuthData) => {
    setIsInitializing(true)

    try {
      console.log('[Auth] Initializing PKP wallet:', info.ethAddress)

      const {
        createPKPWalletClient,
        createPKPAuthContext,
        getCachedAuthContext,
      } = await loadLit()

      let context = getCachedAuthContext(info.publicKey)

      if (!context) {
        console.log('[Auth] Creating PKP auth context...')
        context = await createPKPAuthContext(info, data)
      }

      console.log('[Auth] Creating wallet client...')
      const client = await createPKPWalletClient(info, context)

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

  // --------- Auto-initialize from stored session ---------

  const hasAutoInitializedRef = useRef(false)

  useEffect(() => {
    const autoInitialize = async () => {
      if (walletClient || isInitializing || hasAutoInitializedRef.current) return

      hasAutoInitializedRef.current = true

      // Step 1: Cheap check without Lit
      if (!hasLikelyValidStoredSession()) {
        console.log('[Auth] No stored session, skipping Lit initialization')
        return
      }

      // Step 2: Now load Lit + storage helpers
      const { getAuthStatus, clearSession } = await loadLit()
      const status = getAuthStatus()

      if (status.isAuthenticated && status.pkpInfo && status.authData) {
        console.log('[Auth] Auto-initializing from stored session...')

        try {
          await initializePKP(status.pkpInfo, status.authData)

          const lensSession = await resumeLensSession()
          if (lensSession) {
            setSessionClient(lensSession)

            const accounts = await getExistingAccounts(status.pkpInfo.ethAddress)
            if (accounts.length > 0) {
              setAccount(accounts[0].account)
              setLensSetupStatus('complete')
            }
          }
        } catch (error) {
          console.error('[Auth] Auto-initialization failed:', error)

          if (error instanceof Error) {
            if (error.message.includes('Invalid blockhash')) {
              console.log('[Auth] Clearing stale session data')
              clearSession()
            } else if (
              error.message.includes('Failed to fetch') ||
              error.message.includes('CORS')
            ) {
              console.log(
                '[Auth] Network error during auto-init, keeping PKP session'
              )
            }
          }
        }
      } else {
        // Stored blob looked valid but Lit disagrees → clean it up
        clearSession()
      }
    }

    void autoInitialize()
  }, [walletClient, isInitializing, initializePKP])

  // --------- Flow helpers ---------

  const showUsernameInput = useCallback(() => {
    setAuthMode('register')
    setAuthStep('username')
    setAuthError(null)
    setAuthStatus('')
    setIsAuthenticating(false)
  }, [])

  const resetAuthFlow = useCallback(() => {
    setAuthMode(null)
    setAuthStep('idle')
    setAuthError(null)
    setAuthStatus('')
    setIsAuthenticating(false)
  }, [])

  // --------- Register (lazy-load flows + Lit) ---------

  const register = useCallback(async (username?: string) => {
    try {
      const { registerWithPasskeyFlow } = await loadAuthFlows()

      const flowPromise = registerWithPasskeyFlow(username, (status) => {
        setAuthStatus(status)

        if (status.includes('passkey')) {
          setAuthStep('webauthn')
        } else if (status.includes('session') || status.includes('wallet')) {
          setAuthStep('session')
        } else if (status.includes('social') || status.includes('Lens')) {
          setAuthStep('social')
        }
      })

      setIsAuthenticating(true)
      setAuthError(null)
      setAuthMode('register')
      setAuthStep('webauthn')

      const result = await flowPromise

      setAuthContext(result.pkpAuthContext)
      setWalletClient(result.walletClient)
      setPkpInfo(result.pkpInfo)
      setAuthData(result.authData)
      setSessionClient(result.lensSession)
      setAccount(result.lensAccount)
      setLensSetupStatus(result.lensSetupStatus)

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

  // --------- Sign in (lazy-load flows + Lit) ---------

  const signIn = useCallback(async () => {
    try {
      const { signInWithPasskeyFlow } = await loadAuthFlows()

      const flowPromise = signInWithPasskeyFlow((status) => {
        setAuthStatus(status)

        if (status.includes('authenticate') || status.includes('device')) {
          setAuthStep('webauthn')
        } else if (status.includes('wallet') || status.includes('Restoring')) {
          setAuthStep('session')
        } else if (status.includes('social') || status.includes('Lens')) {
          setAuthStep('social')
        }
      })

      setIsAuthenticating(true)
      setAuthMode('login')
      setAuthStep('webauthn')
      setAuthError(null)

      const result = await flowPromise

      setAuthContext(result.pkpAuthContext)
      setWalletClient(result.walletClient)
      setPkpInfo(result.pkpInfo)
      setAuthData(result.authData)
      setSessionClient(result.lensSession)
      setAccount(result.lensAccount)
      setLensSetupStatus(result.lensSetupStatus)

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

  // --------- Logout ---------

  const logout = useCallback(() => {
    void loadLit()
      .then(({ clearSession }) => clearSession())
      .catch((err) =>
        console.error('[Auth] Failed to clear session via Lit:', err)
      )

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

  const value: AuthContextType = useMemo(
    () => ({
      // PKP
      pkpInfo,
      pkpAddress: address,
      pkpWalletClient: walletClient,
      pkpAuthContext: authContext,
      authData,
      isPKPReady: isConnected,

      // Lens
      lensSession: sessionClient,
      lensAccount: account,
      hasLensAccount: !!account,

      // Flow state
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
    }),
    [
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
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
