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
import { useAccount, useDisconnect, useWalletClient } from 'wagmi'

import type { PKPInfo, AuthData, PKPAuthContext } from '@/lib/lit'
import { LIT_SESSION_STORAGE_KEY } from '@/lib/lit/constants'
import { getExistingAccounts, resumeLensSession } from '@/lib/lens/auth'
import { validateUsernameFormat } from '@/lib/lens/account-creation'

// ---------------- Types ----------------

interface AuthState {
  pkpInfo: PKPInfo | null
  pkpAddress: Address | null
  pkpWalletClient: WalletClient | null
  pkpAuthContext: PKPAuthContext | null
  authData: AuthData | null
  isPKPReady: boolean
  /** True while checking for stored session on initial load */
  isCheckingSession: boolean

  lensSession: SessionClient | null
  lensAccount: Account | null
  hasLensAccount: boolean

  isAuthenticating: boolean
  authError: Error | null
  authStep:
    | 'idle'
    | 'username'
    | 'webauthn'
    | 'session'
    | 'social'
    | 'processing'
    | 'complete'
  authMode: 'register' | 'login' | null
  authStatus: string
  lensSetupStatus: 'pending' | 'complete' | 'failed'
}

interface AuthActions {
  register: (username?: string) => Promise<void>
  signIn: () => Promise<void>
  loginWithGoogle: (username?: string) => Promise<void>
  loginWithDiscord: (username?: string) => Promise<void>
  logout: () => void

  showUsernameInput: () => void
  resetAuthFlow: () => void

  /** Open the auth dialog (set by App.tsx) */
  openAuthDialog: () => void
  /** Set the auth dialog opener (called by App.tsx) */
  setAuthDialogOpener: (opener: () => void) => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

// ---------------- Dynamic loaders ----------------

type LitModule = typeof import('@/lib/lit')
type AuthFlowsModule = typeof import('@/lib/auth/flows')
type AuthSocialModule = typeof import('@/lib/lit/auth-social')

let litPromise: Promise<LitModule> | null = null
let authFlowsPromise: Promise<AuthFlowsModule> | null = null
let authSocialPromise: Promise<AuthSocialModule> | null = null

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

function loadAuthSocial(): Promise<AuthSocialModule> {
  if (!authSocialPromise) {
    authSocialPromise = import('@/lib/lit/auth-social')
  }
  return authSocialPromise
}

// EOA flow loader
type EoaFlowModule = typeof import('@/lib/auth/flows')
let eoaFlowPromise: Promise<EoaFlowModule> | null = null

function loadEoaFlow(): Promise<EoaFlowModule> {
  if (!eoaFlowPromise) {
    eoaFlowPromise = import('@/lib/auth/flows')
  }
  return eoaFlowPromise
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
  // Track initial session check to prevent UI flash - default true to avoid Sign Up flash
  const [isCheckingSession, setIsCheckingSession] = useState(true)

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

  // Auth dialog opener - set by App.tsx
  const authDialogOpenerRef = useRef<(() => void) | null>(null)

  const openAuthDialog = useCallback(() => {
    if (authDialogOpenerRef.current) {
      authDialogOpenerRef.current()
    } else {
      console.warn('[Auth] Auth dialog opener not set')
    }
  }, [])

  const setAuthDialogOpener = useCallback((opener: () => void) => {
    authDialogOpenerRef.current = opener
  }, [])

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
        setIsCheckingSession(false)
        return
      }

