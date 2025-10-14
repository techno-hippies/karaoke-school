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
 * Bound to Match and Segment Lit Action v8 (V4 ABI): QmQWDN66ky5rxgCCXUboxaWKQ1L5XfHP4iiXzxHLeyACh6
 */
export const GENIUS_API_KEY: EncryptedKey = {
  ciphertext: "rhyBs/oXDnhRe3v+GqJuhRqq/+iU5ovIge486NMCaH9Gee6B0aYzMWSeo0Ih3Vp2r7lKQU8pKGED9CTUgsxVeU82zvyQOgudmtVjcEZXVzJBwfShh33xsAcuJMDKuC/9gSm1LTF/m1y4AmvNc6aFuYKf1uX5fuRYSRIXGLru2u7T73Pg56fvtdgRlc8+1kq9/14C",
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
        value: "QmQWDN66ky5rxgCCXUboxaWKQ1L5XfHP4iiXzxHLeyACh6"
      }
    }
  ],
  encryptedAt: "2025-10-14T13:57:43.758Z",
  cid: "QmQWDN66ky5rxgCCXUboxaWKQ1L5XfHP4iiXzxHLeyACh6"
}

/**
 * OpenRouter API Key (v16) - CID-locked version
 * Bound to Match and Segment Lit Action v8 (V4 ABI): QmQWDN66ky5rxgCCXUboxaWKQ1L5XfHP4iiXzxHLeyACh6
 */
export const OPENROUTER_API_KEY: EncryptedKey = {
  ciphertext: "potcVwujw+1Er6s5tRoZSj6aKKYp4cFXocYbXpDHM5jBIsS+l/1UCdrttuuk2D5FnsB9ehXHJRhZjuRc3OISQvQamd/RzGO7HGHJkUG+I21KANk+xMrhVIeEF0syRsiImpcjQ0HHcMUKTn5miwSaehnWgURBSbGUcJmtiUrQh4d9UlviWigXGEgEUgQXSI1sfpFrFMC8/nnplEUC",
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
        value: "QmQWDN66ky5rxgCCXUboxaWKQ1L5XfHP4iiXzxHLeyACh6"
      }
    }
  ],
  encryptedAt: "2025-10-14T13:57:56.545Z",
  cid: "QmQWDN66ky5rxgCCXUboxaWKQ1L5XfHP4iiXzxHLeyACh6"
}

/**
 * ElevenLabs API Key (v9)
 * Bound to Base Alignment Lit Action v2: QmP2yVNPf4FhzVuvQhwxdxPAvszRqoMTSmNMFJkwtiEiHA
 */
export const ELEVENLABS_API_KEY: EncryptedKey = {
  ciphertext: "oHNqEIQPmHAp2dQZRaPJtO5Iq7jMDauhSO3DoPnP0utNz4z6NRO55sA5DFUsCcZ0X1XiR+DtS2nqpzVabu3xEURe1AhuDdk4jMqgbxtL0dM0ISkT8FGQvWLMLC86WQY4/2vKYTdU74NAoJmlVkTJgwi4GZjIHFThFjxHVgWyazksed8qZAI=",
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
        value: "QmP2yVNPf4FhzVuvQhwxdxPAvszRqoMTSmNMFJkwtiEiHA"
      }
    }
  ],
  encryptedAt: "2025-10-14T13:22:13.917Z",
  cid: "QmP2yVNPf4FhzVuvQhwxdxPAvszRqoMTSmNMFJkwtiEiHA"
}
