/**
 * Lit Protocol Configuration
 * Provides serverless compute (Lit Actions)
 *
 * DEPRECATED: Use @/config/lit-actions for Lit Action CIDs
 * This file is kept for backwards compatibility only
 */

export const LIT_CONFIG = {
  network: (import.meta.env.VITE_LIT_NETWORK || 'naga-dev') as 'naga-dev' | 'mainnet',
  pkpPublicKey: import.meta.env.VITE_PKP_PUBLIC_KEY || '0x57b5274d6Bde0039891896c3CC5bE80ccb28df8A',
} as const

/**
 * Lit Action CIDs
 * DEPRECATED: Import from @/config/lit-actions instead
 */
export { LIT_ACTIONS } from '@/config/lit-actions'

/**
 * Check if Lit is configured
 */
export function isLitConfigured(): boolean {
  return !!LIT_CONFIG.pkpPublicKey
}
