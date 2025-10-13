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
 * Bound to Match and Segment Lit Action v7 (fixed - with metadata upload): QmVtM6ScW31n7UMw6TmD3HeQZvupn6YvefE4sAmenxYYt5
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "hCtDGj6f58I2nzdyvrAzCAdfVqkBa72kq+MNoj3Eg/7GYoGxl+HTXXGwWykNIGCUzJ+XrrJubpiLmdpGffphIG2U5XvKOkOrU7A9UKBwR0VBMjvqBVNltt99S9HsRHIZ7DzyjDs/aCWs/fYjcZEcZ1/hfVDKYuIEe63I1fL598SIMAD5vfAqHJhrnjkIK+nawLwC",
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
        value: "QmVtM6ScW31n7UMw6TmD3HeQZvupn6YvefE4sAmenxYYt5"
      }
    }
  ],
  encryptedAt: "2025-10-12T20:39:25.569Z",
  cid: "QmVtM6ScW31n7UMw6TmD3HeQZvupn6YvefE4sAmenxYYt5"
}

/**
 * OpenRouter API Key (v13) - CID-locked version
 * Bound to Match and Segment Lit Action v7 (fixed - with metadata upload): QmVtM6ScW31n7UMw6TmD3HeQZvupn6YvefE4sAmenxYYt5
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "gmO3ThKasZhmzeGVqyNqV1gKaQIGsrLfoZHA9dx3MoDGwX1iYPjVMMjnaol5eXj7zvxTPMDalBSJjC8DjfArXj0YEShSGy0tDZ3TD0O2LYpK2Qpn4Rx9BCy5twYma2PA7CuZyEnUH88K1SZ1DJKa08FhhoPtreGchK+e5PRxcVcSprbzAH81W1jzVEtpGf3GxPh2tUhlp/kwPN0C",
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
        value: "QmVtM6ScW31n7UMw6TmD3HeQZvupn6YvefE4sAmenxYYt5"
      }
    }
  ],
  encryptedAt: "2025-10-12T20:39:23.338Z",
  cid: "QmVtM6ScW31n7UMw6TmD3HeQZvupn6YvefE4sAmenxYYt5"
}

/**
 * ElevenLabs API Key (v3)
 * Bound to Match and Segment Lit Action: QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF
 */
export const ELEVENLABS_API_KEY: EncryptedKey = {
  ciphertext: "gqjh6y/O1wbycIpBvJ77m11NR+S/XVQk5/E86VmZv3DcswW9lgOkR7WksShd1rTGFsUuwwaPChst0NvhDs0jpy9DlB0Ti1ZizC8Bhct3VoQ0/MttFaNp+KcefNA83SQYqylaD7wZ+beH5qAC/56gQiW7JrVisJkghXwxsAy/jq2JAcbmEgI=",
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
        value: "QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF"
      }
    }
  ],
  encryptedAt: "2025-10-12T09:02:14.623Z",
  cid: "QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF"
}
