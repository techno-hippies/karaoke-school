/**
 * Smart contract addresses on Lens Testnet (Chain ID: 37111)
 *
 * All contracts are event-only (no storage) and deploy to Lens via ZKSync
 */

export const LENS_TESTNET_CHAIN_ID = 37111
export const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz'

// ============ Exercise Grading ============

/**
 * ExerciseEvents.sol
 * Emits SayItBackAttemptGraded / MultipleChoiceAttemptGraded events for FSRS
 *
 * Deployed: 2025-11-05 to Lens Testnet (Chain ID: 37111)
 * Deployment: forge script DeployEvents.s.sol --broadcast
 */
export const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832'

/**
 * Trusted PKP address (Lit Protocol)
 * Only this address can call ExerciseEvents grading functions
 *
 * IMPORTANT: Must match the trustedPKP configured on ExerciseEvents.sol
 * Lit Action: exercise-grader-v1.js uses this PKP for signing submissions
 */
export const EXERCISE_EVENTS_PKP_ADDRESS = '0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7'
export const EXERCISE_EVENTS_PKP_PUBLIC_KEY =
  '0x04d6fd6ca7dc3c09f62bac1db509e37fa4c06c46b3bb8dbac6bb1efc19a4cd8e39b64ccfd7bf2ccf66ba5fc9df97a02989b1da9dcf71e01e37cd39b7beadc8f1aa'

// ============ Clip, Translation & Song Events ============

/**
 * ClipEvents.sol
 * Emits clip registration, processing, and song encryption events
 *
 * Deployed: 2025-11-10 via ethers.js
 */
export const CLIP_EVENTS_ADDRESS = '0x369Cd327c39E2f00b851f06B6e25bb01a5149961'

/**
 * TranslationEvents.sol
 * Emits translation addition events
 */
export const TRANSLATION_EVENTS_ADDRESS = '0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6'

/**
 * SongEvents.sol
 * Emits song registration events
 */
export const SONG_EVENTS_ADDRESS = '0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6'

/**
 * AccountEvents.sol
 * Emits account creation/update events
 */
export const ACCOUNT_EVENTS_ADDRESS = '0x3709f41cdc9E7852140bc23A21adCe600434d4E8'

// ============ Lit Action Configuration ============

/**
 * Deployed Lit Action for karaoke grading
 * Implements: say-it-back-v1.js (study/say-it-back-v1.js)
 *
 * Features:
 * - Transcribes user audio via Voxtral STT
 * - Calculates pronunciation score
 * - Emits SayItBackAttemptGraded / MultipleChoiceAttemptGraded via PKP
 * - Encrypted Voxtral API key passed as jsParams (correct workflow)
 *
 * Deployment: 2025-11-05 (v12-final-working-contract)
 * - Uploaded to IPFS via Pinata
 * - Uses proven working v6 RLP pattern (100% working)
 * - Fixed type handling: lineId as bytes32, lineIndex as uint16, performer as checksummed address
 * - Validates lineId is non-zero before contract submission
 * - Contract: EXERCISE_EVENTS_ADDRESS
 */
export const LIT_ACTION_IPFS_CID = 'QmdqJZjg4ar4uubsV4Feo8yqJ7WV88iRNmh98rL9KNoZiz'  // Exercise Grader v1 - Chinese Fix (2025-11-10, fixed normalizeText)

/**
 * Encrypted Voxtral API Key Parameters
 * Access control restricted to the specific Lit Action CID above
 * Can only be decrypted when running that exact Lit Action
 *
 * Frontend passes this object as voxtralEncryptedKey in jsParams
 * Updated: 2025-11-10 for Exercise Grader v1 - Chinese Fix
 */
export const LIT_ACTION_VOXTRAL_KEY = {
  ciphertext: 'otMQMntWlE3isLcLbFMdzgO9ESk7WN+LVEdc6FIPeG5D8fA68EMQcp9VhosCHvuvmkDWVTSzC6qrfcnAJ6JqlTBOTIVSeZ4VJvZ/xkvvXmchdNWmb7bdc2Ee60JLUroqY4kf+Z3pHzDhb4X/ocHStJHfAg==',
  dataToEncryptHash: '47d9b331855237315fee05e18e133a0ebe8d3cef60852a5c2d57a1a64095cbdf',
  accessControlConditions: [
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':currentActionIpfsId'],
      returnValueTest: {
        comparator: '=',
        value: 'QmdqJZjg4ar4uubsV4Feo8yqJ7WV88iRNmh98rL9KNoZiz',  // Exercise Grader v1 - Chinese Fix (2025-11-10)
      },
    },
  ],
}

/**
 * Grove IPFS endpoints for file upload
 */
export const GROVE_UPLOAD_ENDPOINT = 'https://api.grove.storage'

/**
 * Subgraph endpoint for querying indexed events
 * Imported from centralized client config (supports local/studio switching)
 */
export { SUBGRAPH_URL as SUBGRAPH_ENDPOINT } from '@/lib/graphql/client'
