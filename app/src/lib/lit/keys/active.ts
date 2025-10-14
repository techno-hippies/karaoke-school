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
 * Genius API Key (v20) - CID-locked version
 * Bound to Match and Segment Lit Action v8 (FIXED hasFullAudio): QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "siZ/MtB6Zxedkc4wXholPjsjy2LSxKuIKoB5n3aFgsdJv7bNBt5S0h9+iOc/OEUzc5BTmcgI2XiYChg8fOL+3Zj9TuT2C3xqkkStJlJsRvJB6hLZsf2jPuFdEf2d5Ztxt5abVqDuNe6i8DuPHmnXY0cT7o0F9JyWzPe7SFcpDPGv5/MJrgRFXWocX781Hd9dh3EC",
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
        value: "QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu"
      }
    }
  ],
  encryptedAt: "2025-10-14T16:35:27.732Z",
  cid: "QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu"
}

/**
 * OpenRouter API Key (v20) - CID-locked version
 * Bound to Match and Segment Lit Action v8 (FIXED hasFullAudio): QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "oJbb81qE9/QcWdAMQ/BEZOIElMtz+/wcZ+srmTx0EQc8M26GjXGl7FxMz/JciEzVIVeTc4/T5CAQhWd6ISbIYEQ4DxYmsE6rIl7uhHnpp91KatBMmskWCIjAsfUnDJgvxDOBWtBI+R+aEpslmlGCg3+09C+d34RU7/UdHQEFCB/9PWDnNbE2WG7ULNyHZ+Ht1/lmB77GLMJHvsoC",
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
        value: "QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu"
      }
    }
  ],
  encryptedAt: "2025-10-14T16:35:30.788Z",
  cid: "QmbpPewZ7VWRyJaju5LoJk3xEqdPW5aQd3hNNB9AFHhLhu"
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
