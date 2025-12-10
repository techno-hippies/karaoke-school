/**
 * Karaoke page actions
 */

import type { Page } from 'playwright-core'

/**
 * Check if we're on a karaoke page
 */
export async function isKaraokePage(page: Page): Promise<boolean> {
  const url = page.url()
  return url.includes('/karaoke')
}

/**
 * Check if the start button is visible and clickable
 */
export async function canStartKaraoke(page: Page): Promise<boolean> {
  try {
    const button = await page.$('button:has-text("Start")')
    return button !== null
  } catch {
    return false
  }
}

/**
 * Click the start button to begin karaoke
 */
export async function startKaraoke(page: Page): Promise<boolean> {
  try {
    // Look for the start button
    const startButton = await page.$('button:has-text("Start")')
    if (!startButton) {
      console.log('[Browser] Start button not found')
      return false
    }

    await startButton.click()
    console.log('[Browser] Clicked Start button')

    // Wait a moment for recording to begin
    await page.waitForTimeout(500)

    return true
  } catch (err) {
    console.error('[Browser] Failed to start karaoke:', err)
    return false
  }
}

/**
 * Check if karaoke is currently recording
 */
export async function isRecording(page: Page): Promise<boolean> {
  try {
    // Look for the recording indicator
    const indicator = await page.$('text=Recording...')
    return indicator !== null
  } catch {
    return false
  }
}

/**
 * Wait for karaoke to finish (results page appears)
 */
export async function waitForResults(page: Page, timeout = 120000): Promise<boolean> {
  try {
    // Wait for results page elements
    await page.waitForSelector('text=Results', { timeout })
    return true
  } catch {
    return false
  }
}

/**
 * Read the score from results page
 */
export async function readScore(page: Page): Promise<number | null> {
  try {
    const scoreText = await page.$eval('[data-score]', (el) => el.textContent)
    if (scoreText) {
      return parseInt(scoreText)
    }

    // Fallback: look for any number that looks like a score
    const bodyText = await page.textContent('body')
    const match = bodyText?.match(/(\d+)%/)
    if (match) {
      return parseInt(match[1])
    }

    return null
  } catch {
    return null
  }
}

/**
 * Click "Play Again" button
 */
export async function clickPlayAgain(page: Page): Promise<boolean> {
  try {
    const button = await page.$('button:has-text("Play Again")')
    if (button) {
      await button.click()
      return true
    }
    return false
  } catch {
    return false
  }
}
