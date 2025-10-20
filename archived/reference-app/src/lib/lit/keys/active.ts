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
 * Genius API Key (v18) - CID-locked version
 * Bound to Match and Segment Lit Action v10 (geniusArtistId Support): QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "qCwAfBZ7nS2UXa3VebocbEzsQPC3fk3o6fC75j9t//qvGvwATNQpm9hcuAs7Zyn2y/fMpNtpgh6775i+OYuE+OAniWSLNNeXst0X9yp20hdB4bdITCmdNeCv3l7ZNkBPiMuTYh0ikhQVSmOXs9d4d2vLRr2YvpRu5Ddn8qrdYCk2VOJWkCqws5NhAc1RLPorndwC",
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
        value: "QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G"
      }
    }
  ],
  encryptedAt: "2025-10-19T11:19:42.871Z",
  cid: "QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G"
}

/**
 * OpenRouter API Key (v18) - CID-locked version
 * Bound to Match and Segment Lit Action v10 (geniusArtistId Support): QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "pH4POY0dg+uCMiGW8VwU0K8UQvHVA8nrKqdi7y3diMF3rVE64gUC3YHNdEAOfhA3I0aT8s3xetVUv/DKq2aoNczTLNAG9sUqCcACcxSArUtKhbPsxSVvBzqEssyDlGkDWUfrxLN7zXy9HubIGlS9hjCydYMYmU7eZyFJc1j+9uSHNvX0+hOkYjTC6uGSJGunkrYc49AlKglm7CwC",
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
        value: "QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G"
      }
    }
  ],
  encryptedAt: "2025-10-19T11:19:50.978Z",
  cid: "QmbqMqiHAcJNU9p2qfHv5s9Kb5bf6RLN8nxWAkyMSo6Q1G"
}

/**
 * ElevenLabs API Key (v11)
 * Bound to Base Alignment Lit Action v2.1 (geniusArtistId support): QmX8wJ1EmcPpAb7GsX3sJQEeLMqqN4nT4GoL36b4Di19D8
 */
export const ELEVENLABS_API_KEY: EncryptedKey = {
  ciphertext: "srNHojQ8hNMRsKLPdMQC//CNLqLJpmaPZLz5ogy0rwtO0YZe0mbfnQ6jjUtPEReQ9GVo0lWMXDdCT0v0l918XfobUJ5qR7hPqoCh3gfSnWQ00mnE4A3UY/xtJDdAjsxfXoOlOlpmp3eEgxQEnmyAu+VLnw1b/z2xLufuAZdxA9dzzBBqtgI=",
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
        value: "QmX8wJ1EmcPpAb7GsX3sJQEeLMqqN4nT4GoL36b4Di19D8"
      }
    }
  ],
  encryptedAt: "2025-10-19T13:48:45.036Z",
  cid: "QmX8wJ1EmcPpAb7GsX3sJQEeLMqqN4nT4GoL36b4Di19D8"
}
