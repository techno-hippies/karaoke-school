/**
 * Smart contract addresses on Lens Testnet (Chain ID: 37111)
 *
 * All contracts are event-only (no storage) and deploy to Lens via ZKSync
 */

// ============ Lit Action Keys (copied from lit-actions/keys/dev/) ============
// Note: These files are synced from lit-actions/keys/dev/ for Fleek/IPFS builds

import litCids from './keys/dev.json'
import exerciseVoxtralKey from './keys/exercise/voxtral_api_key_exercise.json'
import karaokeLineVoxtralKey from './keys/karaoke-line/voxtral_api_key_karaoke-line.json'
import chatVeniceKey from './keys/chat/venice_api_key_chat.json'
import chatDeepinfraKey from './keys/chat/deepinfra_api_key_chat.json'
import ttsDeepinfraKey from './keys/tts/deepinfra_api_key_tts.json'

// ============ Network Configuration ============

export const LENS_TESTNET_CHAIN_ID = 37111
export const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz'

// ============ Exercise Grading ============

/**
 * ExerciseEvents.sol
 * Emits SayItBackAttemptGraded / MultipleChoiceAttemptGraded events for FSRS
 *
 * Deployed: 2025-11-05 to Lens Testnet (Chain ID: 37111)
 */
export const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832'

/**
 * Trusted PKP address (Lit Protocol)
 * Only this address can call ExerciseEvents grading functions
 */
export const EXERCISE_EVENTS_PKP_ADDRESS = '0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379'
export const EXERCISE_EVENTS_PKP_PUBLIC_KEY =
  '0x047037fa3f1ba0290880f20afb8a88a8af8a125804a9a3f593ff2a63bf7addd3e2d341e8e3d5a0ef02790ab7e92447e59adeef9915ce5d2c0ee90e0e9ed1b0c5f7'

// ============ KaraokeEvents (clip lifecycle + grading) ============

/**
 * KaraokeEvents.sol - Handles clip registration, processing, encryption, and grading
 * Events: ClipRegistered, ClipProcessed, SongEncrypted, ClipToggled,
 *         KaraokePerformanceGraded, KaraokeSessionStarted, KaraokeLineGraded, KaraokeSessionEnded
 */
export const KARAOKE_EVENTS_ADDRESS = '0x51aA6987130AA7E4654218859E075D8e790f4409'

// ============ Other Event Contracts ============

export const TRANSLATION_EVENTS_ADDRESS = '0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6'
export const ACCOUNT_EVENTS_ADDRESS = '0x3709f41cdc9E7852140bc23A21adCe600434d4E8'

// ============ Lit Action CIDs (from lit-actions/cids/dev.json) ============

/** Exercise Grader v1 - Say It Back + Multiple Choice */
export const LIT_ACTION_IPFS_CID = litCids.exercise

/** Karaoke Line Grader v1 - Line-by-line grading */
export const LIT_KARAOKE_LINE_CID = litCids['karaoke-line'] || import.meta.env.VITE_KARAOKE_LINE_CID || ''

// ============ Encrypted API Keys (from lit-actions/keys/dev/) ============
// These are imported directly - any change to the JSON files is picked up by Vite

/** Encrypted Voxtral key for Exercise Grader */
export const LIT_ACTION_VOXTRAL_KEY = exerciseVoxtralKey

/** Encrypted Voxtral key for Karaoke Line Grader */
export const LIT_KARAOKE_LINE_VOXTRAL_KEY = karaokeLineVoxtralKey

/** Chat Action CID (Scarlett/Violet) */
export const LIT_CHAT_ACTION_CID = chatVeniceKey.cid || 'QmXQET5YfM7wsmY86edaWzn8ddzd1wUUyVBsdTb9iphDTa'

/** Encrypted Venice key for Chat Action */
export const LIT_CHAT_VENICE_KEY = chatVeniceKey

/** Encrypted DeepInfra key for Chat STT/TTS */
export const LIT_CHAT_DEEPINFRA_KEY = chatDeepinfraKey

/** TTS Action CID (on-demand text-to-speech) */
export const LIT_TTS_ACTION_CID = ttsDeepinfraKey.cid || litCids.tts

/** Encrypted DeepInfra key for TTS Action */
export const LIT_TTS_DEEPINFRA_KEY = ttsDeepinfraKey

// ============ Artist Subscription Locks (Unlock Protocol on Base Sepolia) ============

/**
 * Maps artist slugs to their Unlock Protocol lock addresses
 * Used to check subscription status for all songs from an artist
 *
 * Chain: Base Sepolia (84532)
 */
export const ARTIST_SUBSCRIPTION_LOCKS: Record<string, { lockAddress: `0x${string}`, chainId: number }> = {
  'britney-spears': {
    lockAddress: '0x8a66d2528a0271520e870bb0e98764514046574b',
    chainId: 84532, // Base Sepolia
  },
  'eminem': {
    lockAddress: '0x72f304efb7b49f0caec531a662d08d281a385a91',
    chainId: 84532, // Base Sepolia
  },
  'queen': {
    lockAddress: '0xe9b80d4e10fa11fa1fe04afcf9ab954ecb7570c9',
    chainId: 84532, // Base Sepolia
  },
  'taylor-swift': {
    lockAddress: '0x175284ff891db054ec06f044eef6cc7ad3699dbe',
    chainId: 84532, // Base Sepolia
  },
}

// ============ Premium AI Lock (Unlock Protocol on Base Sepolia) ============

/**
 * Global subscription lock for Premium AI features:
 * - Better AI model (zai-org-glm-4.6 on Venice)
 * - Better TTS (ElevenLabs v3 expressive)
 *
 * Deploy with: bun src/scripts/infra/deploy-premium-ai-lock.ts
 * Price: 0.001 ETH / 30 days
 */
export const PREMIUM_AI_LOCK = {
  testnet: {
    lockAddress: '0xfec85fbc62ca614097b0952b2088442295b269af' as `0x${string}`,
    chainId: 84532, // Base Sepolia
  },
  mainnet: {
    lockAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Deploy when ready
    chainId: 8453, // Base
  },
}

// ============ Other Configuration ============

export const GROVE_UPLOAD_ENDPOINT = 'https://api.grove.storage'

export { SUBGRAPH_URL as SUBGRAPH_ENDPOINT } from '@/lib/graphql/client'
