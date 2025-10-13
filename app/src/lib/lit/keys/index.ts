/**
 * Encrypted API Keys for Lit Actions
 *
 * These keys are encrypted by Lit Protocol and can only be decrypted
 * by users who meet the access control conditions.
 *
 * Security (CID-Based Access Control):
 * - Keys are encrypted at rest
 * - Access is bound to specific Lit Action IPFS CIDs (immutable)
 * - Keys cannot be decrypted outside the Lit Action environment
 * - Each key version is bound to a specific Lit Action version
 */

// Export types
export type { EncryptedKey } from './types'

// Export active keys
export {
  GENIUS_API_KEY,
  OPENROUTER_API_KEY,
  ELEVENLABS_API_KEY,
} from './active'

// Import for getters
import {
  GENIUS_API_KEY,
  OPENROUTER_API_KEY,
  ELEVENLABS_API_KEY,
} from './active'

/**
 * Get encrypted key parameters for Genius API
 */
export function getGeniusKeyParams() {
  return {
    geniusKeyAccessControlConditions: GENIUS_API_KEY.accessControlConditions,
    geniusKeyCiphertext: GENIUS_API_KEY.ciphertext,
    geniusKeyDataToEncryptHash: GENIUS_API_KEY.dataToEncryptHash,
  }
}

/**
 * Get encrypted key parameters for OpenRouter API
 */
export function getOpenRouterKeyParams() {
  return {
    openrouterKeyAccessControlConditions: OPENROUTER_API_KEY.accessControlConditions,
    openrouterKeyCiphertext: OPENROUTER_API_KEY.ciphertext,
    openrouterKeyDataToEncryptHash: OPENROUTER_API_KEY.dataToEncryptHash,
  }
}

/**
 * Get encrypted key parameters for ElevenLabs API
 */
export function getElevenlabsKeyParams() {
  return {
    elevenlabsKeyAccessControlConditions: ELEVENLABS_API_KEY.accessControlConditions,
    elevenlabsKeyCiphertext: ELEVENLABS_API_KEY.ciphertext,
    elevenlabsKeyDataToEncryptHash: ELEVENLABS_API_KEY.dataToEncryptHash,
  }
}

/**
 * Get all encrypted key parameters for karaoke Lit Actions
 */
export function getKaraokeKeyParams() {
  return {
    ...getGeniusKeyParams(),
    ...getOpenRouterKeyParams(),
    ...getElevenlabsKeyParams(),
  }
}
