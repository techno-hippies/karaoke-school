/**
 * Auth Context for SolidJS
 *
 * Manages PKP wallet + Lens session state with support for:
 * - Passkey (WebAuthn) authentication
 * - Social login stubs (Google/Discord - not yet implemented)
 * - EOA wallet connection (Metamask, Rabby, etc.)
 */

import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  type ParentComponent,
  type Accessor,
} from 'solid-js'
import type { Address, WalletClient } from 'viem'
import type { SessionClient, Account } from '@lens-protocol/client'
import type { PKPInfo, AuthData, PKPAuthContext } from '@/lib/lit'
import { LIT_SESSION_STORAGE_KEY } from '@/lib/lit/constants'
import { validateUsernameFormat } from '@/lib/lens/account-creation'
import { getExistingAccounts, resumeLensSession } from '@/lib/lens/auth'
import {
  wagmiConfig,
  getWalletClient,
  watchAccount,
  disconnect as disconnectWagmi,
} from '@/providers/Web3Provider'

// Dynamic module loaders for code splitting
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

// Auth State Types
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
  authMode: Accessor<'register' | 'login' | 'eoa' | 'google' | 'discord' | null>
  authStatus: Accessor<string>
  lensSetupStatus: Accessor<'pending' | 'complete' | 'failed'>
}

interface AuthActions {
  register: (username?: string) => Promise<void>
  signIn: () => Promise<void>
  loginWithGoogle: (username?: string) => Promise<void>
  loginWithDiscord: (username?: string) => Promise<void>
  connectWithEoa: (walletClient: WalletClient, username?: string) => Promise<void>
  retryEoaWithUsername: (username: string) => Promise<void>
  logout: () => void
  showUsernameInput: () => void
  resetAuthFlow: () => void
  openAuthDialog: () => void
  setAuthDialogOpener: (opener: () => void) => void
  expectWalletConnection: () => void
  setEoaWalletClient: (client: WalletClient | null) => void
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType>()

/**
 * Check for valid stored session without loading Lit
 */
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
  const [authMode, setAuthMode] = createSignal<AuthState['authMode']['prototype']>(null)
  const [authStatus, setAuthStatus] = createSignal('')
  const [lensSetupStatus, setLensSetupStatus] = createSignal<'pending' | 'complete' | 'failed'>('pending')

  // EOA wallet state (external wallet for retries)
  const [eoaWalletClient, setEoaWalletClient] = createSignal<WalletClient | null>(null)

  // Auth dialog opener ref
  let authDialogOpener: (() => void) | null = null

  // Track if user explicitly wants wallet connection (vs wagmi auto-reconnect)
  const [expectingWallet, setExpectingWallet] = createSignal(false)
  // Track if we've processed this EOA connection to prevent duplicate runs
  const [processedEoaAddress, setProcessedEoaAddress] = createSignal<string | null>(null)

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

      console.log('[Auth] PKP wallet initialized')
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

