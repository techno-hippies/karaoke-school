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
export const PERFORMANCE_GRADER_ADDRESS = '0xab92c2708d44fab58c3c12aaa574700e80033b7d'

/**
 * Master PKP address (Lit Protocol)
 * Only this address can call gradePerformance()
 *
 * IMPORTANT: This address must match the trustedPKP in PerformanceGrader.sol
 * Lit Action: karaoke-grader-v6-performance-grader.js uses 0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30
 *
 * This PKP signs PerformanceGrader transactions from the Lit Action
 */
export const MASTER_PKP_ADDRESS = '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30'
export const MASTER_PKP_PUBLIC_KEY =
  '0x049cab6a18225dd566f3a4d6816b2c080fc885b21d3b9021fd80491573bf15141177eca2685a9a5eb0082957bd6581dcd71a43039914e07f4a45146f8246d01b77'

// ============ Segment & Translation Events ============

/**
 * SegmentEvents.sol
 * Emits segment registration and processing events
 */
export const SEGMENT_EVENTS_ADDRESS = '0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8'

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
 * Implements: karaoke-grader-v6-performance-grader.js
 *
 * Features:
 * - Transcribes user audio via Voxstral STT
 * - Calculates pronunciation score
 * - Emits PerformanceGraded event via PKP
 *
 * Deployment: 2025-11-03 (v6-fixed)
 * - Uploaded to IPFS via Pinata
 * - PKP permissions added and verified
 * - Fixed multipart buffer sizing for Voxstral API
 * - Ready for production use
 */
export const LIT_ACTION_IPFS_CID = 'QmRzSyBYnzbUrjJUwD52ERxT9oEovm41yxAt6u8RZpYXZn'  // v6: Graceful error handling

/**
 * Encrypted Voxstral API Key Parameters
 * Access control restricted to the specific Lit Action CID above
 * Can only be decrypted when running that exact Lit Action
 *
 * NOTE: Encryption happens dynamically at runtime in useLitActionGrader.ts
 * using the current LIT_ACTION_IPFS_CID value
 */
export const LIT_ACTION_VOXSTRAL_KEY = {
  ciphertext: 'placeholder_encrypted_voxstral_key',
  dataToEncryptHash: 'placeholder_hash',
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
        value: 'QmRzSyBYnzbUrjJUwD52ERxT9oEovm41yxAt6u8RZpYXZn',  // Updated to match LIT_ACTION_IPFS_CID
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
