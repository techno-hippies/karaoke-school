/**
 * Artist Metadata Lit Action
 * Fetches full artist metadata from Genius API (free, no auth required)
 */

import { getLitClient } from '../../lit-webauthn/client'
import { LIT_ACTIONS } from '@/config/lit-actions'
import type { ArtistMetadataResult } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Artist Metadata Lit Action
 * Fetches full artist metadata and top songs from Genius API (free, no auth required)
 */
export async function executeArtistMetadata(
  artistId: number,
  authContext: any,
  includeTopSongs = true
): Promise<ArtistMetadataResult> {
  try {
    const litClient = await getLitClient()

    if (IS_DEV) {
      console.log('[executeArtistMetadata] Calling with:', {
        artistId,
        includeTopSongs,
        ipfsId: LIT_ACTIONS.artist,
      })
    }

    const result = await litClient.executeJs({
      ipfsId: LIT_ACTIONS.artist,
      authContext,
      jsParams: {
        artistId,
        includeTopSongs
      },
    })

    const response: ArtistMetadataResult = typeof result.response === 'string'
      ? JSON.parse(result.response)
      : result.response

    if (IS_DEV && response.success && response.artist) {
      console.log(`[Artist] ${response.artist.name} (${response.artist.followers_count} followers)`)
      if (response.topSongs) {
        console.log(`[Artist] Loaded ${response.topSongs.length} top songs`)
      }
    }

    return response
  } catch (err) {
    console.error('[Artist] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Artist metadata fetch failed',
    }
  }
}
