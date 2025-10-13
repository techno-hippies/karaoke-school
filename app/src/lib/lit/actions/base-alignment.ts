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
 * @param soundcloudPermalink - SoundCloud track permalink
 * @param plainLyrics - Plain text lyrics (no timestamps)
 * @param authContext - PKP auth context
 */
export async function executeBaseAlignment(
  geniusId: number,
  soundcloudPermalink: string,
  plainLyrics: string,
  authContext: any
): Promise<BaseAlignmentResult> {
  try {
    const litClient = await getLitClient()
    const keyParams = getKaraokeKeyParams()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_BASE_ALIGNMENT,
      authContext,
      jsParams: {
        geniusId,
        soundcloudPermalink,
        plainLyrics,
        ...keyParams,
        updateContract: true,
      },
    })

    const response: BaseAlignmentResult = JSON.parse(result.response)

    if (IS_DEV && response.success) {
      console.log(`[BaseAlignment] Generated word timing for song ${geniusId}`,
        `(${response.lineCount} lines, ${response.wordCount} words)`)
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
