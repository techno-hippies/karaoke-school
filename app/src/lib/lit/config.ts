/**
 * Lit Protocol Configuration
 * Provides serverless compute (Lit Actions)
 */

export const LIT_CONFIG = {
  network: (import.meta.env.VITE_LIT_NETWORK || 'naga-dev') as 'naga-dev' | 'mainnet',
  pkpPublicKey: import.meta.env.VITE_PKP_PUBLIC_KEY || '0x57b5274d6Bde0039891896c3CC5bE80ccb28df8A',
} as const

/**
 * Lit Action CIDs
 */
export const LIT_ACTIONS = {
  matchAndSegment: import.meta.env.VITE_LIT_ACTION_MATCH_AND_SEGMENT || '',
  audioProcessor: import.meta.env.VITE_LIT_ACTION_AUDIO_PROCESSOR || '',
} as const

/**
 * Check if Lit is configured
 */
export function isLitConfigured(): boolean {
  return !!(LIT_CONFIG.pkpPublicKey && LIT_ACTIONS.matchAndSegment && LIT_ACTIONS.audioProcessor)
}
