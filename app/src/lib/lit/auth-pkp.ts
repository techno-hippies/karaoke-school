/**
 * PKP Auth Context Management
 * Creates and manages authentication contexts for PKP
 * This enables 0-signature Lit Action execution
 */

import { getLitClient, getAuthManager } from './client'
// import { LIT_WEBAUTHN_CONFIG } from './config' // TODO: Use for configuration
import type { PKPInfo, AuthData, PKPAuthContext } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * In-memory cache for auth context
 * Cannot persist to localStorage due to callback functions
 */
let cachedAuthContext: PKPAuthContext | null = null
let cachedPKPPublicKey: string | null = null

/**
 * Calculate expiration time (24 hours from now)
 * Matches working example format exactly
 */
function getConsistentExpiration(): string {
  return new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
}

/**
 * Create PKP auth context
 * This is required for signing messages and executing Lit Actions with PKP
 *
 * Auth context enables:
 * - Zero-signature Lit Action execution
 * - PKP signing without user prompts
 * - Session-based authentication
 */
export async function createPKPAuthContext(
  pkpInfo: PKPInfo,
  authData: AuthData
): Promise<PKPAuthContext> {
  // Return cached context if available
  if (cachedAuthContext && cachedPKPPublicKey === pkpInfo.publicKey) {
    if (IS_DEV) console.log('[LitWebAuthn] Using cached PKP auth context')
    return cachedAuthContext
  }

  if (IS_DEV) console.log('[LitWebAuthn] Creating PKP auth context...')

  try {
    const litClient = await getLitClient()
    const authManager = getAuthManager()

    // Create PKP auth context - use tuple format (object format breaks PKP signing)
    const authContext = await authManager.createPkpAuthContext({
      authData: authData,
      pkpPublicKey: pkpInfo.publicKey,
      authConfig: {
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        statement: 'Execute Lit Actions and sign transactions',
        expiration: getConsistentExpiration(),
        resources: [
          ['lit-action-execution', '*'],
          ['pkp-signing', '*'],
        ],
      },
      litClient: litClient,
    })

    // Cache for this session
    cachedAuthContext = authContext
    cachedPKPPublicKey = pkpInfo.publicKey

    if (IS_DEV) console.log('[LitWebAuthn] PKP auth context created')

    return authContext
  } catch (error) {
    console.error('[LitWebAuthn] Failed to create PKP auth context:', error)
    throw new Error(`Failed to create PKP auth context: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get cached auth context
 * Returns null if not cached or PKP mismatch
 */
export function getCachedAuthContext(pkpPublicKey: string): PKPAuthContext | null {
  if (cachedAuthContext && cachedPKPPublicKey === pkpPublicKey) {
    return cachedAuthContext
  }
  return null
}

/**
 * Clear cached auth context
 * Call this on logout or when switching PKPs
 */
export function clearAuthContext(): void {
  if (IS_DEV) console.log('[LitWebAuthn] Clearing cached auth context')
  cachedAuthContext = null
  cachedPKPPublicKey = null
}

/**
 * Create PKP auth context for decrypting specific encrypted data
 * IMPORTANT: Each encrypted piece of data has a unique resource ID
 * Cannot use cached context - must create new context per resource
 */
export async function createPKPDecryptionAuthContext(
  pkpInfo: PKPInfo,
  authData: AuthData
): Promise<PKPAuthContext> {
  if (IS_DEV) console.log('[LitWebAuthn] Creating PKP decryption auth context')

  try {
    const litClient = await getLitClient()
    const authManager = getAuthManager()

    // Create auth context - use tuple format (object format breaks PKP signing)
    // In Lit Protocol v8, we don't need to pre-register specific resources for decryption
    const authContext = await authManager.createPkpAuthContext({
      authData: authData,
      pkpPublicKey: pkpInfo.publicKey,
      authConfig: {
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        statement: 'Execute Lit Actions, sign transactions, and decrypt content',
        expiration: getConsistentExpiration(),
        resources: [
          ['lit-action-execution', '*'],
          ['pkp-signing', '*'],
          ['access-control-condition-decryption', '*'],
        ],
      },
      litClient: litClient,
    })

    if (IS_DEV) console.log('[LitWebAuthn] Decryption auth context created')

    return authContext
  } catch (error) {
    console.error('[LitWebAuthn] Failed to create decryption auth context:', error)
    throw new Error(`Failed to create decryption auth context: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
