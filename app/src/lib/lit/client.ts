/**
 * Lit Protocol Client Setup (v8)
 * Handles Lit client initialization and EOA-based authentication
 */

import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import type { WalletClient } from 'viem'
import { LIT_CONFIG } from './config'

const IS_DEV = import.meta.env.DEV

/**
 * Singleton Auth Manager with localStorage persistence
 */
export const litAuthManager = createAuthManager({
  storage: storagePlugins.localStorage({
    appName: 'karaoke-school',
    networkName: LIT_CONFIG.network,
  }),
})

/**
 * Singleton Lit Client instance
 */
let litClientInstance: Awaited<ReturnType<typeof createLitClient>> | null = null

export async function getLitClient() {
  if (!litClientInstance) {
    if (IS_DEV) console.log('[Lit] Creating client for:', LIT_CONFIG.network)
    litClientInstance = await createLitClient({
      network: LIT_CONFIG.network === 'naga-dev' ? nagaDev : nagaDev,
    })
  }
  return litClientInstance
}

/**
 * In-memory auth context cache
 * Note: Cannot persist to localStorage due to callback functions
 */
let cachedEoaAuthContext: any = null

export function getCachedEoaAuthContext() {
  return cachedEoaAuthContext
}

function setCachedEoaAuthContext(authContext: any) {
  cachedEoaAuthContext = authContext
}

/**
 * Calculate consistent expiration time (rounded to hour)
 * This ensures cache lookups work across page refreshes
 */
function getConsistentExpiration(): string {
  const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  expirationDate.setMinutes(0, 0, 0)
  return expirationDate.toISOString()
}

/**
 * Initialize Lit session with EOA wallet
 *
 * Flow:
 * 1. Check memory cache (0 signatures)
 * 2. SDK checks localStorage for session keys (0 signatures)
 * 3. Create new session if needed (2 signatures: SIWE + delegation)
 *
 * Note: EOA auth requires signatures on each page refresh for security.
 * For 0-signature experience, PKP or Custom auth is required.
 */
export async function initializeLitSessionWithWallet(walletClient: WalletClient) {
  const client = await getLitClient()
  const [address] = await walletClient.getAddresses()

  // Return cached context if available (same page session)
  if (cachedEoaAuthContext) {
    if (IS_DEV) console.log('[Lit] Using cached auth context')
    return { client, authContext: cachedEoaAuthContext, address }
  }

  if (IS_DEV) console.log('[Lit] Initializing session for:', address)

  // Create auth context - SDK will check localStorage for session keys
  const authContext = await litAuthManager.createEoaAuthContext({
    litClient: client,
    config: { account: walletClient },
    authConfig: {
      expiration: getConsistentExpiration(),
      resources: [['lit-action-execution', '*']],
    },
  })

  setCachedEoaAuthContext(authContext)
  if (IS_DEV) console.log('[Lit] Session initialized successfully')

  return { client, authContext, address }
}
