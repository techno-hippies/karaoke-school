/**
 * Song Metadata Lit Action
 * Fetches full song metadata from Genius API (free, no auth required)
 */

import { getLitClient } from '../../lit-webauthn/client'
import { LIT_ACTIONS } from '@/config/lit-actions'
import type { SongMetadataResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Song Metadata Lit Action
 * Fetches full song metadata from Genius API (free, no auth required)
 */
export async function executeSongMetadata(
  songId: number,
  authContext: any
): Promise<SongMetadataResult> {
  try {
    const litClient = await getLitClient()

    console.log('[executeSongMetadata] Calling with:', {
      songId,
      ipfsId: LIT_ACTIONS.song,
      jsParams: { songId }
    })

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTIONS.song,
      authContext,
      jsParams: { songId },
    })

    const response: SongMetadataResult = typeof result.response === 'string'
      ? JSON.parse(result.response)
      : result.response

    if (IS_DEV && response.success && response.song) {
      console.log(`[Song] ${response.song.artist} - ${response.song.title}`)
    }

    return response
  } catch (err) {
    console.error('[Song] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Song metadata fetch failed',
    }
  }
}
