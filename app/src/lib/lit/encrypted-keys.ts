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
 * Bound to Match and Segment Lit Action: QmYZepjJo4Undgjugjz5oMktQwK4QqjAoYnvAbySKrg15Z
 */
export const GENIUS_API_KEY_V6: EncryptedKey = {
  ciphertext: "rkZnOhFzdXcBcTb7DPo0xoU3kcL+P7KtK1tytpXwOpfytlBTkgEmbL5/HGvQ+jxQvXD6aygfG2WoJPf/DTEa18IEV07pRrl8toOROmEg9itBeA0PyMzTwP6RwvhsioUZLC1s/rL3yNi67m62Hht9CsCzge48Mut4qCDie2PrO/Pms+621iKLX/4Ic70YOeZqajYC",
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
        value: "QmYZepjJo4Undgjugjz5oMktQwK4QqjAoYnvAbySKrg15Z"
      }
    }
  ],
  encryptedAt: "2025-10-07T17:35:19.443Z",
  cid: "QmYZepjJo4Undgjugjz5oMktQwK4QqjAoYnvAbySKrg15Z"
}

/**
 * OpenRouter API Key (v6)
 * Bound to Match and Segment Lit Action: QmYZepjJo4Undgjugjz5oMktQwK4QqjAoYnvAbySKrg15Z
 */
export const OPENROUTER_API_KEY_V6: EncryptedKey = {
  ciphertext: "i9z1vwOVovajKRFfLUIGaaN599DMZKM0QH+SKs+NOMqx4JPf6KqIyBXiOlcK06rIfLaDtkIIKZkw+3gknm+rPc2ems8wFj8lrLp77YW2gtJKMFf0BPmudOE3h09Qy11bgeGCPSEbPEdgUszlLKmd4m/i5lMjyb+IxiH5mMyxXzuNcfr/Q9FPYZvXj7/6Diel52Xz2mpp8x/pQd4C",
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
        value: "QmYZepjJo4Undgjugjz5oMktQwK4QqjAoYnvAbySKrg15Z"
      }
    }
  ],
  encryptedAt: "2025-10-07T17:35:16.987Z",
  cid: "QmYZepjJo4Undgjugjz5oMktQwK4QqjAoYnvAbySKrg15Z"
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
