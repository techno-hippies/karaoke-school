/**
 * Lens Protocol Configuration
 * Provides social identity layer
 */

import { PublicClient, testnet, mainnet } from '@lens-protocol/client'
import type { EvmAddress } from '@lens-protocol/client'

// Lens environment
const LENS_ENV = import.meta.env.VITE_LENS_ENVIRONMENT === 'mainnet' ? mainnet : testnet

// Lens App address (test app on testnet by default)
export const LENS_APP_ADDRESS: EvmAddress = (import.meta.env.VITE_LENS_APP_ADDRESS || 
  '0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7') as EvmAddress

/**
 * Lens Public Client (unauthenticated)
 * Used for initial login
 */
export const lensClient = PublicClient.create({
  environment: LENS_ENV,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

/**
 * Check if Lens is configured
 */
export function isLensConfigured(): boolean {
  return !!LENS_APP_ADDRESS
}
