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
 * Genius API Key (v17) - CID-locked version
 * Bound to Match and Segment Lit Action v9 (SC Fallback): QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "oS3P0uk5JhGnP6hrNoGQj10t6j+ALBU2KTYAz+rlNYnU9gLVi9J0xL9irv6WZUFwOEybV5OS1xgHM2UqPIkEavNMhFgH1zFQ0S3E7KaFG2dBHMNZMU1ZQNyoRCHPAoNAIVF8BiTB/df1VovB5Zqywlsjas0shtYb9PKVCm+M8ZiLgoW27MFAZ/C0MUWX9OocsDYC",
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
        value: "QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN"
      }
    }
  ],
  encryptedAt: "2025-10-17T13:30:32.133Z",
  cid: "QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN"
}

/**
 * OpenRouter API Key (v17) - CID-locked version
 * Bound to Match and Segment Lit Action v9 (SC Fallback): QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "q9vMmhgEFYbgNktKzfKaFMwn3jVimQ2Z5hQBu8FArX68HUvJFy1+Rexh42MWt/SYB9ikYONWDHll/dJYPnqY/HVj3Lwau8HYymIkgBOiX9tKIMyu5/DT9bcvS78qCkSji/RFFefhXssrJJmLAVre4HZfHe2aQ4CeqJBY0OAzPDUqMxHZI55VhvVsig325VpIHytu6xByv3MlJFwC",
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
        value: "QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN"
      }
    }
  ],
  encryptedAt: "2025-10-17T13:30:43.580Z",
  cid: "QmQtXQCMSjaeD7jCgvH6u7cnq2mFnucLieB3CaEsSA9HjN"
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
