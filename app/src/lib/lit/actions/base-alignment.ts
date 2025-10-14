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

import { getLitClient } from '../../lit-webauthn/client'
import { getKaraokeKeyParams } from '../keys'
import type { BaseAlignmentResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Base Alignment Lit Action V2
 *
 * Reads ALL data from contract (soundcloudPath, title, artist)
 * Fetches lyrics from LRClib
 * Runs ElevenLabs alignment
 * Writes back to contract using SYSTEM PKP (hardcoded in Lit Action)
 *
 * @param geniusId - Genius song ID (ONLY required input)
 * @param authContext - PKP auth context for authentication
 */
export async function executeBaseAlignment(
  geniusId: number,
  authContext: any
): Promise<BaseAlignmentResult> {
  try {
    if (IS_DEV) {
      console.log('[BaseAlignment] authContext:', authContext)
      console.log('[BaseAlignment] authContext keys:', Object.keys(authContext || {}))
    }

    const litClient = await getLitClient()
    const keyParams = getKaraokeKeyParams()

    if (IS_DEV) {
      console.log('[BaseAlignment] Calling executeJs with:', {
        ipfsId: import.meta.env.VITE_LIT_ACTION_BASE_ALIGNMENT,
        hasAuthContext: !!authContext,
        geniusId
      })
    }

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_BASE_ALIGNMENT,
      authContext,
      jsParams: {
        geniusId,
        ...keyParams,
        contractAddress: import.meta.env.VITE_KARAOKE_CATALOG_CONTRACT,
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
