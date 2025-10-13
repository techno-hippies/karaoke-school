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

import { getLitClient } from '../client'
import { getKaraokeKeyParams } from '../keys'
import type { TranslateResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Translate Lyrics Lit Action
 *
 * @param geniusId - Genius song ID
 * @param targetLanguage - Target language code (e.g. 'zh', 'vi', 'tr')
 * @param authContext - PKP auth context
 */
export async function executeTranslate(
  geniusId: number,
  targetLanguage: string,
  authContext: any
): Promise<TranslateResult> {
  try {
    const litClient = await getLitClient()
    const keyParams = getKaraokeKeyParams()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_TRANSLATE,
      authContext,
      jsParams: {
        geniusId,
        targetLanguage,
        ...keyParams,
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
