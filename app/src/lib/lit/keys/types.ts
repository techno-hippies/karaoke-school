/**
 * Type definitions for encrypted keys
 */

export interface EncryptedKey {
  ciphertext: string
  dataToEncryptHash: string
  accessControlConditions: Array<{
    conditionType: string
    contractAddress: string
    standardContractType?: string
    chain: string
    method?: string
    parameters?: string[]
    functionName?: string
    functionParams?: string[]
    functionAbi?: {
      type: string
      name: string
      inputs: Array<{ name: string; type: string }>
      outputs: Array<{ name: string; type: string }>
      stateMutability: string
    }
    returnValueTest: {
      key?: string
      comparator: string
      value: string
    }
  }>
  encryptedAt: string
  cid: string
}
