/**
 * Lens Protocol Client
 * Social identity layer - uses React client for compatibility with hooks
 */

import { PublicClient, testnet, mainnet } from '@lens-protocol/react'
import './fragments'

export { LENS_APP_ADDRESS, isLensConfigured } from './config'

// Lens environment (default to testnet)
const LENS_ENV = import.meta.env.VITE_LENS_ENVIRONMENT === 'mainnet' ? mainnet : testnet

/**
 * Lens Public Client (unauthenticated)
 * Used for initial login and React hooks
 */
console.log('[lens/client] Creating PublicClient with env:', LENS_ENV)
console.log('[lens/client] PublicClient:', PublicClient)

export const lensClient = PublicClient.create({
  environment: LENS_ENV,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

console.log('[lens/client] Created lensClient:', lensClient)
