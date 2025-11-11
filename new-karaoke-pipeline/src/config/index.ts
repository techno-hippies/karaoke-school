/**
 * Centralized Configuration
 *
 * Single source of truth for all pipeline configuration values.
 * Replaces scattered magic numbers and hardcoded values across the codebase.
 *
 * Benefits:
 * - Easy to update: Change values in one place
 * - Type-safe: TypeScript ensures correct usage
 * - Documented: Clear descriptions for each setting
 * - Environment-aware: Override via environment variables
 */

/**
 * Translation configuration
 */
export const TRANSLATION_CONFIG = {
  /** Default target languages for lyrics translation */
  defaultLanguages: ['zh', 'vi', 'id'] as const,

  /** OpenRouter model for translation */
  model: 'google/gemini-flash-2.5-lite' as const,

  /** Maximum retries for translation API calls */
  maxRetries: 3,

  /** Rate limit delay between translations (ms) */
  rateLimitMs: 1000,
} as const;

/**
 * Lens Protocol configuration
 */
export const LENS_CONFIG = {
  /** Lens app address (required for account creation) */
  appAddress: '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0' as const,

  /** Custom feed address for TikTok karaoke content */
  feedAddress: '0x5941b291E69069769B8e309746b301928C816fFa' as const,

  /** Handle suffix for Karaoke School accounts */
  handleSuffix: '-ks1' as const,

  /** Maximum handle length (Lens Protocol limit) */
  maxHandleLength: 30,

  /** Maximum collision retry attempts when finding available handle */
  maxCollisionRetries: 10,
} as const;

/**
 * Unlock Protocol configuration
 */
export const UNLOCK_CONFIG = {
  /** Lock price in ETH per month */
  priceEthPerMonth: 0.0006,

  /** Lock duration in days */
  durationDays: 30,

  /** Base Sepolia chain ID */
  chainId: 84532,

  /** Master EOA beneficiary address */
  beneficiary: process.env.MASTER_EOA_ADDRESS || '0x9456aec64179FE39a1d0a681de7613d5955E75D3',
} as const;

/**
 * Audio processing configuration
 */
export const AUDIO_CONFIG = {
  /** fal.ai Stable Audio 2.5 API */
  fal: {
    apiUrl: 'https://queue.fal.run/fal-ai/stable-audio-2-5' as const,
    timeout: 300000, // 5 minutes
    maxRetries: 3,
  },

  /** Demucs separation (RunPod serverless) */
  demucs: {
    timeout: 300000, // 5 minutes
    maxRetries: 2,
  },

  /** ElevenLabs forced alignment */
  elevenlabs: {
    timeout: 60000, // 1 minute
    maxRetries: 3,
    rateLimitMs: 2000, // 2 seconds between calls
  },

  /** FFmpeg processing */
  ffmpeg: {
    timeout: 120000, // 2 minutes
  },

  /** Segment selection */
  segment: {
    maxDurationMs: 190000, // 3min 10s (190 seconds)
    minDurationMs: 30000, // 30 seconds
  },
} as const;

/**
 * Retry and backoff configuration
 */
export const RETRY_CONFIG = {
  /** Maximum retry attempts for failed tasks */
  maxAttempts: 3,

  /** Exponential backoff delays (ms) */
  backoffMs: [
    5 * 60 * 1000,   // 5 minutes
    15 * 60 * 1000,  // 15 minutes
    30 * 60 * 1000,  // 30 minutes
  ],

  /** Rate limit delays for external APIs (ms) */
  rateLimits: {
    musicbrainz: 1100, // 1 request/second (conservative)
    genius: 500,       // 2 requests/second
    spotify: 100,      // 10 requests/second
    quansic: 200,      // 5 requests/second
    wikidata: 100,     // 10 requests/second
  },
} as const;

/**
 * GRC-20 / Grove configuration
 */
export const GRC20_CONFIG = {
  /** Grove blockchain space ID */
  spaceId: process.env.GROVE_SPACE_ID || '0x96ee1cC8AA2ec37Cf1dBCD99d2ABCfA1D1a21D7c',

  /** Entity types */
  types: {
    artist: 'artist',
    work: 'work',
    recording: 'recording',
  } as const,

  /** Batch size for minting operations */
  batchSize: 10,
} as const;

/**
 * Pipeline limits (default values for CLI --limit flags)
 */
export const PIPELINE_LIMITS = {
  /** Default batch size for tasks */
  defaultBatchSize: 10,

  /** Maximum tracks to process in single run */
  maxBatchSize: 100,

  /** Enrichment tasks batch size */
  enrichmentBatchSize: 25,

  /** Identity tasks batch size (slower, more expensive) */
  identityBatchSize: 5,
} as const;

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  /** Grove IPFS gateway */
  groveGateway: 'https://api.grove.storage' as const,

  /** load.network immutable storage */
  loadNetwork: 'https://arweave.net' as const,
} as const;

/**
 * Cartesia STT configuration (for TikTok video transcription)
 */
export const CARTESIA_CONFIG = {
  /** API base URL */
  baseUrl: 'https://api.cartesia.ai/stt' as const,

  /** Model to use */
  model: 'ink-whisper' as const,

  /** API version */
  version: '2025-04-16' as const,

  /** Request word-level timestamps */
  timestampGranularity: 'word' as const,
} as const;

/**
 * Complete configuration object
 * Use this for importing everything at once
 */
export const CONFIG = {
  translation: TRANSLATION_CONFIG,
  lens: LENS_CONFIG,
  unlock: UNLOCK_CONFIG,
  audio: AUDIO_CONFIG,
  retry: RETRY_CONFIG,
  grc20: GRC20_CONFIG,
  limits: PIPELINE_LIMITS,
  storage: STORAGE_CONFIG,
  cartesia: CARTESIA_CONFIG,
} as const;

/**
 * Type-safe config access
 * Example: const languages = CONFIG.translation.defaultLanguages;
 */
export default CONFIG;
