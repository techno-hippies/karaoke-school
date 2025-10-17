/**
 * Lit Action CID Management - SINGLE SOURCE OF TRUTH
 *
 * IMPORTANT: All Lit Action CIDs MUST be imported from this file.
 * DO NOT use `import.meta.env.VITE_LIT_ACTION_*` directly in code.
 *
 * Why centralized?
 * - Single source of truth prevents missing CIDs
 * - Version controlled - no more lost .env.local files
 * - Type-safe access via TypeScript
 * - Easy to audit and update
 * - Deployment history is tracked in git
 *
 * What are Lit Actions?
 * - JavaScript functions that run on Lit Protocol's decentralized network
 * - Uploaded to IPFS, referenced by immutable content ID (CID)
 * - Once deployed, the CID never changes (immutable)
 * - Each deployment creates a NEW CID (new version)
 *
 * Deployment:
 * 1. Deploy via: ./lit-actions/scripts/deploy-lit-action.sh <file> <name> <env-var>
 * 2. Script uploads to IPFS and returns CID
 * 3. **Manually** update the CID in this file (don't rely on .env.local)
 * 4. Commit this file to git
 *
 * Environment Variable Overrides:
 * - If VITE_LIT_ACTION_* is set in .env.local, it overrides the default
 * - Useful for local development/testing with unreleased versions
 * - Production always uses the defaults from this file
 */

export interface LitActionConfig {
  /** IPFS Content ID (Qm...) */
  cid: string
  /** Human-readable name */
  name: string
  /** Source file path (for reference) */
  source: string
  /** Deployment date (for tracking) */
  deployedAt?: string
}

/**
 * Production Lit Action CIDs
 * These are the stable, tested versions used in production
 */
const LIT_ACTIONS_PRODUCTION: Record<string, LitActionConfig> = {
  // === Genius API Integration ===
  search: {
    cid: 'QmQ721ZFN4zwTkQ4DXXCzTdWzWF5dBQTRbjs2LMdjnN4Fj',
    name: 'Search v1',
    source: 'lit-actions/src/genius/search.js',
    deployedAt: '2025-10-03',
  },
  song: {
    cid: 'QmZWwmrMBfXpwug9k4UL3AU6q6yFxCZ5z3YBMpJaW2fQn2',
    name: 'Song Metadata v1',
    source: 'lit-actions/src/genius/song.js',
    deployedAt: '2025-10-17',
  },
  artist: {
    cid: 'QmXgS2pLhSavsNBGa81atWqn3UHGciTDhasdQxsAx9f4bJ',
    name: 'Artist Metadata v1',
    source: 'lit-actions/src/genius/artist.js',
    deployedAt: '2025-10-15',
  },

  // === Karaoke Pipeline ===
  matchSegment: {
    cid: 'QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN',
    name: 'Match and Segment v9 (SC Fallback)',
    source: 'lit-actions/src/karaoke/match-and-segment-v9.js',
    deployedAt: '2025-10-17',
  },
  baseAlignment: {
    cid: 'QmVjCaNCS45BECxgbjHExDn7VikFLpeZXjXDEF4Nta691e',
    name: 'Base Alignment v2',
    source: 'lit-actions/src/karaoke/base-alignment-v2.js',
    deployedAt: '2025-10-14',
  },
  audioProcessor: {
    cid: 'QmYxNkawEVCT2LGvXEyPVi2gzMgjEpidWpUXWhbDPvuUUd',
    name: 'Audio Processor v4',
    source: 'lit-actions/src/karaoke/audio-processor-v4.js',
    deployedAt: '2025-10-12',
  },
  translate: {
    cid: 'QmR3VoCJGWHyus1BCSaKH8duP8ptuKehuvYuvAk8m4Vyop',
    name: 'Translate Lyrics v1',
    source: 'lit-actions/src/karaoke/translate-lyrics-v1.js',
    deployedAt: '2025-10-15',
  },

  // === Video Decryption (HLS) ===
  decryptKey: {
    cid: 'QmYqbhft19CRLmn9W1zBVkuujfiaPni24gJNXjZduNf4ws',
    name: 'Decrypt Symmetric Key v1',
    source: 'lit-actions/src/decrypt/decrypt-symmetric-key-v1.js',
    deployedAt: '2025-10-16',
  },
}

/**
 * Get Lit Action CID with optional environment variable override
 *
 * Priority:
 * 1. Environment variable (VITE_LIT_ACTION_*)
 * 2. Production default from this config
 * 3. Error if neither exists
 */
function getLitActionCID(
  key: keyof typeof LIT_ACTIONS_PRODUCTION,
  envVarName: string
): string {
  // Check for env var override (for local development)
  const envOverride = import.meta.env[envVarName]
  if (envOverride && typeof envOverride === 'string') {
    console.log(`[LitActions] Using env override for ${key}: ${envOverride}`)
    return envOverride
  }

  // Use production default
  const config = LIT_ACTIONS_PRODUCTION[key]
  if (!config) {
    throw new Error(`Lit Action '${String(key)}' not found in config`)
  }

  if (config.cid.includes('PLACEHOLDER')) {
    throw new Error(
      `Lit Action '${String(key)}' not deployed yet! Deploy it first:\n` +
      `  cd lit-actions && ./scripts/deploy-lit-action.sh ${config.source} "${config.name}" ${envVarName}`
    )
  }

  return config.cid
}

/**
 * Lit Action CIDs for use in application code
 * Use these exported constants instead of env vars directly
 */
export const LIT_ACTIONS = {
  // Genius API
  search: getLitActionCID('search', 'VITE_LIT_ACTION_SEARCH'),
  song: getLitActionCID('song', 'VITE_LIT_ACTION_SONG'),
  artist: getLitActionCID('artist', 'VITE_LIT_ACTION_ARTIST'),

  // Karaoke Pipeline
  matchSegment: getLitActionCID('matchSegment', 'VITE_LIT_ACTION_MATCH_SEGMENT'),
  matchAndSegment: getLitActionCID('matchSegment', 'VITE_LIT_ACTION_MATCH_AND_SEGMENT'), // Alias
  baseAlignment: getLitActionCID('baseAlignment', 'VITE_LIT_ACTION_BASE_ALIGNMENT'),
  audioProcessor: getLitActionCID('audioProcessor', 'VITE_LIT_ACTION_AUDIO_PROCESSOR'),
  translate: getLitActionCID('translate', 'VITE_LIT_ACTION_TRANSLATE'),

  // Video Decryption
  decryptKey: getLitActionCID('decryptKey', 'VITE_LIT_ACTION_DECRYPT_KEY'),
} as const

/**
 * Get full config for a Lit Action (for debugging/logging)
 */
export function getLitActionConfig(key: keyof typeof LIT_ACTIONS_PRODUCTION): LitActionConfig {
  const config = LIT_ACTIONS_PRODUCTION[key]
  if (!config) {
    throw new Error(`Lit Action '${String(key)}' not found in config`)
  }
  return config
}

/**
 * List all available Lit Actions
 */
export function listLitActions(): Array<LitActionConfig & { key: string }> {
  return Object.entries(LIT_ACTIONS_PRODUCTION).map(([key, config]) => ({
    key,
    ...config,
  }))
}
