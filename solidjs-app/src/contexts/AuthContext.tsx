/**
 * Auth Context for SolidJS
 * Manages PKP wallet + Lens session state
 */

import {
  createContext,
  useContext,
  createSignal,
  onMount,
  type ParentComponent,
  type Accessor,
} from 'solid-js'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import type { PKPInfo, AuthData, PKPAuthContext } from '@/lib/lit'
import { LIT_SESSION_STORAGE_KEY } from '@/lib/lit/constants'

// Auth State
interface AuthState {
  pkpInfo: Accessor<PKPInfo | null>
  pkpAddress: Accessor<Address | null>
  pkpWalletClient: Accessor<WalletClient | null>
  pkpAuthContext: Accessor<PKPAuthContext | null>
  authData: Accessor<AuthData | null>
  isPKPReady: Accessor<boolean>
  isCheckingSession: Accessor<boolean>

  lensSession: Accessor<SessionClient | null>
  lensAccount: Accessor<Account | null>
  hasLensAccount: Accessor<boolean>

  isAuthenticating: Accessor<boolean>
  authError: Accessor<Error | null>
  authStep: Accessor<'idle' | 'username' | 'webauthn' | 'session' | 'social' | 'processing' | 'complete'>
  authMode: Accessor<'register' | 'login' | 'eoa' | null>
  authStatus: Accessor<string>
  lensSetupStatus: Accessor<'pending' | 'complete' | 'failed'>
}

interface AuthActions {
  register: (username?: string) => Promise<void>
  signIn: () => Promise<void>
  loginWithGoogle: (username?: string) => Promise<void>
  loginWithDiscord: (username?: string) => Promise<void>
  retryEoaWithUsername: (username: string) => Promise<void>
  logout: () => void
  showUsernameInput: () => void
  resetAuthFlow: () => void
  openAuthDialog: () => void
  setAuthDialogOpener: (opener: () => void) => void
  expectWalletConnection: () => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType>()

// Dynamic loaders for code splitting
type LitModule = typeof import('@/lib/lit')
let litPromise: Promise<LitModule> | null = null

function loadLit(): Promise<LitModule> {
  if (!litPromise) {
    litPromise = import('@/lib/lit')
  }
  return litPromise
}

function hasLikelyValidStoredSession(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const raw = window.localStorage.getItem(LIT_SESSION_STORAGE_KEY)
    if (!raw) return false

    const session = JSON.parse(raw)
    if (!session || typeof session !== 'object') return false
    if (!session.expiresAt || Date.now() >= session.expiresAt) return false
    if (!session.pkpInfo) return false

    return true
  } catch {
    return false
  }
}

