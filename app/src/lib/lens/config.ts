/**
 * Lens Protocol Configuration
 * Provides social identity layer
 *
 * Note: This file contains constants only. The lensClient is in client.ts
 * to maintain compatibility with React hooks.
 */

import type { EvmAddress } from '@lens-protocol/client'

// Lens App address (must match backend for sponsorship)
export const LENS_APP_ADDRESS: EvmAddress = (import.meta.env.VITE_LENS_APP_ADDRESS ||
  '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0') as EvmAddress

// Custom Namespace (kschool2/*) - now enabled with PKP-signed gasless transactions
export const LENS_CUSTOM_NAMESPACE: EvmAddress = (import.meta.env.VITE_LENS_CUSTOM_NAMESPACE ||
  '0xa304467aD0C296C2bb11079Bc2748223568D463e') as EvmAddress

/**
 * Check if Lens is configured
 */
export function isLensConfigured(): boolean {
  return !!LENS_APP_ADDRESS
}
