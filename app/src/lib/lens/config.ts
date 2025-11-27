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
  '0x5856057743d66951e43361ac3E1e67C6474Ea7B6') as EvmAddress

// Lens Graph address (for feed/timeline queries)
export const LENS_GRAPH_ADDRESS: EvmAddress = (import.meta.env.VITE_LENS_GRAPH_ADDRESS ||
  '0x73b0588EE59f299D66E368ea6A1a400D41d33E02') as EvmAddress

// Custom Namespace - now enabled with PKP-signed gasless transactions
export const LENS_CUSTOM_NAMESPACE: EvmAddress = (import.meta.env.VITE_LENS_CUSTOM_NAMESPACE ||
  '0x6Cf6bC01D51aF736Cd34bC3a682B7b081eA77B07') as EvmAddress

/**
 * Check if Lens is configured
 */
export function isLensConfigured(): boolean {
  return !!LENS_APP_ADDRESS
}