export const AuthProvider: ParentComponent = (props) => {
  // PKP Wallet State
  const [walletClient, setWalletClient] = createSignal<WalletClient | null>(null)
  const [authContext, setAuthContext] = createSignal<PKPAuthContext | null>(null)
  const [pkpInfo, setPkpInfo] = createSignal<PKPInfo | null>(null)
  const [authData, setAuthData] = createSignal<AuthData | null>(null)
  const [isInitializing, setIsInitializing] = createSignal(false)
  const [isCheckingSession, setIsCheckingSession] = createSignal(true)

  // Lens State
  const [sessionClient, setSessionClient] = createSignal<SessionClient | null>(null)
  const [account, setAccount] = createSignal<Account | null>(null)

  // Flow state
  const [isAuthenticating, setIsAuthenticating] = createSignal(false)
  const [authError, setAuthError] = createSignal<Error | null>(null)
  const [authStep, setAuthStep] = createSignal<AuthState['authStep']['prototype']>('idle')
  const [authMode, setAuthMode] = createSignal<'register' | 'login' | 'eoa' | null>(null)
  const [authStatus, setAuthStatus] = createSignal('')
  const [lensSetupStatus, setLensSetupStatus] = createSignal<'pending' | 'complete' | 'failed'>('pending')

  // Auth dialog opener ref
  let authDialogOpener: (() => void) | null = null

  // Derived state
  const address = () => walletClient()?.account?.address || null
  const isConnected = () => !!walletClient() && !!authContext()

  // Initialize PKP
  const initializePKP = async (info: PKPInfo, data: AuthData) => {
    setIsInitializing(true)

    try {
      console.log('[Auth] Initializing PKP wallet:', info.ethAddress)
      const lit = await loadLit()

      let context = lit.getCachedAuthContext(info.publicKey)
      if (!context) {
        console.log('[Auth] Creating PKP auth context...')
        context = await lit.createPKPAuthContext(info, data)
      }

      console.log('[Auth] Creating wallet client...')
      const client = await lit.createPKPWalletClient(info, context)

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
  }

  // Auto-initialize from stored session
  onMount(async () => {
    if (walletClient() || isInitializing()) return

    if (!hasLikelyValidStoredSession()) {
      console.log('[Auth] No stored session')
      setIsCheckingSession(false)
      return
    }

    try {
      const { getAuthStatus, clearSession } = await loadLit()
      const status = getAuthStatus()

      if (status.isAuthenticated && status.pkpInfo && status.authData) {
        console.log('[Auth] Auto-initializing from stored session...')
        await initializePKP(status.pkpInfo, status.authData)
      } else {
        clearSession()
      }
    } catch (error) {
      console.error('[Auth] Auto-initialization failed:', error)
    } finally {
      setIsCheckingSession(false)
    }
  })

  // Actions
  const showUsernameInput = () => {
    setAuthMode('register')
    setAuthStep('username')
    setAuthError(null)
    setAuthStatus('')
    setIsAuthenticating(false)
  }

  const resetAuthFlow = () => {
    setAuthMode(null)
    setAuthStep('idle')
    setAuthError(null)
    setAuthStatus('')
    setIsAuthenticating(false)
  }

  const openAuthDialog = () => {
    if (authDialogOpener) {
      authDialogOpener()
    } else {
      console.warn('[Auth] Auth dialog opener not set')
    }
  }

  const setAuthDialogOpener = (opener: () => void) => {
    authDialogOpener = opener
  }

  const expectWalletConnection = () => {
    // For EOA wallet flow
  }

  const register = async (username?: string) => {
    try {
      const { registerWithPasskeyFlow } = await import('@/lib/auth/flows')

      setIsAuthenticating(true)
      setAuthError(null)
      setAuthMode('register')
      setAuthStep('webauthn')

      const result = await registerWithPasskeyFlow(username, (status) => {
        setAuthStatus(status)
        if (status.includes('passkey')) setAuthStep('webauthn')
        else if (status.includes('session')) setAuthStep('session')
        else if (status.includes('Lens')) setAuthStep('social')
      })

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
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  const signIn = async () => {
    try {
      const { signInWithPasskeyFlow } = await import('@/lib/auth/flows')

      setIsAuthenticating(true)
      setAuthMode('login')
      setAuthStep('webauthn')
      setAuthError(null)

      const result = await signInWithPasskeyFlow((status) => {
        setAuthStatus(status)
        if (status.includes('authenticate')) setAuthStep('webauthn')
        else if (status.includes('wallet')) setAuthStep('session')
        else if (status.includes('Lens')) setAuthStep('social')
      })

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
      throw error
    } finally {
      setIsAuthenticating(false)
    }
  }

  const loginWithGoogle = async (_username?: string) => {
    // TODO: Implement Google OAuth flow
    console.log('[Auth] Google login not yet implemented')
  }

  const loginWithDiscord = async (_username?: string) => {
    // TODO: Implement Discord OAuth flow
    console.log('[Auth] Discord login not yet implemented')
  }

  const retryEoaWithUsername = async (_username: string) => {
    // TODO: Implement EOA retry flow
    console.log('[Auth] EOA retry not yet implemented')
  }

  const logout = () => {
    loadLit()
      .then(({ clearSession }) => clearSession())
      .catch((err) => console.error('[Auth] Failed to clear session:', err))

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
  }

  const value: AuthContextType = {
    // State (all as accessors)
    pkpInfo,
    pkpAddress: address,
    pkpWalletClient: walletClient,
    pkpAuthContext: authContext,
    authData,
    isPKPReady: isConnected,
    isCheckingSession,
    lensSession: sessionClient,
    lensAccount: account,
    hasLensAccount: () => !!account(),
    isAuthenticating: () => isAuthenticating() || isInitializing(),
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
    retryEoaWithUsername,
    logout,
    showUsernameInput,
    resetAuthFlow,
    openAuthDialog,
    setAuthDialogOpener,
    expectWalletConnection,
  }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
