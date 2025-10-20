/**
 * Lit Protocol Client Initialization
 * Singleton instances for Lit client and auth manager
 */

import { createLitClient } from '@lit-protocol/lit-client'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { LIT_WEBAUTHN_CONFIG } from './config'

const IS_DEV = import.meta.env.DEV

/**
 * Singleton Lit Client
 */
let litClientInstance: Awaited<ReturnType<typeof createLitClient>> | null = null

export async function getLitClient() {
  if (!litClientInstance) {
    if (IS_DEV) console.log('[LitWebAuthn] Creating Lit client...')

    litClientInstance = await createLitClient({
      network: LIT_WEBAUTHN_CONFIG.network,
    })

    if (IS_DEV) console.log('[LitWebAuthn] Lit client created')
  }

  return litClientInstance
}

/**
 * Singleton Auth Manager
 * Uses localStorage for persistence
 */
let authManagerInstance: ReturnType<typeof createAuthManager> | null = null

export function getAuthManager() {
  if (!authManagerInstance) {
    if (IS_DEV) console.log('[LitWebAuthn] Creating auth manager...')

    authManagerInstance = createAuthManager({
      storage: storagePlugins.localStorage({
        appName: 'karaoke-school',
        networkName: LIT_WEBAUTHN_CONFIG.networkName,
      }),
    })

    if (IS_DEV) console.log('[LitWebAuthn] Auth manager created')
  }

  return authManagerInstance
}

/**
 * Reset clients (for testing or logout)
 */
export function resetClients() {
  if (IS_DEV) console.log('[LitWebAuthn] Resetting clients...')

  litClientInstance = null
  authManagerInstance = null
}
