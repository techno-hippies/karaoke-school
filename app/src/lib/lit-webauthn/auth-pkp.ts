/**
 * PKP Auth Context Management
 * Creates and manages authentication contexts for PKP
 * This enables 0-signature Lit Action execution
 */

import { getLitClient, getAuthManager } from './client'
import { LIT_WEBAUTHN_CONFIG } from './config'
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers'
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

    // Create PKP auth context - matches working example format
    const authContext = await authManager.createPkpAuthContext({
      authData: authData,
      pkpPublicKey: pkpInfo.publicKey,
      authConfig: {
        expiration: getConsistentExpiration(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          },
          {
            resource: new LitPKPResource('*'),
            ability: 'pkp-signing'
          },
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
