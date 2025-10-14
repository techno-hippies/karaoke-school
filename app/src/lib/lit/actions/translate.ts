/**
 * Translate Lyrics Lit Action (v1 - Per-Language Translation)
 * Generates per-language translation WITHOUT timing (uses base alignment timing)
 *
 * Flow:
 * 1. Loads base alignment from contract metadataUri
 * 2. OpenRouter translation to target language
 * 3. Uploads to Grove → song-{geniusId}-{lang}.json
 * 4. Updates contract via setTranslation(geniusId, languageCode, uri)
 *
 * Expected time: ~5-15s
 * Expected cost: ~$0.02 (OpenRouter only)
 */

import { getLitClient } from '../../lit-webauthn/client'
import { getKaraokeKeyParams } from '../keys'
import type { TranslateResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Translate Lyrics Lit Action
 *
 * @param geniusId - Genius song ID
 * @param targetLanguage - Target language code (e.g. 'zh', 'vi', 'tr')
 * @param authContext - PKP auth context for authentication
 * @param pkpAddress - PKP Ethereum address
 * @param pkpPublicKey - PKP public key
 * @param pkpTokenId - PKP token ID
 */
export async function executeTranslate(
  geniusId: number,
  targetLanguage: string,
  authContext: any,
  pkpAddress: string,
  pkpPublicKey: string,
  pkpTokenId: string
): Promise<TranslateResult> {
  try {
    const litClient = await getLitClient()
    // Translate only needs OpenRouter key (no ElevenLabs or Genius)
    const openrouterKey = {
      ciphertext: "i4yKB3gFLNusBp0w8jMH0IxS1gJdYJTXWlTAfpCwKzVIsyee2+qgJmvULeueCRhXScIRNPE5Po+17L3cfmv3BWNWLi8QiOS7gCsyTn0kBiNKY0pWWI/q5tddiuN1yibzYtc0YIcrcTV0ynXviwRYpkaU7DFwIR1FCbIqrWlxhzwpdxUBSe2p7eY0qmL3WmeKy5DD/WjjmOPkQ7cC",
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
            value: "QmUY8xCVvk85ZwxWeUpA1jBzHCsfHm12uVwVUrFsyvhdWk"
          }
        }
      ]
    }

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_TRANSLATE,
      authContext,
      jsParams: {
        geniusId,
        targetLanguage,
        openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
        openrouterKeyCiphertext: openrouterKey.ciphertext,
        openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,
        contractAddress: import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT,
        pkpAddress,
        pkpTokenId,
        pkpPublicKey,
        updateContract: true,
      },
    })

    const response: TranslateResult = JSON.parse(result.response)

    if (IS_DEV) {
      if (response.success) {
        console.log(`[Translate] ✅ Success:`, {
          geniusId,
          targetLanguage,
          lineCount: response.lineCount,
          translationUri: response.translationUri,
          txHash: response.txHash,
          contractError: response.contractError
        })

        if (!response.txHash) {
          console.warn('[Translate] ⚠️ No transaction hash - contract not updated!')
        }
        if (response.contractError) {
          console.error('[Translate] ❌ Contract update failed:', response.contractError)
        }
      } else {
        console.error('[Translate] ❌ Failed:', response.error)
      }
    }

    return response
  } catch (err) {
    console.error('[Translate] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Translation failed',
    }
  }
}
