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
export const EXERCISE_EVENTS_PKP_ADDRESS = '0x3e89ABa33562d4C45E62A97Aa11443F738983bFf'
export const EXERCISE_EVENTS_PKP_PUBLIC_KEY =
  '0x047ae2744a82e4ca8bd9bb499ffb46b98c2f2aba81f41de1e521256300ba05d9e191ef116520daa845af42bcf58d868c60881b689f9cb4b5499565a18f9d69991e'

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
export const LIT_ACTION_IPFS_CID = 'QmSA96awmjMEaTgRL91DhVv4JLReRaPEguZ1Mw93hJTexa'

/**
 * Deployed Lit Action for full karaoke grading (Clip/Song)
 * Implements: karaoke-grader-v1.js
 * 
 * Features:
 * - Transcribes full clip/song audio
 * - Scores entire performance against lyrics
 * - Emits KaraokePerformanceGraded event via PKP
 * 
 * Deployment: 2025-11-19 (Karaoke Grader v1 - Naga Testnet Fix)
 * - CID: QmZpjAKP7ayH21WxT1FQ1w3x6gpx3z1DyBVmXobL9vhVx4
 */
export const LIT_KARAOKE_GRADER_CID = 'QmZpjAKP7ayH21WxT1FQ1w3x6gpx3z1DyBVmXobL9vhVx4'

/**
 * Encrypted Voxtral API Key Parameters
 * Access control restricted to the specific Lit Action CID above
 * Can only be decrypted when running that exact Lit Action
 *
 * Frontend passes this object as voxtralEncryptedKey in jsParams
 * Updated: 2025-11-19 for Exercise Grader v1 - Naga Testnet Fix
 */
export const LIT_ACTION_VOXTRAL_KEY = {
  ciphertext: 'lcEmH787hBsgNWLzjOw1J7A9fp8+p3pld0W+3MBoU8FZzFmQdnfDuZKbvrriVYwKjp/CqMSRhMxPeuT6Osld0p41AFMocu98fDvDme/tcHoh0Ig+QCoOWCcfWCnCurE92KyiD1dbsDsPbHpHLppXP89GAg==',
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
        value: 'QmSA96awmjMEaTgRL91DhVv4JLReRaPEguZ1Mw93hJTexa',
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
  ciphertext: 'i6Lz63taJ5sBrtFcoHZSW3Y0SZ1eEGE4URwiVjgwgdcWYdvcsRmJ5v19e+cS+LcIiYzLIGnFjh88yGbSfwLOtvI0dnxQVMa1BL52O65+lAwh1QLucfDL8ni5GX0C7ZuKcjDDhUVKoywfNiPSlWp8YJwXAg==',
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
        value: 'QmZpjAKP7ayH21WxT1FQ1w3x6gpx3z1DyBVmXobL9vhVx4',
      },
    },
  ],
}

export const LIT_KARAOKE_OPENROUTER_KEY = {
  ciphertext: 'mZMCGqnBm4Va1113FotbkJaLe14AdH617FA0/nv6eVm/gaZXcPrzr/osx28wtckMsleYzNuLuOFme7AbJFr+A7PY9G3S2pGnGgiekVvR9IFKlxRGW7r1eUq+r7lVafTcTqKFte8Kr4Y2pgZ+MHpJszN38my1NoGDFFREde5dG6WHNEkeSY393KUEynyXC0dG50Deu383xfPoJ+AC',
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
        value: 'QmZpjAKP7ayH21WxT1FQ1w3x6gpx3z1DyBVmXobL9vhVx4',
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
