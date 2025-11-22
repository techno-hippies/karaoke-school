/**
 * PKP (Programmable Key Pair) Operations
 * Combines WebAuthn authentication, PKP minting, auth context, and wallet creation
 */

import { WebAuthnAuthenticator } from '@lit-protocol/auth'
import {
  createWalletClient,
  custom,
  type WalletClient,
  type Address,
  type Hex,
  type LocalAccount,
  type Chain,
  type TransactionSerializable,
  type TypedDataDefinition,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import i18n from '@/lib/i18n'
import { getLitClient, getAuthManager } from './client'
import { LIT_WEBAUTHN_CONFIG } from './config'
import { saveSession } from './storage'
import type { PKPInfo, AuthData, PKPAuthContext } from './types'

const IS_DEV = import.meta.env.DEV

// =============================================================================
// WebAuthn Authentication & PKP Minting
// =============================================================================

export interface AuthFlowResult {
  pkpInfo: PKPInfo
  authData: AuthData
  authContext: PKPAuthContext
  isNewUser: boolean
}

/**
 * Register new user: WebAuthn → Mint PKP → Auth Context
 */
export async function registerUser(
  username: string | undefined,
  onStatusUpdate: (status: string) => void
): Promise<AuthFlowResult> {
  onStatusUpdate(i18n.t('auth.initializingLit'))
  await getLitClient()

  // Register new WebAuthn credential and mint PKP
  onStatusUpdate(i18n.t('auth.createPasskey'))
  const registerResult = await WebAuthnAuthenticator.registerAndMintPKP({
    username: username || 'K-School User',
    authServiceBaseUrl: LIT_WEBAUTHN_CONFIG.authServiceUrl,
    scopes: [...LIT_WEBAUTHN_CONFIG.pkpScopes],
  })

  console.log('✅ Registered new credential and minted PKP')

  const pkpInfo = registerResult.pkpInfo

  // SDK v8: registerAndMintPKP only returns { pkpInfo, webAuthnPublicKey }
  // We must call authenticate() separately to get authData
  onStatusUpdate(i18n.t('auth.authenticatingPasskey'))
  const authData = await WebAuthnAuthenticator.authenticate()
  console.log('✅ Authenticated with new credential')

  // Create auth context (session signature)
  onStatusUpdate(i18n.t('auth.creatingSession'))

  // Convert PKP info to our types
  const pkpInfoTyped: PKPInfo = {
    publicKey: pkpInfo.pubkey,
    ethAddress: pkpInfo.ethAddress as `0x${string}`,
    tokenId: pkpInfo.tokenId.toString(),
  }

  const authDataTyped: AuthData = {
    authMethodType: authData.authMethodType,
    authMethodId: authData.authMethodId,
    accessToken: authData.accessToken,
  }

  // Create auth context
  const authContext = await createPKPAuthContext(pkpInfoTyped, authDataTyped)

  console.log('✅ Auth context created')

  // Build result
  const result: AuthFlowResult = {
    pkpInfo: pkpInfoTyped,
    authData: authDataTyped,
    authContext,
    isNewUser: true,
  }

  // Save session
  saveSession(result.pkpInfo, result.authData)

  return result
}

/**
 * Login existing user: Authenticate WebAuthn → Get PKP → Auth Context
 */
export async function loginUser(
  onStatusUpdate: (status: string) => void
): Promise<AuthFlowResult> {
  onStatusUpdate(i18n.t('auth.initializingLit'))
  const litClient = await getLitClient()

  // Authenticate with existing WebAuthn credential
  onStatusUpdate(i18n.t('auth.authenticateDevice'))
  const authData = await WebAuthnAuthenticator.authenticate()

  console.log('✅ Authenticated with existing credential')

  // Get PKP for this credential
  onStatusUpdate(i18n.t('auth.fetchingAccount'))
  const pkpsResult = await litClient.viewPKPsByAuthData({
    authData: {
      authMethodType: authData.authMethodType,
      authMethodId: authData.authMethodId,
    },
    pagination: {
      limit: 5,
      offset: 0,
    },
  })

  if (!pkpsResult || !pkpsResult.pkps || pkpsResult.pkps.length === 0) {
    throw new Error('No account found. Please create a new account instead.')
  }

  const pkpInfo = pkpsResult.pkps[0]
  console.log('✅ PKP found:', pkpInfo.ethAddress)

  // Create auth context (session signature)
  onStatusUpdate(i18n.t('auth.creatingSession'))

  // Convert PKP info to our types
  const pkpInfoTyped: PKPInfo = {
    publicKey: pkpInfo.pubkey,
    ethAddress: pkpInfo.ethAddress as `0x${string}`,
    tokenId: pkpInfo.tokenId.toString(),
  }

  const authDataTyped: AuthData = {
    authMethodType: authData.authMethodType,
    authMethodId: authData.authMethodId,
    accessToken: authData.accessToken,
  }

  // Create auth context
  const authContext = await createPKPAuthContext(pkpInfoTyped, authDataTyped)

  console.log('✅ Auth context created')

  // Build result
  const result: AuthFlowResult = {
    pkpInfo: pkpInfoTyped,
    authData: authDataTyped,
    authContext,
    isNewUser: false,
  }

  // Save session
  saveSession(result.pkpInfo, result.authData)

  return result
}

// =============================================================================
// PKP Auth Context
// =============================================================================

/**
 * In-memory cache for auth context
 * Cannot persist to localStorage due to callback functions
 */
let cachedAuthContext: PKPAuthContext | null = null
let cachedPKPPublicKey: string | null = null
let cachedDomain: string | null = null

/**
 * Calculate expiration time (24 hours from now)
 */
function getConsistentExpiration(): string {
  return new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
}

/**
 * Create PKP auth context
 * This enables 0-signature Lit Action execution
 */
export async function createPKPAuthContext(
  pkpInfo: PKPInfo,
  authData: AuthData
): Promise<PKPAuthContext> {
  const domain =
    typeof window !== 'undefined' ? window.location.hostname : 'localhost'

// Return cached context if available for the same PKP + domain
  if (
    cachedAuthContext &&
    cachedPKPPublicKey === pkpInfo.publicKey &&
    cachedDomain === domain
  ) {
    if (IS_DEV) console.log('[Lit] Using cached PKP auth context')
    return cachedAuthContext
  }

  if (IS_DEV) console.log('[Lit] Creating PKP auth context...')

  try {
    const litClient = await getLitClient()
    const authManager = getAuthManager()

    // Create PKP auth context
    const authContext = await authManager.createPkpAuthContext({
      authData: authData,
      pkpPublicKey: pkpInfo.publicKey,
      authConfig: {
        // SIWE domain must match the message domain (e.g., "localhost" without port)
        domain,
        statement: 'Execute Lit Actions and sign transactions',
        expiration: getConsistentExpiration(),
        // Use wildcard for PKP signing (social PKPs vary per login) and allow all Lit Actions
        resources: [
          ['pkp-signing', '*'],
          ['lit-action-execution', '*'],
        ],
      },
      litClient: litClient,
    })

    // Cache for this session
    cachedAuthContext = authContext
    cachedPKPPublicKey = pkpInfo.publicKey
    cachedDomain = domain

    if (IS_DEV) console.log('[Lit] ✓ PKP auth context created')

    return authContext
  } catch (error) {
    console.error('[Lit] Failed to create PKP auth context:', error)
    throw new Error(`Failed to create PKP auth context: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get cached auth context
 */
export function getCachedAuthContext(pkpPublicKey: string): PKPAuthContext | null {
  if (cachedAuthContext && cachedPKPPublicKey === pkpPublicKey) {
    return cachedAuthContext
  }
  return null
}

/**
 * Clear cached auth context
 */
export function clearAuthContext(): void {
  if (IS_DEV) console.log('[Lit] Clearing cached auth context')
  cachedAuthContext = null
  cachedPKPPublicKey = null
  cachedDomain = null
}

// =============================================================================
// PKP Wallet Client (viem)
// =============================================================================

/**
 * Create PKP-backed LocalAccount for viem
 */
function createPKPAccount(
  pkpInfo: PKPInfo,
  authContext: PKPAuthContext
): LocalAccount {
  const address = pkpInfo.ethAddress

  return {
    address,
    publicKey: pkpInfo.publicKey as Hex,
    type: 'local',
    source: 'custom',

    // Sign message using PKP via Lit Protocol
    async signMessage({ message }) {
      if (IS_DEV) console.log('[PKP] Signing message')

      const litClient = await getLitClient()

      const litActionCode = `(async () => {
        const sigShare = await Lit.Actions.ethPersonalSignMessageEcdsa({
          message: jsParams.message,
          publicKey: jsParams.publicKey,
          sigName: "sig",
        });
      })();`

      try {
        const result = await litClient.executeJs({
          code: litActionCode,
          authContext: authContext,
          jsParams: {
            message: typeof message === 'string' ? message : message.raw,
            publicKey: pkpInfo.publicKey,
          },
        })

        // Extract signature
        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig

          if (sig.signature && sig.recoveryId !== undefined) {
            const v = (sig.recoveryId + 27).toString(16).padStart(2, '0')
            const signature = `${sig.signature}${v}` as Hex

            if (IS_DEV) console.log('[PKP] ✓ Message signed')

            return signature
          }
        }

        throw new Error('No signature returned from Lit Action')
      } catch (error) {
        console.error('[PKP] Message signing failed:', error)
        throw error
      }
    },

    // Sign transaction using PKP
    async signTransaction(transaction: TransactionSerializable) {
      if (IS_DEV) console.log('[PKP] Signing transaction')

      const litClient = await getLitClient()

      // Serialize transaction for signing
      const { serializeTransaction, keccak256 } = await import('viem')
      const serializedTx = serializeTransaction(transaction)
      const txHash = keccak256(serializedTx)

      const litActionCode = `(async () => {
        const sigShare = await Lit.Actions.signEcdsa({
          toSign: jsParams.toSign,
          publicKey: jsParams.publicKey,
          sigName: "sig",
        });
      })();`

      try {
        const result = await litClient.executeJs({
          code: litActionCode,
          authContext: authContext,
          jsParams: {
            toSign: Array.from(Buffer.from(txHash.slice(2), 'hex')),
            publicKey: pkpInfo.publicKey,
          },
        })

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig

          if (sig.signature && sig.recoveryId !== undefined) {
            const sigHex = sig.signature.startsWith('0x') ? sig.signature.slice(2) : sig.signature
            const r = `0x${sigHex.slice(0, 64)}` as Hex
            const s = `0x${sigHex.slice(64, 128)}` as Hex

            const isEIP1559 = transaction.type === 'eip1559'
            const yParity = sig.recoveryId
            const v = isEIP1559 ? BigInt(yParity) : BigInt(yParity + 27)

            const { serializeTransaction } = await import('viem')
            const signedTx: TransactionSerializable = {
              ...transaction,
              r,
              s,
              ...(isEIP1559 ? { yParity } : { v }),
            }
            return serializeTransaction(signedTx)
          }
        }

        throw new Error('No signature returned from Lit Action')
      } catch (error) {
        console.error('[PKP] Transaction signing failed:', error)
        throw error
      }
    },

    // @ts-expect-error - viem TypedData type mismatch
    // Sign typed data (EIP-712)
    async signTypedData(typedData: TypedDataDefinition) {
      if (IS_DEV) console.log('[PKP] Signing typed data')

      const litClient = await getLitClient()

      const { hashTypedData } = await import('viem')
      const hash = hashTypedData(typedData)

      const litActionCode = `(async () => {
        const sigShare = await Lit.Actions.signEcdsa({
          toSign: jsParams.toSign,
          publicKey: jsParams.publicKey,
          sigName: "sig",
        });
      })();`

      try {
        const result = await litClient.executeJs({
          code: litActionCode,
          authContext: authContext,
          jsParams: {
            toSign: Array.from(Buffer.from(hash.slice(2), 'hex')),
            publicKey: pkpInfo.publicKey,
          },
        })

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig

          if (sig.signature && sig.recoveryId !== undefined) {
            const v = (sig.recoveryId + 27).toString(16).padStart(2, '0')
            return `${sig.signature}${v}` as Hex
          }
        }

        throw new Error('No signature returned from Lit Action')
      } catch (error) {
        console.error('[PKP] Typed data signing failed:', error)
        throw error
      }
    },
  }
}

/**
 * Create viem WalletClient backed by PKP
 */
export async function createPKPWalletClient(
  pkpInfo: PKPInfo,
  authContext: PKPAuthContext,
  chain: Chain = baseSepolia
): Promise<WalletClient> {
  if (IS_DEV) {
    console.log('[PKP] Creating PKP wallet client:', {
      address: pkpInfo.ethAddress,
      chain: chain.name,
    })
  }

  // Create PKP account
  const account = createPKPAccount(pkpInfo, authContext)

  // Create wallet client with PKP account
  const walletClient = createWalletClient({
    account,
    chain,
    transport: custom({
      async request({ method, params }) {
        // Handle eth_requestAccounts
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return [pkpInfo.ethAddress]
        }

        // Handle eth_chainId
        if (method === 'eth_chainId') {
          return `0x${chain.id.toString(16)}`
        }

        // For other methods, use default RPC
        const { createPublicClient, http } = await import('viem')
        const publicClient = createPublicClient({
          chain,
          transport: http(),
        })

        return await publicClient.request({ method, params })
      },
    }),
  })

  if (IS_DEV) console.log('[PKP] ✓ PKP wallet client created')

  return walletClient
}

/**
 * Get PKP address from wallet client
 */
export function getPKPAddress(walletClient: WalletClient): Address {
  if (!walletClient.account?.address) {
    throw new Error('No account address in wallet client')
  }
  return walletClient.account.address
}
