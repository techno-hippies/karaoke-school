/**
 * ElevenLabs Alignment Service
 * Provides word-level timestamps for lyrics alignment
 */

import { config } from '../config.js'
import type { ElevenLabsAlignmentResponse, WordTimestamp } from '../types.js'

/**
 * Get word-level alignment from ElevenLabs API
 */
export async function getAlignment(
  audioFile: File,
  lyrics: string
): Promise<ElevenLabsAlignmentResponse> {
  if (!config.apis.elevenLabs) {
    throw new Error('ELEVENLABS_API_KEY not configured')
  }

  console.log('🎵 Calling ElevenLabs API for word-level alignment...')

  // Clean lyrics (remove section markers like [Chorus], [Verse])
  const cleanedLyrics = lyrics
    .replace(/\[.*?\]/g, '')      // Remove [Chorus], [Verse], etc.
    .replace(/\n\s*\n/g, '\n')    // Remove extra blank lines
    .trim()

  console.log(`   Lyrics: ${cleanedLyrics.length} characters`)
  console.log(`   Audio: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`)

  const formData = new FormData()
  formData.append('file', audioFile)
  formData.append('text', cleanedLyrics)

  const response = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {
      'xi-api-key': config.apis.elevenLabs,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  console.log(`✅ Received ${data.words?.length || 0} word timestamps`)

  // Filter out whitespace-only words
  const words = (data.words || []).filter((word: any) => {
    const text = word.text?.trim()
    return text && text.length > 0
  }) as WordTimestamp[]

  // Generate hashes for caching (simple implementation)
  const audioHash = await hashFile(audioFile)
  const lyricsHash = hashString(cleanedLyrics)

  return {
    words,
    audioHash,
    lyricsHash,
  }
}

/**
 * Load cached alignment from file
 */
export async function loadCachedAlignment(filePath: string): Promise<ElevenLabsAlignmentResponse> {
  const file = Bun.file(filePath)

  if (!(await file.exists())) {
    throw new Error(`Alignment file not found: ${filePath}`)
  }

  const data = await file.json()

  console.log(`✓ Loaded cached alignment: ${data.words?.length || 0} words`)

  return data
}

/**
 * Save alignment to cache file
 */
export async function saveCachedAlignment(
  filePath: string,
  alignment: ElevenLabsAlignmentResponse
): Promise<void> {
  await Bun.write(filePath, JSON.stringify(alignment, null, 2))
  console.log(`✓ Saved alignment cache: ${filePath}`)
}

/**
 * Hash a file (for cache validation)
 */
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a string (for cache validation)
 */
function hashString(str: string): string {
  // Simple hash for lyrics comparison
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}
