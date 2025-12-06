/**
 * Lens Protocol Client
 * Framework-agnostic client using @lens-protocol/client directly
 */

import { PublicClient, testnet, mainnet } from '@lens-protocol/client'

export type LensClient = ReturnType<typeof PublicClient.create>

export { LENS_APP_ADDRESS, LENS_GRAPH_ADDRESS } from './config'

// Lens environment (default to testnet)
const LENS_ENV = import.meta.env.VITE_LENS_ENVIRONMENT === 'mainnet' ? mainnet : testnet

console.log('[lens/client] Creating PublicClient with env:', LENS_ENV)

export const lensClient: LensClient = PublicClient.create({
  environment: LENS_ENV,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

console.log('[lens/client] Created lensClient:', lensClient)
