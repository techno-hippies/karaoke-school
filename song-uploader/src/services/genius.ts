/**
 * Genius API Service
 *
 * NOTE: Genius API doesn't support uploading songs programmatically.
 * This service helps users understand their options:
 *
 * Option 1: Upload manually via genius.com/add-a-song
 * - Get geniusId, add to metadata.json
 * - Song works with existing /karaoke/song/{geniusId} route
 *
 * Option 2: Skip Genius (geniusId = 0)
 * - Use custom songId
 * - Requires new route /karaoke/song/custom/{songId}
 */

import { config } from '../config.js'
import type { GeniusUploadResponse } from '../types.js'

/**
 * Check if song exists on Genius by search
 */
export async function searchGeniusSong(
  title: string,
  artist: string
): Promise<{ found: boolean; geniusId?: number; url?: string }> {
  if (!config.apis.genius) {
    return { found: false }
  }

  try {
    const query = `${title} ${artist}`
    const response = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${config.apis.genius}`,
        },
      }
    )

    const data = await response.json()

    if (data.response?.hits?.[0]) {
      const firstHit = data.response.hits[0].result
      console.log(`✓ Found on Genius: "${firstHit.title}" by ${firstHit.primary_artist.name}`)
      console.log(`  Genius ID: ${firstHit.id}`)
      console.log(`  URL: ${firstHit.url}`)

      return {
        found: true,
        geniusId: firstHit.id,
        url: firstHit.url,
      }
    }

    return { found: false }
  } catch (error) {
    console.error('Genius search failed:', error)
    return { found: false }
  }
}

/**
 * Validate geniusId from metadata.json
 */
export async function validateGeniusId(geniusId: number): Promise<boolean> {
  if (!config.apis.genius) {
    return false
  }

  try {
    const response = await fetch(
      `https://api.genius.com/songs/${geniusId}`,
      {
        headers: {
          Authorization: `Bearer ${config.apis.genius}`,
        },
      }
    )

    const data = await response.json()

    if (data.response?.song) {
      console.log(`✓ Genius ID ${geniusId} is valid: "${data.response.song.title}"`)
      return true
    }

    return false
  } catch (error) {
    console.error(`Genius ID ${geniusId} validation failed:`, error)
    return false
  }
}

/**
 * Show instructions for manual Genius upload
 */
export function showGeniusInstructions(title: string, artist: string): void {
  console.log('\n📝 To get a Genius ID for this song:')
  console.log('   1. Visit: https://genius.com/add-a-song')
  console.log(`   2. Submit: "${title}" by ${artist}`)
  console.log('   3. Get the song ID from the URL (e.g., genius.com/songs/12345)')
  console.log('   4. Add "geniusId": 12345 to metadata.json')
  console.log('\n   OR proceed without Genius ID (will use geniusId: 0)\n')
}
