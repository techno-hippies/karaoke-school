/**
 * Smart contract addresses on Lens Testnet (Chain ID: 37111)
 *
 * All contracts are event-only (no storage) and deploy to Lens via ZKSync
 */

export const LENS_TESTNET_CHAIN_ID = 37111
export const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz'

// ============ Performance Grading ============

/**
 * PerformanceGrader.sol
 * Emits PerformanceGraded events for leaderboard indexing
 *
 * Deployed: 2025-11-03 to Lens Testnet (Chain ID: 37111)
 * Deployment: forge script DeployEvents.s.sol --broadcast
 * Event: PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)
 */
export const PERFORMANCE_GRADER_ADDRESS = '0x5da966F19bD1a67D6AAda68b338e4B336CeA5aE8'

/**
 * Master PKP address (Lit Protocol)
 * Only this address can call gradePerformance()
 *
 * IMPORTANT: This address must match the trustedPKP in PerformanceGrader.sol
 * Lit Action: karaoke-grader-v6-performance-grader.js uses 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
 *
 * This PKP signs PerformanceGrader transactions from the Lit Action
 */
export const MASTER_PKP_ADDRESS = '0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7'
export const MASTER_PKP_PUBLIC_KEY =
  '0x04d6fd6ca7dc3c09f62bac1db509e37fa4c06c46b3bb8dbac6bb1efc19a4cd8e39b64ccfd7bf2ccf66ba5fc9df97a02989b1da9dcf71e01e37cd39b7beadc8f1aa'

// ============ Segment & Translation Events ============

/**
 * SegmentEvents.sol
 * Emits segment registration and processing events
 */
export const SEGMENT_EVENTS_ADDRESS = '0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274'

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

/**
 * ExerciseEvents.sol
 * Emits exercise registration and grading events (FSRS)
 */
export const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832'

// ============ Lit Action Configuration ============

/**
 * Deployed Lit Action for karaoke grading
 * Implements: say-it-back-v1.js (study/say-it-back-v1.js)
 *
 * Features:
 * - Transcribes user audio via Voxtral STT
 * - Calculates pronunciation score
 * - Emits LinePerformanceGraded event via PKP (line-level FSRS)
 * - Encrypted Voxtral API key passed as jsParams (correct workflow)
 *
 * Deployment: 2025-11-05 (v12-final-working-contract)
 * - Uploaded to IPFS via Pinata
 * - Uses proven working v6 RLP pattern (100% working)
 * - Fixed type handling: lineId as bytes32, lineIndex as uint16, performer as checksummed address
 * - Validates lineId is non-zero before contract submission
 * - Contract: 0x5da966F19bD1a67D6AAda68b338e4B336CeA5aE8 ✅ (with gradeLinePerformance)
 */
export const LIT_ACTION_IPFS_CID = 'QmY1GksY1dqFM8doTquRdc1ZyWX8GZxa3xEsSwaucWPRVm'  // Karaoke Grader v12 - Final Working Contract

/**
 * Encrypted Voxtral API Key Parameters
 * Access control restricted to the specific Lit Action CID above
 * Can only be decrypted when running that exact Lit Action
 *
 * Frontend passes this object as voxtralEncryptedKey in jsParams
 * Updated: 2025-11-05 for v12 Lit Action (final-working-contract)
 */
export const LIT_ACTION_VOXTRAL_KEY = {
  ciphertext: 'gVNQJ8pMwcXppvFu75lFiJz578jdgf0Ep6jkQ9aAJIj6z2blz1n0Y+NgRjQzwoi6YGEuftx667kPsJ1hIiGCEfnSPgRI3oPA66j/0Wc8e8whvYFDIjNS8gFdwv9Tkk5Brzz0GSZe2A/wlTblF3IMxbg9Ag==',
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
        value: 'QmY1GksY1dqFM8doTquRdc1ZyWX8GZxa3xEsSwaucWPRVm',  // Karaoke Grader v12 - Final Working Contract (2025-11-05)
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
 */
export const SUBGRAPH_ENDPOINT = 'http://localhost:8000/subgraphs/name/subgraph-0'
