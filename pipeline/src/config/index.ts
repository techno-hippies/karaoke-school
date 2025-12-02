/**
 * Configuration
 *
 * Centralized environment variables and constants.
 */

// Database
export const DATABASE_URL = process.env.DATABASE_URL || '';

// Spotify
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

// Genius
export const GENIUS_API_KEY = process.env.GENIUS_API_KEY || '';

// ElevenLabs
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// RunPod (Demucs)
export const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
export const RUNPOD_DEMUCS_ENDPOINT_ID = process.env.RUNPOD_DEMUCS_ENDPOINT_ID || '';

// FAL
export const FAL_API_KEY = process.env.FAL_API_KEY || '';

// Grove
export const GROVE_API_KEY = process.env.GROVE_API_KEY || '';
export const GROVE_API_URL = 'https://api.grove.storage';

// Blockchain
export const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
export const LENS_RPC_URL = 'https://rpc.testnet.lens.xyz';
export const LENS_CHAIN_ID = 37111;

// Contracts (Lens Testnet)
// KaraokeEvents V3: Removed unlock params from SongEncrypted
export const CONTRACTS = {
  KaraokeEvents: '0x8f97C17e599bb823e42d936309706628A93B33B8',
  ExerciseEvents: '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832',
} as const;

// Lens (must match app/src/lib/lens/config.ts)
export const LENS_APP_ADDRESS = '0x5856057743d66951e43361ac3E1e67C6474Ea7B6';
// Custom namespace for Karaoke School accounts (kschool2)
// All accounts should use {handle}-ks naming convention
export const LENS_NAMESPACE_ADDRESS = '0x6Cf6bC01D51aF736Cd34bC3a682B7b081eA77B07';
export const LENS_NAMESPACE_NAME = 'kschool2';

// Lit Protocol
export const LIT_NETWORK = process.env.LIT_NETWORK || 'naga-dev';

// OpenRouter
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Defaults
export const DEFAULT_VIDEO_WIDTH = 1440;
export const DEFAULT_VIDEO_HEIGHT = 1440;
export const DEFAULT_SNIPPET_DURATION_MS = 10000; // 10 seconds

/**
 * Validate required environment variables
 */
export function validateEnv(required: string[]): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }
}