        // Try to resume Lens session
        try {
          const lensSession = await resumeLensSession()

          if (lensSession) {
            setSessionClient(lensSession)

            const accounts = await getExistingAccounts(status.pkpInfo.ethAddress)
            if (accounts.length > 0) {
              setAccount(accounts[0].account)
              setLensSetupStatus('complete')
            }
          }
        } catch (lensError) {
          console.error('[Auth] Lens session resume failed:', lensError)
        }
      } else {
        clearSession()
      }
    } catch (error) {
      console.error('[Auth] Auto-initialization failed:', error)
    } finally {
      setIsCheckingSession(false)
    }
  })

  // Watch for EOA wallet connections via wagmi
  onMount(() => {
    const unwatch = watchAccount(wagmiConfig, {
      onChange: async (account) => {
        const eoaAddress = account.address
        const isEoaConnected = account.isConnected

        console.log('[Auth] EOA account change:', {
          isEoaConnected,
          eoaAddress,
          hasPkpWallet: !!walletClient(),
          isAuthenticating: isAuthenticating(),
          isInitializing: isInitializing(),
          processedAddress: processedEoaAddress(),
          expectingWallet: expectingWallet(),
        })

        // Skip if not connected
        if (!isEoaConnected || !eoaAddress) {
          console.log('[Auth] EOA skipped: not connected')
          return
        }

        // Skip if already have PKP wallet
        if (walletClient()) {
          console.log('[Auth] EOA skipped: already have PKP wallet')
          return
        }

        // Skip if currently authenticating
        if (isAuthenticating() || isInitializing()) {
          console.log('[Auth] EOA skipped: auth in progress')
          return
        }

        // Skip if already processed this address
        if (processedEoaAddress() === eoaAddress) {
          console.log('[Auth] EOA skipped: already processed this address')
          return
        }

        // Skip if this is a stale wagmi auto-reconnect (user didn't click Connect Wallet)
        if (!expectingWallet()) {
          console.log('[Auth] EOA skipped: not expecting wallet connection (stale auto-reconnect)')
          // Disconnect the stale connection
          disconnectWagmi(wagmiConfig)
          return
        }

        // Mark as processed and clear the expectation flag
        setProcessedEoaAddress(eoaAddress)
        setExpectingWallet(false)

        console.log('[Auth] EOA connected, starting PKP flow:', eoaAddress)

        // Dialog is already open showing "Waiting for wallet connection..."
        // Now update status to show we're connecting
        setAuthStatus('Connecting wallet...')

        // Get wagmi wallet client and run EOA flow
        try {
          const wagmiClient = await getWalletClient(wagmiConfig)
          if (!wagmiClient) {
            console.error('[Auth] Failed to get wagmi wallet client')
            setAuthError(new Error('Failed to get wallet client'))
            return
          }

          await connectWithEoa(wagmiClient)
        } catch (error) {
          console.error('[Auth] EOA flow error:', error)
          // Error handling is done in connectWithEoa
        }
      },
    })

    onCleanup(unwatch)
  })

  // Flow helpers
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
    setExpectingWallet(true)
    // Also reset processedEoaAddress so we can process a new connection
    setProcessedEoaAddress(null)
    // Set auth state to show "waiting for wallet" in the dialog
    setAuthMode('eoa')
    setAuthStep('processing')
    setAuthStatus('Waiting for wallet connection...')
    setAuthError(null)
  }

  // Register with passkey
  const register = async (username?: string) => {
    try {
      const { registerWithPasskeyFlow } = await loadAuthFlows()

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

  // Sign in with passkey
  const signIn = async () => {
    try {
      const { signInWithPasskeyFlow } = await loadAuthFlows()

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

  // Login with Google (stub)
  const loginWithGoogle = async (username?: string) => {
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
      setAuthMode('google')
      setAuthStep('processing')
      setAuthStatus('')
      setAuthError(null)

      const { authGoogle } = await loadAuthSocial()
      const { loginLensStandalone } = await loadAuthFlows()

      // Auth with Google & Get PKP (will throw - not implemented)
      const result = await authGoogle(
        (status) => setAuthStatus(status),
        { requireExisting: !normalized }
      )

      // Connect Lens
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
  }

  // Login with Discord (stub)
  const loginWithDiscord = async (username?: string) => {
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
      setAuthMode('discord')
      setAuthStep('processing')
      setAuthStatus('')
      setAuthError(null)

      const { authDiscord } = await loadAuthSocial()
      const { loginLensStandalone } = await loadAuthFlows()

      // Auth with Discord & Get PKP (will throw - not implemented)
      const result = await authDiscord(
        (status) => setAuthStatus(status),
        { requireExisting: !normalized }
      )

      // Connect Lens
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
  }

  // Connect with EOA wallet
  const connectWithEoa = async (eoaClient: WalletClient, username?: string) => {
    setEoaWalletClient(eoaClient)

    try {
      setIsAuthenticating(true)
      setAuthMode('eoa')
      setAuthStep('processing')
      setAuthError(null)

      const { connectWithEoaFlow } = await loadAuthFlows()

      const result = await connectWithEoaFlow(
        eoaClient,
        username,
        (status) => setAuthStatus(status)
      )

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
      console.log('[Auth] EOA flow complete, PKP ready:', result.pkpInfo.ethAddress)
    } catch (error) {
      console.error('[Auth] EOA flow error:', error)
      const err = error as Error

      if (err.message?.includes('Username is required')) {
        // New user needs Lens account - show username prompt
        setAuthStep('username')
        setAuthMode('eoa')
        setAuthError(null)
      } else {
        setAuthError(err)
        setAuthStep('idle')
        setAuthMode(null)
      }
      throw error
    } finally {
      setIsAuthenticating(false)
      setAuthStatus('')
    }
  }

  // Retry EOA with username (called after user enters username)
  const retryEoaWithUsername = async (username: string) => {
    const normalized = username.trim()
    const validationError = validateUsernameFormat(normalized)

    if (validationError) {
      setAuthError(new Error(validationError))
      setAuthStep('username')
      return
    }

    const client = eoaWalletClient()
    if (!client) {
      setAuthError(new Error('Wallet disconnected. Please reconnect and try again.'))
      setAuthStep('idle')
      return
    }

    try {
      setIsAuthenticating(true)
      setAuthMode('eoa')
      setAuthStep('processing')
      setAuthError(null)

      const { connectWithEoaFlow } = await loadAuthFlows()

      const result = await connectWithEoaFlow(
        client,
        normalized,
        (status) => setAuthStatus(status)
      )

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
      console.log('[Auth] EOA retry complete, PKP ready:', result.pkpInfo.ethAddress)
    } catch (error) {
      console.error('[Auth] EOA retry error:', error)
      setAuthError(error as Error)
      setAuthStep('idle')
      setAuthMode(null)
    } finally {
      setIsAuthenticating(false)
      setAuthStatus('')
    }
  }

  // Logout
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
    setEoaWalletClient(null)
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
    connectWithEoa,
    retryEoaWithUsername,
    logout,
    showUsernameInput,
    resetAuthFlow,
    openAuthDialog,
    setAuthDialogOpener,
    expectWalletConnection,
    setEoaWalletClient,
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
