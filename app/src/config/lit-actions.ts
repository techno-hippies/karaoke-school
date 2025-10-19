/**
 * Lit Action CID Management - SINGLE SOURCE OF TRUTH
 *
 * IMPORTANT: All Lit Action CIDs are defined HERE and ONLY here.
 * DO NOT use environment variables or .env files for these CIDs.
 *
 * Why in config, not .env?
 * - IPFS CIDs are PUBLIC, not secrets
 * - Version controlled - deployment history tracked in git
 * - Single source of truth - no confusion between .env and config
 * - Type-safe access via TypeScript
 * - Easy to audit and update
 *
 * What are Lit Actions?
 * - JavaScript functions that run on Lit Protocol's decentralized network
 * - Uploaded to IPFS, referenced by immutable content ID (CID)
 * - Once deployed, the CID never changes (immutable)
 * - Each deployment creates a NEW CID (new version)
 *
 * Deployment:
 * 1. Deploy via: ./lit-actions/scripts/deploy-lit-action.sh <file> <name>
 * 2. Script uploads to IPFS and returns CID
 * 3. **Manually** update the CID in this file
 * 4. Commit this file to git
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

  // === Artist Profile Generation ===
  generateProfile: {
    cid: 'QmbZPDYwPxZFViXfq9rwsx5B1AwHpnCAmS1AEgmBd4HeFk',
    name: 'Generate Artist Profile v2',
    source: 'lit-actions/src/artist/generate-profile-v2.js',
    deployedAt: '2025-10-19',
  },

  // === Karaoke Pipeline ===
  matchSegment: {
    cid: 'QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G',
    name: 'Match and Segment v10 (geniusArtistId Support)',
    source: 'lit-actions/src/karaoke/match-and-segment-v10.js',
    deployedAt: '2025-10-19',
  },
  baseAlignment: {
    cid: 'QmX8wJ1EmcPpAb7GsX3sJQEeLMqqN4nT4GoL36b4Di19D8',
    name: 'Base Alignment v2',
    source: 'lit-actions/src/karaoke/base-alignment-v2.js',
    deployedAt: '2025-10-19',
  },
  audioProcessor: {
    cid: 'Qmd6mWibWmujJaiqLSAQL551cgkNTnqYtXX3f1aXZdTc7r',
    name: 'Audio Processor v4',
    source: 'lit-actions/src/karaoke/audio-processor-v4.js',
    deployedAt: '2025-10-19',
  },
  translate: {
    cid: 'QmQB9yYBjZVUpD85RxnSEWWXh7P1eC4fxoPbmpn9ToKvBV',
    name: 'Translate Lyrics v1',
    source: 'lit-actions/src/karaoke/translate-lyrics-v1.js',
    deployedAt: '2025-10-19',
  },

  // === Study & FSRS ===
  studyScorer: {
    cid: 'QmXe5H4WXrreaZKRrGRXoD7dVfMAXr4ahCUa137kZ6qX6i',
    name: 'Study Scorer v1',
    source: 'lit-actions/src/karaoke/study-scorer-v1.js',
    deployedAt: '2025-10-19',
  },
}

/**
 * Get Lit Action CID from config (NO env var overrides)
 *
 * These are public IPFS CIDs, not secrets, so they belong in version control.
 */
function getLitActionCID(key: keyof typeof LIT_ACTIONS_PRODUCTION): string {
  const config = LIT_ACTIONS_PRODUCTION[key]
  if (!config) {
    throw new Error(`Lit Action '${String(key)}' not found in config`)
  }

  if (config.cid.includes('PLACEHOLDER')) {
    throw new Error(
      `Lit Action '${String(key)}' not deployed yet! Deploy it first:\n` +
      `  cd lit-actions && ./scripts/deploy-lit-action.sh ${config.source} "${config.name}"`
    )
  }

  return config.cid
}

/**
 * Lit Action CIDs for use in application code
 * SINGLE SOURCE OF TRUTH - no env var overrides
 */
export const LIT_ACTIONS = {
  // Genius API
  search: getLitActionCID('search'),
  song: getLitActionCID('song'),
  artist: getLitActionCID('artist'),

  // Artist Profile Generation
  generateProfile: getLitActionCID('generateProfile'),

  // Karaoke Pipeline
  matchSegment: getLitActionCID('matchSegment'),
  matchAndSegment: getLitActionCID('matchSegment'), // Alias
  baseAlignment: getLitActionCID('baseAlignment'),
  audioProcessor: getLitActionCID('audioProcessor'),
  translate: getLitActionCID('translate'),

  // Study & FSRS
  studyScorer: getLitActionCID('studyScorer'),
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
