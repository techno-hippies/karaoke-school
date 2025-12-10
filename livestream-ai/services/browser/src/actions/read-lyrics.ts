/**
 * Read lyrics from karaoke page DOM
 */

import type { Page } from 'playwright-core'
import type { LyricLine } from '@livestream-ai/types'

export interface KaraokeLyricsData {
  lyrics: LyricLine[]
  title: string
  artist: string
}

/**
 * Extract lyrics timing data from the karaoke page.
 *
 * The app stores lyrics in React/SolidJS state, but we can read them
 * from the DOM or intercept network requests.
 *
 * Strategy: Look for the metadata in the page's data layer or
 * intercept the GraphQL/fetch response.
 */
export async function readLyricsFromPage(page: Page): Promise<KaraokeLyricsData | null> {
  try {
    // Wait for lyrics to load (timeline element appears)
    await page.waitForSelector('[data-line-index]', { timeout: 10000 }).catch(() => null)

    // Try to extract from window state (if app exposes it)
    const data = await page.evaluate(() => {
      // Check if app exposes lyrics data globally (we can add this hook)
      const w = window as any

      if (w.__KARAOKE_LYRICS__) {
        return w.__KARAOKE_LYRICS__ as KaraokeLyricsData
      }

      // Fallback: Try to extract from DOM
      // Look for data attributes on lyric elements
      const lines: LyricLine[] = []
      const lineElements = document.querySelectorAll('[data-line-index]')

      lineElements.forEach((el) => {
        const index = parseInt(el.getAttribute('data-line-index') || '0')
        const startMs = parseInt(el.getAttribute('data-start-ms') || '0')
        const endMs = parseInt(el.getAttribute('data-end-ms') || '0')
        const text = el.textContent?.trim() || ''

        if (text) {
          lines.push({ index, text, startMs, endMs })
        }
      })

      // Try to get title/artist from page
      const title = document.querySelector('h1')?.textContent || 'Unknown'
      const artist = document.querySelector('h2')?.textContent || 'Unknown'

      if (lines.length > 0) {
        return { lyrics: lines, title, artist }
      }

      return null
    })

    return data
  } catch (err) {
    console.error('[Browser] Failed to read lyrics:', err)
    return null
  }
}

/**
 * Intercept network requests to capture lyrics metadata.
 * This is more reliable than DOM scraping.
 */
export async function interceptLyricsMetadata(page: Page): Promise<KaraokeLyricsData | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 15000)

    page.on('response', async (response) => {
      const url = response.url()

      // Look for Grove metadata requests
      if (url.includes('grove.storage') || url.includes('api.thegraph.com')) {
        try {
          const json = await response.json()

          // Check if this is karaoke metadata
          if (json.karaoke_lines || json.full_karaoke_lines) {
            const karaokeLines = json.full_karaoke_lines || json.karaoke_lines
            const lyrics: LyricLine[] = karaokeLines.map((line: any, i: number) => ({
              index: i,
              text: line.text || line.original_text || '',
              startMs: Number(line.start_ms),
              endMs: Number(line.end_ms),
            }))

            clearTimeout(timeout)
            resolve({
              lyrics,
              title: json.title || 'Unknown',
              artist: json.artist || 'Unknown',
            })
          }
        } catch {
          // Not JSON or not the right format
        }
      }
    })
  })
}
