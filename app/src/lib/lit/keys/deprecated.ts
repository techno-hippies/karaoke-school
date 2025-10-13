/**
 * Deprecated Encrypted API Keys
 *
 * These keys are no longer in active use but are kept for reference.
 * DO NOT use these in production code.
 */

import type { EncryptedKey } from './types'

/**
 * Genius API Key (Contract v1) - Contract-based access control
 * DEPRECATED: Switched to CID-locked access control for better security
 */
export const GENIUS_API_KEY_CONTRACT_V1: EncryptedKey = {
  ciphertext: "iGTAXV5G+goWunj/eOA7fHkqM+K3TEU+KYUdg+8+KJUKT5+1N7ZjGTahVg0qosYxTYhh81te4hbqmbyVVpcLJIZ3uxWu8FrA1NuR9mP+dRFBoY4b/8hjTSogBcttcJuvp6iZBWfqP1yq4nT+BpK1fpZaEa1sdgjEMY9chONbP9VDfn5wEeyk0apzfD0u4h6BtxoC",
  dataToEncryptHash: "364e5c5764d520470a219b3550be8019abf9ec10025d4abe0fe90f0bb929d75d",
  accessControlConditions: [
    {
      conditionType: "evmContract",
      contractAddress: "0x6de183934E68051c407266F877fafE5C20F74653",
      chain: "baseSepolia",
      functionName: "credits",
      functionParams: [":userAddress"],
      functionAbi: {
        type: "function",
        name: "credits",
        inputs: [{ name: "user", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
        stateMutability: "view"
      },
      returnValueTest: {
        key: "",
        comparator: ">",
        value: "0"
      }
    }
  ],
  encryptedAt: "2025-10-12T19:05:39.972Z",
  cid: "contract-based-v1"
}

/**
 * OpenRouter API Key (Contract v1) - Contract-based access control
 * DEPRECATED: Switched to CID-locked access control for better security
 */
export const OPENROUTER_API_KEY_CONTRACT_V1: EncryptedKey = {
  ciphertext: "thHubjfkv+Ww8rzgVsx7N2tSlQtSqF5gITa4zqg0BI0f6M0sGHLcnYi7uGnpDci6cAsDS5H/td8EoMaZl9JIyTsUmXRiHy+57J7ywmtKVOBKKnfa2tpKY6N5+vLkWRLzRIe7SHqGq0b7Zvl6SUR3H/+HjTx+hWlTTYNo6FnnAMs7eIah9waZjNNFQAyf/ER+HQGG2T6a+hotBXgC",
  dataToEncryptHash: "4f9b618d0520edab3fac75626e5aab97cce461632a0a50970de8db842dcc5a23",
  accessControlConditions: [
    {
      conditionType: "evmContract",
      contractAddress: "0x6de183934E68051c407266F877fafE5C20F74653",
      chain: "baseSepolia",
      functionName: "credits",
      functionParams: [":userAddress"],
      functionAbi: {
        type: "function",
        name: "credits",
        inputs: [{ name: "user", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
        stateMutability: "view"
      },
      returnValueTest: {
        key: "",
        comparator: ">",
        value: "0"
      }
    }
  ],
  encryptedAt: "2025-10-12T19:05:37.651Z",
  cid: "contract-based-v1"
}

/**
 * Genius API Key (v7) - CID-locked version
 * DEPRECATED: Replaced by v13
 */
export const GENIUS_API_KEY_V7: EncryptedKey = {
  ciphertext: "jU2Ug35jdJgsN1PQAvH7v84SFMefYr3NcF16rSJk6CDPegFHkU6R2owAikmEpOVvJnLxVCU5uLAIMBhc0bMxS8J0Y5lgUzvZR36I84DeXKRBjL6d2LGE20EV/7asranunqURmKJUcDqlfus05BguHKr8QftTx5kuo7b/7n4cO4FAEb2fLF72+clacgl08Q7nA7cC",
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
        value: "QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF"
      }
    }
  ],
  encryptedAt: "2025-10-12T09:02:12.422Z",
  cid: "QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF"
}

/**
 * OpenRouter API Key (v7) - CID-locked version
 * DEPRECATED: Replaced by v13
 */
export const OPENROUTER_API_KEY_V7: EncryptedKey = {
  ciphertext: "jrxeS+t9ioLVgUShWR+KdS2doP1FUXAy47dsHIWLIka83hF+BPKIZDfDAQDmtg0QAjryeYUq3CUkByT87u+NTkS8t+2u0WQWjvNQJ1BIa8FKdWbCGJaKLE2nl5W2BbUGOKIGSNHa7bRabqt/sOAcY02RCZCBDn24YQVVRMivd1MrLAuvYGwXL1G4YaQ1bQgze18WCP43ruTZo1sC",
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
        value: "QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF"
      }
    }
  ],
  encryptedAt: "2025-10-12T09:02:10.234Z",
  cid: "QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF"
}

/**
 * Genius API Key (v12) - CID-locked version
 * DEPRECATED: Replaced by v13
 */
export const GENIUS_API_KEY_V12: EncryptedKey = {
  ciphertext: "gQ+7YoinvXbfuvSDkqaB+o/aEyADTI6m2SbFb43zNojIszPp0SgJUB02uiiIyZL4L+SMqtZucuGyK8+MxahL/FvEqx6UXJJC1C41lqAZ/O1BNtL3F2mG2+MvBiMY7wQLGcF++yxR6l8LHqJiGJGNKNRfAsDC132ouT1Cnq6O0STuY4WpqfBHcY8CQKwSbQSE9FAC",
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
        value: "QmPpgmboJg8ukdX17X87ktaYtyPK9bX7Lpa8geMSmCW72E"
      }
    }
  ],
  encryptedAt: "2025-10-12T20:25:14.315Z",
  cid: "QmPpgmboJg8ukdX17X87ktaYtyPK9bX7Lpa8geMSmCW72E"
}

/**
 * OpenRouter API Key (v12) - CID-locked version
 * DEPRECATED: Replaced by v13
 */
export const OPENROUTER_API_KEY_V12: EncryptedKey = {
  ciphertext: "hZ8gN4GY1PjL1wvgLRV4OyP/7mSb1eMb5mJRkPW+Ae3guNjjgFjN0+o12fauKf2r/Iqq1PcPQ7irWfdWTcg7ItMz2FtZr9nRbT5FnPxkoYhKm9tVmpS0wUD7LDNmnw7l7NeNTOz6P6OAkIkHe2Q1k5bGdRaRAox2rynHTaW3LpijVUdjNu98WncJABN01fULLaNVeStE8/Tw7GkC",
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
        value: "QmPpgmboJg8ukdX17X87ktaYtyPK9bX7Lpa8geMSmCW72E"
      }
    }
  ],
  encryptedAt: "2025-10-12T20:25:11.976Z",
  cid: "QmPpgmboJg8ukdX17X87ktaYtyPK9bX7Lpa8geMSmCW72E"
}
