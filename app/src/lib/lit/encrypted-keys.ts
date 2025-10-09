/**
 * Encrypted API Keys for Lit Actions
 *
 * These keys are encrypted by Lit Protocol and can only be decrypted
 * by the specific Lit Action IPFS CID they're bound to.
 *
 * Security:
 * - Keys are encrypted at rest
 * - Access control conditions restrict usage to specific Lit Action CID
 * - Keys cannot be decrypted outside the Lit Action environment
 */

export interface EncryptedKey {
  ciphertext: string
  dataToEncryptHash: string
  accessControlConditions: Array<{
    conditionType: string
    contractAddress: string
    standardContractType: string
    chain: string
    method: string
    parameters: string[]
    returnValueTest: {
      comparator: string
      value: string
    }
  }>
  encryptedAt: string
  cid: string
}

/**
 * Genius API Key (v6)
 * Bound to Match and Segment Lit Action: QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2
 */
export const GENIUS_API_KEY_V6: EncryptedKey = {
  ciphertext: "onX4FyQz+ej+a1yell1yoGlVfIYEQjolf0g7mKYviSsMNT2Q9TrDK6Ui+e8gOwkL/Y8hLDlfBVukJlTS2jh4QTkoUKlr1Kn8DfynuuajLutBiNvlZk4+4BYSYrtrotAo5d5OVMRMwwFqSb84QjhwiY/yfdENPd5Iimb95369gDr50LlD0ct+msIbgQFy5oCon3kC",
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
        value: "QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2"
      }
    }
  ],
  encryptedAt: "2025-10-09T15:34:23.418Z",
  cid: "QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2"
}

/**
 * OpenRouter API Key (v6)
 * Bound to Match and Segment Lit Action: QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2
 */
export const OPENROUTER_API_KEY_V6: EncryptedKey = {
  ciphertext: "tBKS57wfEkuR1uq6eSAARKK4yiMOdRQpoUyXROVLoVZT7sR1nxQTeqKTQnq3LdVK5c+0zt+xkpXPKFD0i9tfEUDNfIV8Yaj/xS2THqLHm8tKnGdBBbv8P+MtMWsOa9NST1T7JREeUTDBPWW99yltLZkxWTz+3Akpk5dSnHeBVgnH3yDgzgfQFPQS+U4ylQ+MsmL+XdTTLgrOOOwC",
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
        value: "QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2"
      }
    }
  ],
  encryptedAt: "2025-10-09T15:34:21.056Z",
  cid: "QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2"
}

/**
 * Get encrypted key parameters for Lit Action execution
 */
export function getGeniusKeyParams() {
  return {
    geniusKeyAccessControlConditions: GENIUS_API_KEY_V6.accessControlConditions,
    geniusKeyCiphertext: GENIUS_API_KEY_V6.ciphertext,
    geniusKeyDataToEncryptHash: GENIUS_API_KEY_V6.dataToEncryptHash,
  }
}

/**
 * Get encrypted key parameters for Lit Action execution
 */
export function getOpenRouterKeyParams() {
  return {
    openrouterKeyAccessControlConditions: OPENROUTER_API_KEY_V6.accessControlConditions,
    openrouterKeyCiphertext: OPENROUTER_API_KEY_V6.ciphertext,
    openrouterKeyDataToEncryptHash: OPENROUTER_API_KEY_V6.dataToEncryptHash,
  }
}

/**
 * Get all encrypted key parameters for karaoke Lit Actions
 */
export function getKaraokeKeyParams() {
  return {
    ...getGeniusKeyParams(),
    ...getOpenRouterKeyParams(),
  }
}
