/**
 * Lens Protocol Configuration
 * Provides social identity layer
 *
 * Note: This file contains constants only. The lensClient is in client.ts
 * to maintain compatibility with React hooks.
 */

import type { EvmAddress } from '@lens-protocol/client'

// Lens App address (test app on testnet by default)
export const LENS_APP_ADDRESS: EvmAddress = (import.meta.env.VITE_LENS_APP_ADDRESS ||
  '0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7') as EvmAddress

// Lens Custom Namespace (kschool1/*)
export const LENS_CUSTOM_NAMESPACE: EvmAddress = (import.meta.env.VITE_LENS_CUSTOM_NAMESPACE ||
  '0xA5882f62feDC936276ef2e7166723A04Ee12501B') as EvmAddress

/**
 * Check if Lens is configured
 */
export function isLensConfigured(): boolean {
  return !!LENS_APP_ADDRESS
}