      try {
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
      } catch (error) {
        console.error('[Auth] Failed to load Lit or check auth status:', error)
      } finally {
        setIsCheckingSession(false)
      }
    }

    void autoInitialize()
  }, [walletClient, isInitializing, initializePKP])

  // --------- EOA wallet connection (Metamask, Rabby) ---------

  const {
    address: eoaAddress,
    isConnected: isEoaConnected,
  } = useAccount()
  const { data: wagmiWalletClient } = useWalletClient()
  const { disconnect: disconnectEoa } = useDisconnect()

  // Track if we've processed this EOA connection to prevent duplicate runs
  const processedEoaRef = useRef<string | null>(null)

  useEffect(() => {
    // Skip if not connected or no wagmi wallet client
    if (!isEoaConnected || !eoaAddress || !wagmiWalletClient) {
      return
    }

    // Skip if already have PKP wallet (from passkey, stored session, or previous EOA flow)
    if (walletClient) {
      return
    }

    // Skip if already processing
    if (isAuthenticating || isInitializing) {
      return
    }

    // Skip if we've already processed this address
    if (processedEoaRef.current === eoaAddress) {
      return
    }

    // Mark as processed
    processedEoaRef.current = eoaAddress

    console.log('[Auth] EOA connected, starting PKP flow:', eoaAddress)

    const runEoaFlow = async () => {
      try {
        setIsAuthenticating(true)
        setAuthStep('processing')
        setAuthError(null)

        const { connectWithEoaFlow } = await loadEoaFlow()

        const result = await connectWithEoaFlow(
          wagmiWalletClient,
          undefined, // username - will be prompted if new user needs Lens account
          (status) => setAuthStatus(status)
        )

        // Set all state from result
        setAuthContext(result.pkpAuthContext)
        setWalletClient(result.walletClient)
        setPkpInfo(result.pkpInfo)
        setAuthData(result.authData)
        setSessionClient(result.lensSession)
        setAccount(result.lensAccount)
        setLensSetupStatus(result.lensSetupStatus)

        setAuthStep('complete')
        console.log('[Auth] ✓ EOA flow complete, PKP ready:', result.pkpInfo.ethAddress)
      } catch (error) {
        console.error('[Auth] EOA flow error:', error)
        setAuthError(error as Error)
        setAuthStep('idle')

        // Reset processed ref so user can retry
        processedEoaRef.current = null

        // Disconnect the EOA wallet on error
        disconnectEoa()
      } finally {
        setIsAuthenticating(false)
        setAuthStatus('')
      }
    }

    void runEoaFlow()
  }, [
    eoaAddress,
    isEoaConnected,
    wagmiWalletClient,
    walletClient,
    isAuthenticating,
    isInitializing,
    disconnectEoa,
  ])

  // Reset EOA tracking on logout
  useEffect(() => {
    if (!walletClient && !isCheckingSession) {
      processedEoaRef.current = null
    }
  }, [walletClient, isCheckingSession])

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

  // --------- Login with Google ---------
  
  const loginWithGoogle = useCallback(async (username?: string) => {
    const normalized = username?.trim() || undefined
    if (normalized) {
      const validationError = validateUsernameFormat(normalized)
      if (validationError) {
        setAuthError(new Error(validationError))
        setAuthStep('username')
        return
      }
    }
    try {
      setIsAuthenticating(true)
      setAuthMode('login')
      setAuthStep('processing')
      setAuthStatus('')
      setAuthError(null)

      const { authGoogle } = await loadAuthSocial()
      const { loginLensStandalone } = await loadAuthFlows()

      // 1. Auth with Google & Get PKP (Mint if new)
      const result = await authGoogle(
        (status) => setAuthStatus(status),
        { requireExisting: !normalized }
      )

      // 2. Connect Lens
      
      // Get PKP Wallet Client for Lens
      const litModule = await loadLit()
      const pkpWalletClient = await litModule.createPKPWalletClient(
        result.pkpInfo,
        result.authContext
      )
      
      const lensResult = await loginLensStandalone(
        pkpWalletClient,
        result.pkpInfo.ethAddress,
        normalized,
        (status) => setAuthStatus(status)
      )
      
      setAuthContext(result.authContext)
      setWalletClient(pkpWalletClient)
      setPkpInfo(result.pkpInfo)
      setAuthData(result.authData)
      setSessionClient(lensResult.session)
      setAccount(lensResult.account)
      setLensSetupStatus('complete')
      
      setAuthStep('complete')
      setAuthMode(null)
      setAuthStatus('')
    } catch (error) {
      console.error('[Auth] Google login error:', error)
      const err = error as Error
      setAuthError(err)
      if (err.message?.includes('Username is required')) {
        setAuthStep('username')
      } else {
        setAuthStep('idle')
      }
      setAuthMode(null)
      setAuthStatus('')
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  // --------- Login with Discord ---------
  
  const loginWithDiscord = useCallback(async (username?: string) => {
    const normalized = username?.trim() || undefined
    if (normalized) {
      const validationError = validateUsernameFormat(normalized)
      if (validationError) {
        setAuthError(new Error(validationError))
        setAuthStep('username')
        return
      }
    }
    try {
      setIsAuthenticating(true)
      setAuthMode('login')
      setAuthStep('processing')
      setAuthStatus('')
      setAuthError(null)

      const { authDiscord } = await loadAuthSocial()
      const { loginLensStandalone } = await loadAuthFlows()

      // 1. Auth with Discord & Get PKP (Mint if new)
      const result = await authDiscord(
        (status) => setAuthStatus(status),
        { requireExisting: !normalized }
      )

      // 2. Connect Lens
      
      // Get PKP Wallet Client for Lens
      const litModule = await loadLit()
      const pkpWalletClient = await litModule.createPKPWalletClient(
        result.pkpInfo,
        result.authContext
      )
      
      const lensResult = await loginLensStandalone(
        pkpWalletClient,
        result.pkpInfo.ethAddress,
        normalized,
        (status) => setAuthStatus(status)
      )
      
      setAuthContext(result.authContext)
      setWalletClient(pkpWalletClient)
      setPkpInfo(result.pkpInfo)
      setAuthData(result.authData)
      setSessionClient(lensResult.session)
      setAccount(lensResult.account)
      setLensSetupStatus('complete')
      
      setAuthStep('complete')
      setAuthMode(null)
      setAuthStatus('')
    } catch (error) {
      console.error('[Auth] Discord login error:', error)
      const err = error as Error
      setAuthError(err)
      if (err.message?.includes('Username is required')) {
        setAuthStep('username')
      } else {
        setAuthStep('idle')
      }
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

    // Disconnect EOA wallet if connected
    disconnectEoa()

    // Reset EOA tracking
    processedEoaRef.current = null

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
  }, [disconnectEoa])

  const value: AuthContextType = useMemo(
    () => ({
      // PKP
      pkpInfo,
      pkpAddress: address,
      pkpWalletClient: walletClient,
      pkpAuthContext: authContext,
      authData,
      isPKPReady: isConnected,
      isCheckingSession,

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
      loginWithGoogle,
      loginWithDiscord,
      logout,
      showUsernameInput,
      resetAuthFlow,
      openAuthDialog,
      setAuthDialogOpener,
    }),
    [
      pkpInfo,
      address,
      walletClient,
      authContext,
      authData,
      isConnected,
      isCheckingSession,
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
      openAuthDialog,
      setAuthDialogOpener,
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
