/**
 * Base Alignment Lit Action (v1 - Word Timing Only)
 * Generates word-level timing for karaoke WITHOUT translations
 *
 * Flow:
 * 1. Downloads audio from SoundCloud
 * 2. ElevenLabs forced alignment → word-level timing
 * 3. Uploads to Grove → song-{geniusId}-base.json
 * 4. Updates contract metadataUri
 *
 * Expected time: ~15-30s
 * Expected cost: ~$0.03 (ElevenLabs only)
 */

import { getLitClient } from '../client'
import { getKaraokeKeyParams } from '../keys'
import type { BaseAlignmentResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Base Alignment Lit Action
 *
 * @param geniusId - Genius song ID
 * @param plainLyrics - Plain text lyrics (no timestamps)
 * @param authContext - PKP auth context (contains pkpTokenId, pkpPublicKey, pkpEthAddress)
 */
export async function executeBaseAlignment(
  geniusId: number,
  plainLyrics: string,
  authContext: any
): Promise<BaseAlignmentResult> {
  try {
    const litClient = await getLitClient()
    const keyParams = getKaraokeKeyParams()

    // Extract PKP details from authContext
    const pkpAddress = authContext.getSessionSigs().pkpEthAddress || authContext.pkpEthAddress
    const pkpPublicKey = authContext.getSessionSigs().pkpPublicKey || authContext.pkpPublicKey
    const pkpTokenId = authContext.resourceAbilityRequests?.[0]?.resource?.getResourceKey() || ''

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_BASE_ALIGNMENT,
      authContext,
      jsParams: {
        geniusId,
        plainLyrics,
        ...keyParams,
        contractAddress: import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT,
        pkpAddress,
        pkpTokenId,
        pkpPublicKey,
        updateContract: true,
      },
    })

    const response: BaseAlignmentResult = JSON.parse(result.response)

    if (IS_DEV) {
      if (response.success) {
        console.log(`[BaseAlignment] ✅ Success:`, {
          geniusId,
          lineCount: response.lineCount,
          wordCount: response.wordCount,
          metadataUri: response.metadataUri,
          txHash: response.txHash,
          contractError: response.contractError
        })

        if (!response.txHash) {
          console.warn('[BaseAlignment] ⚠️ No transaction hash - contract not updated!')
        }
        if (response.contractError) {
          console.error('[BaseAlignment] ❌ Contract update failed:', response.contractError)
        }
      } else {
        console.error('[BaseAlignment] ❌ Failed:', response.error)
      }
    }

    return response
  } catch (err) {
    console.error('[BaseAlignment] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Base alignment failed',
    }
  }
}
