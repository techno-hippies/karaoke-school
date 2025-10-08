/**
 * Lit Protocol Client Setup
 * Initialize Lit Client and Auth Manager
 */

import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev } from '@lit-protocol/networks'
import { LIT_CONFIG } from './config'

/**
 * Lit Auth Manager
 * Handles session key pairs and delegation
 */
export const litAuthManager = createAuthManager({
  storage: storagePlugins.localStorage({
    appName: 'karaoke-school',
    networkName: LIT_CONFIG.network,
  }),
})

/**
 * Lit Client
 * Used to execute Lit Actions
 */
let litClientInstance: Awaited<ReturnType<typeof createLitClient>> | null = null

export async function getLitClient() {
  if (!litClientInstance) {
    litClientInstance = await createLitClient({ 
      network: LIT_CONFIG.network === 'naga-dev' ? nagaDev : nagaDev, // TODO: add mainnet when ready
    })
  }
  return litClientInstance
}

/**
 * Initialize Lit session
 * Creates session key pair and gets PKP delegation
 */
export async function initializeLitSession() {
  const client = await getLitClient()
  
  // Create auth context (session key + delegation)
  const authContext = await litAuthManager.createAuthContext({
    pkpPublicKey: LIT_CONFIG.pkpPublicKey,
  })
  
  return {
    client,
    authContext,
  }
}
