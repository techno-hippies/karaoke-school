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
 * Genius API Key (v16) - CID-locked version
 * Bound to Match and Segment Lit Action v8 (No audio fail-early): QmUVCBUzMTRpdCQJY1uip8TimUYejckPmgwuat5KNpMcfH
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "jWplt47OT6p6ticXhy4iYLmwXEyG3vzLcEwA0xV1aVkkXL/zwacRfuI100Fw9LS0g/6b6mzisknRTErmijdftT4aDqBqJuwApEiKErOVFPpBN4jQS2JKOdNMERwENUU8XGrlMN3up50j4xNTSNoRDT9fLw98JxYw3UDzo+Znd/ZVE9sr6IaqPVQQLM46vpiuaIQC",
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
        value: "QmUVCBUzMTRpdCQJY1uip8TimUYejckPmgwuat5KNpMcfH"
      }
    }
  ],
  encryptedAt: "2025-10-14T20:28:21.620Z",
  cid: "QmUVCBUzMTRpdCQJY1uip8TimUYejckPmgwuat5KNpMcfH"
}

/**
 * OpenRouter API Key (v16) - CID-locked version
 * Bound to Match and Segment Lit Action v8 (No audio fail-early): QmUVCBUzMTRpdCQJY1uip8TimUYejckPmgwuat5KNpMcfH
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "lq60HhNNXIacwXUgi4is710UWlzSpGCFJLWtZB2pkBaF1zpp2u6zYYqMmUujJ6ibzer2daFd5FMHi0TXtF+jT1HktdHmWLACvH/WgCXbUnZKUHGMj+5943up7xJaKlLLWIYwk7/c/BnDzjbjN6/J/9AxgJQnYSjBbWQAr2dbiLgSLkIxqh43b592o3K0Knahlb9XIldz5fuzDX4C",
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
        value: "QmUVCBUzMTRpdCQJY1uip8TimUYejckPmgwuat5KNpMcfH"
      }
    }
  ],
  encryptedAt: "2025-10-14T20:28:24.115Z",
  cid: "QmUVCBUzMTRpdCQJY1uip8TimUYejckPmgwuat5KNpMcfH"
}

/**
 * ElevenLabs API Key (v11)
 * Bound to Base Alignment Lit Action v2 (FIXED 17-field ABI): QmVjCaNCS45BECxgbjHExDn7VikFLpeZXjXDEF4Nta691e
 */
export const ELEVENLABS_API_KEY: EncryptedKey = {
  ciphertext: "tGllwyjbjVEFtcmPdVtA0crr9VS6LAvbHfk+ITkt7jDXnhTEeYtfLjjA1k+IHW6/SGBhV37VA5C28IbEOjiw+0QSx8MCajyxmFWmet8JVos0Ytu2rsyFU2FIkiENkDMQuHS0/4epfF8Qkyag4pZGsuN2GR18+hrBKdHjJVBkBwD+gBaCQAI=",
  dataToEncryptHash: "da26dea27c14ab04063640c69fda349cfcd7a97cb0f6d318139a57e14c50b69a",
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
        value: "QmVjCaNCS45BECxgbjHExDn7VikFLpeZXjXDEF4Nta691e"
      }
    }
  ],
  encryptedAt: "2025-10-14T18:25:29.496Z",
  cid: "QmVjCaNCS45BECxgbjHExDn7VikFLpeZXjXDEF4Nta691e"
}
