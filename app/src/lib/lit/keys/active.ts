/**
 * Active Encrypted API Keys for Lit Actions
 *
 * These are the current production keys used by the application.
 * Keys are encrypted by Lit Protocol and can only be decrypted by users who meet the access control conditions.
 *
 * Security:
 * - Keys are encrypted at rest
 * - Access control is CID-locked (bound to specific Lit Action IPFS CID)
 * - Keys cannot be decrypted outside the Lit Action environment
 */

import type { EncryptedKey } from './types'

/**
 * Genius API Key (v13) - CID-locked version
 * Bound to Match and Segment Lit Action v7 (with hasFullAudio check): QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "uD0+HpeT4Bsi0rMGdmkbo85fxBx2xjeBMNKZprutt/nLAD1+Vk6zayQaIRD2s3pU0EKOjRIrCEB2egUs5hzRJTos65dv/F/O1IQOOkmZM/tB+8GOW8Bde6KtN9RT13w5iXzUkrR5Hd8ymlLMEWo8w63DX3JZ6/rqNBsYfYCnlk+0vIqRMKmY3RDl3ghMEe6m5x4C",
  dataToEncryptHash: "364e5c5764d520470a219b3550be8019abf9ec10025d4abe0fe90f0bb929d75d",
  accessControlConditions: [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":currentActionIpfsId"],
      returnValueTest: {
        comparator: "=",
        value: "QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e"
      }
    }
  ],
  encryptedAt: "2025-10-13T13:58:24.239Z",
  cid: "QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e"
}

/**
 * OpenRouter API Key (v13) - CID-locked version
 * Bound to Match and Segment Lit Action v7 (with hasFullAudio check): QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "kstri8LrcXUglnNw/WLoiMM6DMdS4rM0xEh63aA7p3/XYbv0NmlWna8XAQKbN99ysuiJnK4SssWX+gycJq7kZaRQ3nTz9Dhmww8eyYB3cytKnFqpQ+lwPuBc6nZh7uVoyiGu8J6MavKX/w5cFZ55uUv2lzh1ymtFoR2CNcJdOFZxHX2CpzTvPyPqBwCYgFIvV2N159J+jeB+wFYC",
  dataToEncryptHash: "4f9b618d0520edab3fac75626e5aab97cce461632a0a50970de8db842dcc5a23",
  accessControlConditions: [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":currentActionIpfsId"],
      returnValueTest: {
        comparator: "=",
        value: "QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e"
      }
    }
  ],
  encryptedAt: "2025-10-13T13:58:22.027Z",
  cid: "QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e"
}

/**
 * ElevenLabs API Key (v5)
 * Bound to Base Alignment Lit Action v1 (FINAL WORKING): QmT7pEXV4gsxRFa9ZEDUqao4YhQr8H9Wfwq9kxP5fKKJgF
 */
export const ELEVENLABS_API_KEY: EncryptedKey = {
  ciphertext: "jFBzL1tl+9CKAIkUjOi+jpIx1OO+A2/gGFoHbMDPP4UQWCWKowrMRbhwcNSvyT8oqSOCM5Gjc5AqFGKDd6h6WJLkG1IvQC6gvFuVOPlJioE05qiwMNVJ+Lpt2jKOG40v93oznsLeJWcImPzqw4Yfh8c7rad1VOeeqnAEvRmcoUKA1teHggI=",
  dataToEncryptHash: "2869bb248aca9a1de7506a6ddae12981cb83e454c0eecc3dd1bf9c47ab22e69b",
  accessControlConditions: [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":currentActionIpfsId"],
      returnValueTest: {
        comparator: "=",
        value: "QmT7pEXV4gsxRFa9ZEDUqao4YhQr8H9Wfwq9kxP5fKKJgF"
      }
    }
  ],
  encryptedAt: "2025-10-13T12:02:25.033Z",
  cid: "QmT7pEXV4gsxRFa9ZEDUqao4YhQr8H9Wfwq9kxP5fKKJgF"
}
