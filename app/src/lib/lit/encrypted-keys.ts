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
 * Genius API Key (v7)
 * Bound to Match and Segment Lit Action: QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF
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
 * OpenRouter API Key (v7)
 * Bound to Match and Segment Lit Action: QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF
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
 * ElevenLabs API Key (v3)
 * Bound to Match and Segment Lit Action: QmU6P1eJXSzFoeGTjaB2MLixH2hAMAN1ephTDeNokZHjUF
 */
export const ELEVENLABS_API_KEY_V3: EncryptedKey = {
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

/**
 * Get encrypted key parameters for Lit Action execution
 */
export function getGeniusKeyParams() {
  return {
    geniusKeyAccessControlConditions: GENIUS_API_KEY_V7.accessControlConditions,
    geniusKeyCiphertext: GENIUS_API_KEY_V7.ciphertext,
    geniusKeyDataToEncryptHash: GENIUS_API_KEY_V7.dataToEncryptHash,
  }
}

/**
 * Get encrypted key parameters for Lit Action execution
 */
export function getOpenRouterKeyParams() {
  return {
    openrouterKeyAccessControlConditions: OPENROUTER_API_KEY_V7.accessControlConditions,
    openrouterKeyCiphertext: OPENROUTER_API_KEY_V7.ciphertext,
    openrouterKeyDataToEncryptHash: OPENROUTER_API_KEY_V7.dataToEncryptHash,
  }
}

/**
 * Get encrypted key parameters for Lit Action execution
 */
export function getElevenlabsKeyParams() {
  return {
    elevenlabsKeyAccessControlConditions: ELEVENLABS_API_KEY_V3.accessControlConditions,
    elevenlabsKeyCiphertext: ELEVENLABS_API_KEY_V3.ciphertext,
    elevenlabsKeyDataToEncryptHash: ELEVENLABS_API_KEY_V3.dataToEncryptHash,
  }
}

/**
 * Get all encrypted key parameters for karaoke Lit Actions
 */
export function getKaraokeKeyParams() {
  return {
    ...getGeniusKeyParams(),
    ...getOpenRouterKeyParams(),
    ...getElevenlabsKeyParams(),
  }
}
