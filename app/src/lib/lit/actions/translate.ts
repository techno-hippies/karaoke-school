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
// import { getKaraokeKeyParams } from '../keys' // TODO: Use for dynamic key loading
import type { TranslateResult } from './types'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

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
  authContext: any
  // pkpAddress: string, // TODO: Use for authorization
  // pkpPublicKey: string, // TODO: Use for verification
  // pkpTokenId: string // TODO: Use for session management
): Promise<TranslateResult> {
  try {
    const litClient = await getLitClient()
    // Translate only needs OpenRouter key (no ElevenLabs or Genius)
    // Updated for translate-lyrics-v1 with native + Genius song support (fixed regex)
    const openrouterKey = {
      ciphertext: "lSTepzyfv3fzQDpB+BsX48nOO0BP2pVmXomet8CynAHw9QgyaobcUNcz0bz4EQ6K49e/F13ulcinKwPM7Dytg/aFFe7byRoP3wHYHVZtGaFKmk8dYgdKqkS58PDFA4At8ecZR+676i424hycv12oje+r8nJ5aNSHrZ2ti1HylVTtOEbdosXtVTTYcbAmcsQ5rda1hcn4RQ/DGG8C",
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
            value: "QmR3VoCJGWHyus1BCSaKH8duP8ptuKehuvYuvAk8m4Vyop"
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
        contractAddress: BASE_SEPOLIA_CONTRACTS.karaokeCatalog,
        updateContract: true,
      },
    })

    const response: TranslateResult = typeof result.response === 'string'
      ? JSON.parse(result.response)
      : result.response

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
