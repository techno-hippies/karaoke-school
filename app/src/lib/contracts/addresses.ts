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
export const EXERCISE_EVENTS_PKP_ADDRESS = '0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379'
export const EXERCISE_EVENTS_PKP_PUBLIC_KEY =
  '0x047037fa3f1ba0290880f20afb8a88a8af8a125804a9a3f593ff2a63bf7addd3e2d341e8e3d5a0ef02790ab7e92447e59adeef9915ce5d2c0ee90e0e9ed1b0c5f7'

// ============ Karaoke Events ============

/**
 * KaraokeEvents.sol
 * Emits KaraokePerformanceGraded events
 *
 * Deployed to Lens Testnet
 */
export const KARAOKE_EVENTS_ADDRESS = '0x51aA6987130AA7E4654218859E075D8e790f4409'

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
 * Deployment: 2025-11-19 (Exercise Grader v1 - Naga Testnet Fix)
 * - Uploaded to IPFS via Pinata
 * - Uses proven working v6 RLP pattern (100% working)
 * - Fixed type handling: lineId as bytes32, lineIndex as uint16, performer as checksummed address
 * - Validates lineId is non-zero before contract submission
 * - Contract: EXERCISE_EVENTS_ADDRESS
 */
export const LIT_ACTION_IPFS_CID = 'QmUWhBbe8Q6oQbmEdgEhDLHaabnruZsjWTD2ewTprWnzz5'

/**
 * Deployed Lit Action for full karaoke grading (Clip/Song)
 * Implements: karaoke-grader-v1.js
 * 
 * Features:
 * - Transcribes full clip/song audio
 * - Scores entire performance against lyrics
 * - Emits KaraokePerformanceGraded event via PKP
 * 
 * Deployment: 2025-11-20 (Karaoke Grader v1 - timeout-guarded)
 * - CID: QmRKtTTydCULhbbqj1WYQeN3jKnwGExKyDxhnNfeSN7q6S
 */
export const LIT_KARAOKE_GRADER_CID = 'QmRqh6sj3TD4wcBSkWo3DNMjmc9s5vqhdqWG4P5dHwBdWk'

/**
 * Encrypted Voxtral API Key Parameters
 * Access control restricted to the specific Lit Action CID above
 * Can only be decrypted when running that exact Lit Action
 *
 * Frontend passes this object as voxtralEncryptedKey in jsParams
 * Updated: 2025-11-19 for Exercise Grader v1 - Naga Testnet Fix
 */
export const LIT_ACTION_VOXTRAL_KEY = {
  ciphertext: 'k0BD1OAc6IYdCBPpg1l6q9Rk8y8+x/3ikfTjkBm5/WeVLON1iobtS5jt0VoImjY4TdefHtXeeikVv2JYw/Gqxo5941tDokUjXghf+wnQOmMhULMdO9HBi0/1V5anChwwbQmAyqvTsQA1on6PNdnBM4dyAg==',
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
        value: 'QmUWhBbe8Q6oQbmEdgEhDLHaabnruZsjWTD2ewTprWnzz5',
      },
    },
  ],
}

/**
 * Encrypted keys for Karaoke Grader
 * Contains Voxtral + OpenRouter keys
 * Updated: 2025-11-19
 */
export const LIT_KARAOKE_VOXTRAL_KEY = {
  ciphertext: 'pQnV9BP7yYnMLtbKUesOie2Ab5WBDcQlT0En6MIg3mzRuh9jQ2x1jwOD6pFyt65GpLCvqDimkTcLO2ZK6hIENWv5FUcepvhff0O6N2E0nFghk/23mb+Y4JLxzXvExsAckRI8OET5QdkGSFgpGppVqazbAg==',
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
        value: 'QmRqh6sj3TD4wcBSkWo3DNMjmc9s5vqhdqWG4P5dHwBdWk',
      },
    },
  ],
}

export const LIT_KARAOKE_OPENROUTER_KEY = {
  ciphertext: 'kES6fesvxJNct4+di0so4JlYJA0hzQVZIhvzUdYwKhKXTLNwotHdZDtO7tjD0Bs3uL3D2jHSRi6shZJTWJQXjS1V/RDP5D50lhbK1a4QBO1KCIwkkMuixr2JAV76jJxCVNNcahKIvbndHdaSwJb+fXhCphv3CDgZ+Do5erKshCY8Bwt4GIgiNR0Z6OwJkimOKWrFrFSvMtjQ0twC',
  dataToEncryptHash: '4f9b618d0520edab3fac75626e5aab97cce461632a0a50970de8db842dcc5a23',
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
        value: 'QmRqh6sj3TD4wcBSkWo3DNMjmc9s5vqhdqWG4P5dHwBdWk',
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
